"""In-memory HTTP cookie authentication. SQL persistence follows in Issues #16–#18."""
from __future__ import annotations
import hashlib
import hmac
import re
import secrets
import threading
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .config import Settings
from .repositories import RepositoryFactory

COOKIE_NAME = "devatlas_session"
COOKIE_PATH = "/api/v1"
SESSION_LIFETIME = timedelta(hours=8)
PASSWORD_ITERATIONS = 600_000
EMAIL_RE = re.compile(r'^[^\s@<>(),;:"\\]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$', re.I)

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class SignUpInput(StrictModel):
    displayName: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("displayName")
    @classmethod
    def clean_name(cls, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError("Display name is required")
        return name

    @field_validator("email")
    @classmethod
    def clean_email(cls, email: str) -> str:
        email = email.strip().lower()
        if not EMAIL_RE.fullmatch(email) or len(email.split('@')[0]) > 64:
            raise ValueError("Invalid email")
        return email

    @field_validator("password")
    @classmethod
    def check_password(cls, password: str) -> str:
        if not password.strip():
            raise ValueError("Password is required")
        return password

class LoginInput(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def clean_email(cls, email: str) -> str:
        return SignUpInput.clean_email(email)

class PublicUser(StrictModel):
    id: str
    displayName: str
    email: str
    createdAt: str

class ApiSession(StrictModel):
    kind: str = "http"
    user: PublicUser
    authenticatedAt: str

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso_time(moment: datetime) -> str:
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")

def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"

def matches_password(password: str, stored: str) -> bool:
    try:
        scheme, rounds, salt, expected = stored.split('$')
        if scheme != "pbkdf2_sha256" or not 100_000 <= int(rounds) <= 2_000_000:
            return False
        derived = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(derived, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False

def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def denied(code: str, message: str, status: int) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})

class AuthManager:
    """Serialize signup and session rotation; use digest-keyed session storage."""
    def __init__(self, factory: RepositoryFactory, clock=now_utc):
        self.users = factory.create("users")
        self.sessions = factory.create("sessions")
        self.clock = clock
        self._lock = threading.RLock()
        self._dummy_hash = password_hash("unused-dummy-password")

    def create_user(self, payload: SignUpInput) -> dict:
        with self._lock:
            if any(user["email"] == payload.email for user in self.users.list()):
                raise denied("EMAIL_IN_USE", "An account already uses this email.", 409)
            user = {
                "id": f"user-{uuid4().hex}",
                "displayName": payload.displayName,
                "email": payload.email,
                "createdAt": iso_time(self.clock()),
                "passwordHash": password_hash(payload.password),
            }
            self.users.put(user["id"], user)
            return user

    def authenticate(self, payload: LoginInput) -> dict:
        with self._lock:
            user = next((u for u in self.users.list() if u["email"] == payload.email), None)
            valid = matches_password(payload.password, user["passwordHash"] if user else self._dummy_hash)
            if not user or not valid:
                raise denied("INVALID_CREDENTIALS", "Email or password is incorrect.", 401)
            return user

    def revoke(self, token: str | None) -> None:
        if token:
            with self._lock:
                self.sessions.delete(token_digest(token))

    def create_session(self, user: dict, previous_token: str | None) -> tuple[str, dict]:
        with self._lock:
            self.revoke(previous_token)
            token = secrets.token_urlsafe(32)
            when = self.clock()
            session = {
                "userId": user["id"],
                "authenticatedAt": iso_time(when),
                "expiresAt": iso_time(when + SESSION_LIFETIME),
            }
            self.sessions.put(token_digest(token), session)
            return token, session

    def current_user(self, token: str | None) -> tuple[dict, dict] | None:
        if not token:
            return None
        with self._lock:
            digest = token_digest(token)
            session = self.sessions.get(digest)
            if not session:
                return None
            expiry = datetime.fromisoformat(session["expiresAt"].replace("Z", "+00:00"))
            if expiry <= self.clock():
                self.sessions.delete(digest)
                return None
            user = self.users.get(session["userId"])
            if not user:
                self.sessions.delete(digest)
                return None
            return user, session

def user_public(user: dict) -> PublicUser:
    return PublicUser(**{key: user[key] for key in ("id", "displayName", "email", "createdAt")})

def session_public(user: dict, session: dict) -> ApiSession:
    return ApiSession(user=user_public(user), authenticatedAt=session["authenticatedAt"])

def get_auth_manager(request: Request) -> AuthManager:
    return request.app.state.auth

def require_user(request: Request, auth: Annotated[AuthManager, Depends(get_auth_manager)]) -> PublicUser:
    current = auth.current_user(request.cookies.get(COOKIE_NAME))
    if current is None:
        raise denied("UNAUTHENTICATED", "Sign in to continue.", 401)
    return user_public(current[0])

def enforce_owner(owner_id: str, user: PublicUser) -> None:
    """Future personal endpoints must use the authenticated user, never a body-supplied owner."""
    if owner_id != user.id:
        raise denied("FORBIDDEN", "You do not have access to this resource.", 403)

def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, secure=settings.environment == "production",
        samesite="lax", path=COOKIE_PATH, max_age=int(SESSION_LIFETIME.total_seconds()),
    )

def check_unsafe_origin(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    settings: Settings = request.app.state.settings
    origin = request.headers.get("origin")
    if (origin is not None and origin != settings.frontend_origin) or request.headers.get("sec-fetch-site") == "cross-site":
        raise denied("FORBIDDEN", "Request origin is not permitted.", 403)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/signup", status_code=201, response_model=ApiSession, dependencies=[Depends(check_unsafe_origin)])
def signup(payload: SignUpInput, request: Request, response: Response, auth: Annotated[AuthManager, Depends(get_auth_manager)]):
    user = auth.create_user(payload)
    token, session = auth.create_session(user, request.cookies.get(COOKIE_NAME))
    set_session_cookie(response, token, request.app.state.settings)
    return session_public(user, session)

@router.post("/login", response_model=ApiSession, dependencies=[Depends(check_unsafe_origin)])
def login(payload: LoginInput, request: Request, response: Response, auth: Annotated[AuthManager, Depends(get_auth_manager)]):
    user = auth.authenticate(payload)
    token, session = auth.create_session(user, request.cookies.get(COOKIE_NAME))
    set_session_cookie(response, token, request.app.state.settings)
    return session_public(user, session)

@router.post("/logout", status_code=204, dependencies=[Depends(check_unsafe_origin)])
def logout(request: Request, response: Response, auth: Annotated[AuthManager, Depends(get_auth_manager)]):
    auth.revoke(request.cookies.get(COOKIE_NAME))
    response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH, secure=request.app.state.settings.environment == "production", httponly=True, samesite="lax")
    return Response(status_code=204, headers=response.headers)

@router.get("/session", response_model=ApiSession | None)
def get_session(request: Request, auth: Annotated[AuthManager, Depends(get_auth_manager)]):
    current = auth.current_user(request.cookies.get(COOKIE_NAME))
    return session_public(*current) if current else None

@router.get("/me", response_model=PublicUser)
def get_me(user: Annotated[PublicUser, Depends(require_user)]):
    return user
