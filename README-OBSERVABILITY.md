# DevAtlas — DevOps & Observability assignment

## What this package contains

- **AWS separation:** existing EC2 remains production; provision a *different* EC2, database volume, domain and environment (`DEVATLAS_ENVIRONMENT=development`) for development. Never reuse PostgreSQL volumes or credentials across environments.
- **CI/CD:** after `Full-stack PostgreSQL and Compose CI/CD`, existing GHCR workflow publishes immutable commit-tagged images. `deploy-aws.yml` now auto-deploys only to development. `promote-production.yml` is manual via **Actions → Promote verified development image to production → Run workflow**. A production GitHub Environment approval is strongly recommended. Production SHA must match the SHA currently running on development. Both paths check health and attempt rollback on failure.
- **Telemetry:** optional OTLP/HTTP OpenTelemetry application traces, metrics and warning-level logs. Business metrics: quiz attempts/passes, progress changes, auth success/failure. No email, session cookie, token or user ID as a metric attribute.
- **Monitoring:** OTEL Collector → Prometheus/Loki/Tempo → provisioned Grafana dashboard. Prometheus alert rules → Alertmanager → on-call responder. The responder performs read-only triage, optionally calls an LLM for advisory analysis, and optionally writes a GitHub Issue. No automatic remediation.

## Preparation (required manual operations)

1. Apply `INTEGRATION.md` source changes in the existing repository, and copy all new files. Replace the existing `.github/workflows/deploy-aws.yml` with the version in this package. Review changes in a PR before merging.
2. **Provision a separate development instance and URL.** Existing production AWS resources are not reused. Ensure both hosts have `/opt/devatlas`, Docker Compose, public GHCR image access, and correctly scoped IAM Session Manager permissions. For the development EC2 use its own CloudFormation stack with distinct VPC/subnet resources if appropriate; never accidentally duplicate static resource names.
3. Set GitHub Actions repository/environment variables `AWS_ROLE_ARN`, `AWS_DEV_INSTANCE_ID`, `AWS_INSTANCE_ID` (production). Configure `development` and `production` GitHub Environments, and require a reviewer for `production` when plan permits. Assign trusted OIDC roles and restrict deploy targets on the AWS side; use least privilege.
4. Create a unique domain and `.env.aws` on the development EC2 with its own Postgres password. Existing production `.env.aws` and database must be preserved. Ensure dev is configured `DEVATLAS_ENVIRONMENT=development` and prod remains `production`; the existing `cloud/aws/compose.aws.yaml` is **hard-coded production** and must be parameterized as below before starting dev.
5. Change `DEVATLAS_ENVIRONMENT: production` in existing `cloud/aws/compose.aws.yaml` to `DEVATLAS_ENVIRONMENT: ${DEVATLAS_ENVIRONMENT:-production}` and add `DEVATLAS_RELEASE: ${DEVATLAS_RELEASE:-local}` and `DEVATLAS_OTEL_ENABLED: ${DEVATLAS_OTEL_ENABLED:-false}` and `OTEL_EXPORTER_OTLP_ENDPOINT: ${OTEL_EXPORTER_OTLP_ENDPOINT:-http://collector:4318}` under `devatlas.environment`. Collector connectivity depends on deployment networking. When running collector separately, `collector` is **not** resolvable without connecting Compose projects to a shared private Docker network. See networking below.
6. Run from repository root (assuming Docker Compose installed): `cp observability/.env.example observability/.env`, choose a strong Grafana password; then `docker compose --env-file observability/.env -f observability/compose.observability.yaml up -d --build`. Open **http://localhost:3000** for Grafana and **http://localhost:9090** for Prometheus. Both bind localhost only.
7. To send app telemetry to collector when app and collector share the *same host*, use the `devatlas` container's Docker host gateway mapping (`extra_hosts: ['host.docker.internal:host-gateway']`) and `OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318`. **Important:** collector currently binds the Docker host port to `127.0.0.1`; containers cannot access that port via host gateway on some Linux hosts. Preferred: attach the app and collector to an explicitly created shared internal Docker network and use collector container DNS. Alternatively bind collector to a private non-public interface. Never expose port 4318 without firewall and auth.
8. On new source push to `main`, check publish and development deploy workflows. Verify development health and business telemetry. To promote, provide exact commit SHA in manual GitHub workflow. Reviewer must approve before production deployment. Check production health and Grafana after deploying.

## Dashboard and alerts

Grafana dashboard **DevAtlas — Business & Reliability** shows quiz submissions/min, quiz pass ratio, progress changes/min and authentication failures/min. Explore Tempo service `devatlas-api` for spans and Loki for structured warning-level application logs. The alert fires for >50% failing quizzes across >=10 submissions in 5 minutes, sustained 5 minutes. A second rule warns after missing *business* metric series for 30 minutes (low usage may legitimately trigger this). Review thresholds after real usage.

The on-call service accepts only internal Alertmanager network traffic, sanitizes received alert fields and sends **only** alert name, severity, summary and runbook to the optional AI API. Its recommendation is advisory, with a safe local fallback when no API key exists. Set `OPENAI_API_KEY` only if authorized and comfortable with its costs. Set `GITHUB_TOKEN` only for optional automated issue creation with **Issues:write on this one repository**; absent token it only logs triage results. AI cannot run shell commands, change infrastructure or deploy code. Notification dedupe is currently in-process; after restart, the same firing alert can create another issue. Do not enable automated issue creation until you accept this limitation.

## Verification commands

```sh
# Validate YAML syntax and rendered compose setup
python -m pip install pyyaml
python -c 'import yaml,pathlib; [yaml.safe_load(p.read_text()) for p in pathlib.Path("observability").rglob("*.yaml")]; print("valid")'
GRAFANA_ADMIN_PASSWORD=local_test_password docker compose -f observability/compose.observability.yaml config --quiet

# After starting stack
curl -fsS http://localhost:9090/-/ready
curl -fsS http://localhost:3000/api/health

# In development instance: should be separate from prod
sudo grep '^APP_IMAGE=' /opt/devatlas/.env.aws
```

**Not verified here:** running containers, production rollout, alert delivery and GitHub Actions because this session has no access to the deployed AWS hosts and GitHub branch-writing permission. The package is a starting implementation, not a claim of live completion. Image tags are pinned examples; maintain versions and image digest policies for production. Deployment scripts need additional production hardening: multi-instance coordination, DB backups, rollback on smoke-test anomalies, strict OIDC IAM roles, and monitoring-host durability. Running monitoring containers incurs CPU/RAM/storage expense; don't install them on a tiny EC2 production host without a cost/capacity check.

## Automatic source integration

After extracting this package at the repository root, run `python apply.py`. It performs the existing-file edits in `INTEGRATION.md` once (idempotent), including dependency changes, four FastAPI modules, and AWS Compose env variable parameterization. Then install dependencies and run tests. This script does not require cloud credentials and does not deploy anything.


### Shared Docker network (same monitoring host)
Before starting either Compose project, run `docker network create devatlas-telemetry` **on that specific host** (once). The integration script adds `devatlas` and the collector to this external network so the app can reach `http://collector:4318` by DNS. The database and reverse proxy remain on their original private network. Collector ingestion is not exposed publicly. If monitoring runs on a **different host**, configure a secured OTLP endpoint (TLS, auth and firewall) instead; this package does not implement cross-host collector connectivity.

The source integration script also disables the existing **Render production auto-deploy** job in `fullstack-ci.yml`, preventing a second automatic production deployment route. Review the CI changes before merging.
