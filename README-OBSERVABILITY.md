# DevAtlas — DevOps & Observability

Current implementation and verification, 17 November 2026. The repository includes
a FastAPI + React + PostgreSQL application, AWS EC2 deployment, observability
instrumentation and repeatable GitHub Actions tests.

## Environments and release safety

| Target | Instance | Deployment |
|---|---|---|
| Development | `i-02e00d28cf030334d` | Automatic after successful full-stack CI + GHCR publish |
| Production | `i-04c0e9c7e74eaba84` | **Manual only**; no push-triggered Production release |

Development URL: https://32.201.201.75.sslip.io/ .
Deployment release is a full 40-character Git SHA published at
`ghcr.io/nurdauleterbool/devatlas:<sha>`.

The **Development** IAM role `DevAtlasGitHubDevelopmentRole` can send
SSM commands only to the Development EC2. The distinct **Production**
role `DevAtlasGitHubDeployRole` can send SSM commands only to the Production
EC2. Both roles trust only OIDC from this repository's `main` branch;
no AWS keys are committed to Git.

`.github/workflows/deploy-aws.yml` deploys automatically **only to
Development**, sets `DEVATLAS_ENVIRONMENT=development` and the exact
`DEVATLAS_RELEASE`, then smoke-tests HTTPS and attempts rollback on failure.

`.github/workflows/promote-production.yml` requires an explicit manual
dispatch, a specific SHA already running on Development, exact confirmation
`PROMOTE_TO_PRODUCTION`, and a GitHub `production` Environment approval job
before assuming the Production-only IAM role. **Configure required reviewers
in repository Settings → Environments → production, when supported.**
Environment declaration alone does not enforce reviewer approval.
Real Production promotion was deliberately **NOT run**, so no claim of
Production rollout verification is made. See
[`cloud/aws/README-production-promotion.md`](cloud/aws/README-production-promotion.md).

## OpenTelemetry and monitoring

FastAPI OpenTelemetry is opt-in via `DEVATLAS_OTEL_ENABLED=true` with
`OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318` on a shared private
Docker network. It emits:

- Business counters for quiz submissions/pass outcomes, progress changes,
  and authentication success/failure, with low-cardinality attributes.
- FastAPI request traces via OTLP/HTTP.
- Warning-level application logs via OTLP/HTTP.

Flow: **DevAtlas app → OTel Collector → Prometheus metrics / Tempo traces /
Loki logs → Grafana dashboards**.
Prometheus loads the `DevAtlasQuizFailuresHigh` and
`DevAtlasTelemetryMissing` alert rules. Alertmanager sends its webhook to
the private On-call responder.

The Grafana dashboard **DevAtlas — Business & Reliability** visualizes quiz
submission volume, pass ratio, progress updates, and authentication failures.

### What is actually tested

GitHub Actions includes three complementary tests:

1. `observability-ci.yml`: Grafana, YAML, OTLP, alert routing,
   AI fallback, deduplication and safe local verifier unit tests.
2. `observability-stack-e2e.yml`: boots a complete **disposable**
   monitoring Docker stack, submits synthetic OTLP data, verifies real
   Prometheus query + dashboard provisioning, and delivers a synthetic
   Alertmanager webhook to On-call.
3. `observability-real-app-ci.yml`: starts **the real DevAtlas app** and
   PostgreSQL with OTel enabled, calls a real auth API with a fictional,
   invalid CI credential (no user created), and verifies that the **app's
   own** `devatlas_auth_attempts_total` counter appears in Prometheus.

All test infrastructure is disposable and isolated from AWS. A CI green
check **does not prove live AWS telemetry is enabled**.

### Monitoring deployment status

The complete Grafana/Prometheus/Loki/Tempo stack is **NOT running on the
AWS Development EC2**. That t3.micro is too small to safely add the full
stack alongside the app and PostgreSQL. The cloud app's
`DEVATLAS_OTEL_ENABLED` defaults to `false` until a private reachable
Collector is deployed. A separate monitoring host/private secure OTLP
path needs resource and cost approval; do **not** publicly expose OTLP.
For running a local stack, see [`observability/RUNBOOK.md`](observability/RUNBOOK.md).
Never install this monitoring stack on the Production micro instance.

## AI On-call

`observability/oncall/responder.py`:

- Accepts Alertmanager webhook only on the internal Docker network.
- Sanitizes untrusted alert names/summaries and avoids personal-data labels.
- Deduplicates incidents using persistent SQLite state even after restart.
- Falls back to safe human-check instructions when no AI API key exists.
- Optionally calls OpenAI for *advisory* analysis only; it never runs cloud
  commands or automatic rollback.
- Optionally creates a GitHub Issue using a **separately scoped**
  `GITHUB_TOKEN`. With no token, logs diagnosis without filing an Issue.

The fallback, mocked AI success/error cases, and actual
**Alertmanager → On-call webhook** are covered in CI, without real API
keys or paid external AI calls.

**Real AI usage is NOT enabled** because no `OPENAI_API_KEY` was supplied
or installed. API usage may incur separate charges. Do not commit
credentials or paste them in public issues. Consult
[`observability/.env.example`](observability/.env.example) before
configuring a private monitoring host.

## Quick checks for a monitoring host

From repository root, on an adequately sized **separate monitoring host**:

```bash
docker network inspect devatlas-telemetry >/dev/null 2>&1 || docker network create devatlas-telemetry
cp observability/.env.example observability/.env
# Set a strong, unique GRAFANA_ADMIN_PASSWORD in observability/.env.
# Leave OPENAI_API_KEY and GITHUB_TOKEN blank unless approved.
docker compose --env-file observability/.env -f observability/compose.observability.yaml up -d --build
python -m pip install 'PyYAML>=6,<7'
python observability/verify_live.py --json
```

Only services on the **same host and private Docker network** can use
`http://collector:4318`. Cross-host OTLP requires separately secured
routing/authentication, which this repository does not provision.

## Known limits / responsible completion

- Actual Cloud-hosted monitoring, real AWS business telemetry ingestion and
  a managed monitoring budget have **not** been configured.
- A real OpenAI API key has **not** been provisioned; the safe fallback works.
- Manual Production rollout is implemented and statically verified, but
  **no Production deployment has been executed**. Confirm backups and GitHub
  Environment required-reviewer protections before any real promotion.
- The EC2 demo is single-instance, not high-availability. PostgreSQL
  persistence lives on EBS; ensure backups before infrastructure changes.

Do not confuse CI readiness with a fully operated Production monitoring service.
