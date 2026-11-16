"""Idempotently apply DevAtlas changes to an existing source checkout.
Run from repository root: python path/to/extracted/apply.py
Copy the extracted package into repository root first.
"""
from pathlib import Path
root = Path.cwd()
if not (root/'backend/app/main.py').exists():
    raise SystemExit('Run from DevAtlas repository root after extracting package here')

def change(path, old, new):
    file=root/path
    text=file.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'Integration marker missing in {path}: {old[:70]!r}')
    file.write_text(text.replace(old,new,1),encoding='utf-8')

change('backend/pyproject.toml',
       '"psycopg[binary]>=3.2,<4"]',
       '"psycopg[binary]>=3.2,<4", "opentelemetry-api>=1.28,<2", "opentelemetry-sdk>=1.28,<2", "opentelemetry-exporter-otlp-proto-http>=1.28,<2", "opentelemetry-instrumentation-fastapi>=0.49b0,<1"]')
change('backend/app/main.py',
       'from .config import Settings',
       'from .observability import configure\nfrom .config import Settings')
change('backend/app/main.py',
       '    log.info("FastAPI application initialized after %.2fs", time.monotonic() - started_at)',
       '    configure(app)\n    log.info("FastAPI application initialized after %.2fs", time.monotonic() - started_at)')
change('backend/app/quizzes.py',
       'from .repositories import RepositoryFactory',
       'from .observability import record\nfrom .repositories import RepositoryFactory')
change('backend/app/quizzes.py',
       '            self.factory.create("quiz_attempts").put(attempt["id"], attempt)',
       '            self.factory.create("quiz_attempts").put(attempt["id"], attempt)\n            record("quiz", outcome="passed" if attempt["passed"] else "failed")\n            if attempt["passed"]:\n                record("quiz_pass")')
change('backend/app/progress.py',
       'from .repositories import RepositoryFactory',
       'from .observability import record\nfrom .repositories import RepositoryFactory')
change('backend/app/progress.py',
       '            self._history_repository().put(event_id, {\n                "id": event_id, "userId": user_id, "skillId": skill_id,\n                "fromStatus": previous.status, "toStatus": status,\n                "changedAt": changed_at,\n            })',
       '            self._history_repository().put(event_id, {\n                "id": event_id, "userId": user_id, "skillId": skill_id,\n                "fromStatus": previous.status, "toStatus": status,\n                "changedAt": changed_at,\n            })\n            record("progress", status=status)')
change('backend/app/auth.py',
       'from .config import Settings',
       'from .observability import record\nfrom .config import Settings')
change('backend/app/auth.py',
       '            if not user or not valid:\n                raise denied("INVALID_CREDENTIALS", "Email or password is incorrect.", 401)\n            return user',
       '            if not user or not valid:\n                record("auth", outcome="failure")\n                raise denied("INVALID_CREDENTIALS", "Email or password is incorrect.", 401)\n            record("auth", outcome="success")\n            return user')
change('cloud/aws/compose.aws.yaml',
       '      DEVATLAS_ENVIRONMENT: production',
       '      DEVATLAS_ENVIRONMENT: ${DEVATLAS_ENVIRONMENT:-production}\n      DEVATLAS_RELEASE: ${DEVATLAS_RELEASE:-local}\n      DEVATLAS_OTEL_ENABLED: ${DEVATLAS_OTEL_ENABLED:-false}\n      OTEL_EXPORTER_OTLP_ENDPOINT: ${OTEL_EXPORTER_OTLP_ENDPOINT:-http://collector:4318}')
# Stop the pre-existing Render auto-deploy (production must be manual).
ci = root/'.github/workflows/fullstack-ci.yml'
ci_content = ci.read_text(encoding='utf-8')
marker = '\n  deploy:\n    needs: [unit, integration]'
if marker in ci_content:
    ci.write_text(ci_content.split(marker)[0].rstrip()+'\n', encoding='utf-8')

# Compose projects share a private Docker DNS network for OTLP/HTTP.
compose = root/'cloud/aws/compose.aws.yaml'
c = compose.read_text(encoding='utf-8')
if 'networks: [private, telemetry]' not in c:
    c = c.replace('    networks: [private]\n\n  https:', '    networks: [private, telemetry]\n\n  https:', 1)
    c = c.replace('networks:\n  private:\n    driver: bridge', 'networks:\n  private:\n    driver: bridge\n  telemetry:\n    external: true\n    name: devatlas-telemetry', 1)
    compose.write_text(c,encoding='utf-8')

print('DevAtlas instrumentation and deployment configuration integrated; review git diff and run tests.')
