# Apply the small backend integration changes

Add to `backend/pyproject.toml` dependencies:

```toml
"opentelemetry-api>=1.28,<2", "opentelemetry-sdk>=1.28,<2",
"opentelemetry-exporter-otlp-proto-http>=1.28,<2",
"opentelemetry-instrumentation-fastapi>=0.49b0,<1",
```

In `backend/app/main.py`, import `from .observability import configure` and insert `configure(app)` after middleware and route registrations, **before** `return app`. In `backend/app/quizzes.py`, import `from .observability import record` and after `self.factory.create("quiz_attempts").put(...)` add:

```python
record('quiz', outcome='passed' if attempt['passed'] else 'failed')
if attempt['passed']:
    record('quiz_pass')
```

In `backend/app/progress.py`, import `record` and immediately after a successful history event write in `update` add:

```python
record('progress', status=status)
```

In `backend/app/auth.py`, import `record` and inside `authenticate` add `record('auth', outcome='failure')` before the invalid credentials exception and `record('auth', outcome='success')` before successful return. Do NOT attach email or user ID labels.

`backend/app/observability.py` has been supplied as a full new module. Test with `DEVATLAS_OTEL_ENABLED=true` only after collector is running. This integration requires redeploying the app container.
