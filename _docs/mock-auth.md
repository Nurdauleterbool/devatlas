# Mock authentication — MVP-03

This frontend-only prototype uses the same replaceable `DevAtlasService` boundary as careers, progress and quizzes. It implements no backend, token system, persistent credentials or production authorization. Public pages remain available; anonymous roadmap progress is explicitly labelled as sample data.

## Contract and lifecycle

| Method | Result |
| --- | --- |
| `getSession()` | `AuthSession` containing `kind: 'mock'`, public `User` and `authenticatedAt`, or `null` |
| `signUp({ displayName, email, password })` | Validate, create an isolated account and sign it in |
| `logIn({ email, password })` | Sign in an account registered in this service instance |
| `logInDemo()` | Select the seeded sample user without displaying or requesting a demo password |
| `logOut()` | Clear the active session and return to anonymous sample preview |

The application creates its adapter with `initialSession: 'anonymous'`. The factory default remains `demo` for compatibility with Issue #2 consumers; `userId` still selects a seeded initial user. Existing fixture users have no password credentials and are not email/password login accounts. The UI's demo button is an explicit mock action.

```ts
const mock = createMockService({ initialSession: 'anonymous', latencyMs: 300 })
await mock.logInDemo()
const session = await mock.getSession() // public user; never a password/hash
await mock.logOut()
```

Signup accounts, hashes, session and personal data exist only in one adapter's memory. Route navigation retains them. A full reload/new instance resets them, requiring registration again. There is no local/session storage. Registered users start with unstarted skills, no attempts, no history and no selections; existing demo fixtures are preserved. Dashboard/Career Paths remount on account changes to discard stale personalized views and local selections.

Personal operations require a session: current user, career selections, progress mutation/history, quiz submissions/attempt history and analytics. Shared catalogue, dependencies, resources, public quizzes, recommendations and read-only demo progress are available anonymously. No method accepts a caller-supplied owner ID. Request revisions reject pending work across session changes; logout invalidates older work immediately. Password hashing rechecks the revision before any mutation. A configured failed logout keeps the prior session and the UI offers retry.

## Validation and credential handling

The shared UI/service validator requires a trimmed name (1–80 characters) for signup, a practical email syntax with bounded local/domain labels, and a nonblank password of 8–128 characters. Email is trimmed and lowercased for uniqueness/login. Passwords are not trimmed or case-normalized. Signup confirmation is a UI field only. Unsupported request properties are rejected.

Signup stores only a Web Crypto PBKDF2/SHA-256 digest (100,000 iterations, random 16-byte salt, 256-bit result), kept privately in memory. Password inputs remain `type="password"`; no reveal control or credential logging is added. Public users/sessions contain neither passwords nor hashes. Auth forms clear passwords after successful or failed requests. Web Crypto requires a supported secure context (HTTPS or localhost); an unavailable crypto API surfaces as a generic authentication failure.

Unknown accounts and incorrect passwords produce the same `INVALID_CREDENTIALS` message. Duplicate normalized email returns `EMAIL_IN_USE`; malformed input returns `VALIDATION`. Anonymous personal calls return `UNAUTHENTICATED`, requests crossing account transitions return `SESSION_CHANGED`, and configured failures return `UNAVAILABLE`. The UI uses generic failure text and never renders a raw credential-bearing error.

This hashing supports realistic prototype behavior; browser-held data and the demo bypass provide no security guarantee. Production authentication, protected server-side ownership and persistent sessions belong to later stages. Use disposable test passwords.

## UI and reproducible QA

`/login` and `/signup` reuse Button, Card and Input. Labels, described errors, first-invalid-field focus, live request feedback, loading/disabled controls and a synchronous submission guard cover keyboard and duplicate-submit behavior. Sidebar account controls are outside the original five-link navigation. The existing mobile modal keeps Escape, focus containment/restoration and route-change focus behavior.

Existing `?mockLatencyMs=1500` and `?mockScenario=error` development overrides exercise pending and failure states. `failMethods` can target any auth method on isolated factory instances. The empty scenario clears catalogue/progress but retains users and supports authentication. Outcomes remain reproducible; only salts use randomness, without changing public data or scoring.

Run build, lint, Vitest and Playwright as documented in [frontend setup](../frontend/README.md). Verified results and outstanding manual checks are in [Issue #3 QA](issue-3-qa.md).
