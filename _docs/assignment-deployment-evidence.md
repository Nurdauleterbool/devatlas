# DevAtlas — live deployment and testing evidence

Recorded from the actual deployment walkthrough on **2026-11-03** (Asia/Almaty). This document distinguishes verified observations from still-pending requirements.

## Repository and verified deployment addresses

- GitHub repository: https://github.com/Nurdauleterbool/devatlas
- Render (Docker web service + managed PostgreSQL): https://devatlas-z0e0.onrender.com
- Render API health: https://devatlas-z0e0.onrender.com/api/v1/health
- AWS CloudFormation stack: `devatlas-aws` in `us-east-1` (one EC2, Docker Compose, PostgreSQL, Caddy TLS)
- AWS public HTTPS: https://54.89.51.192.sslip.io
- AWS API health: https://54.89.51.192.sslip.io/api/v1/health

**Observed:** AWS CloudFormation stack `CREATE_COMPLETE`; EC2 Docker Compose containers `devatlas-aws-postgres-1` and `devatlas-aws-devatlas-1` both reported healthy; `devatlas-aws-https-1` was running. The user opened both AWS links in their browser and confirmed the API returned `{"status":"ok"}`. On AWS, the user registered/used a test account and confirmed that **Frontend Developer** remained selected after logging out and back in, demonstrating persisted per-user state. On Render, the user independently verified the same selection persisted after a page refresh and re-login.

**Scope of proof:** These are user-reported live verification steps and screenshot observations during the walkthrough, **not** a repeatable synthetic uptime monitor, restart-persistence test, formal performance test, or validated production SLA. A `CREATE_COMPLETE` stack by itself is insufficient; the separate runtime checks above were performed.

## Architecture and how this maps to the assignment

| Requirement | Actual implementation |
|---|---|
| One frontend+backend image | Root `Dockerfile` builds React and serves static assets with FastAPI |
| PostgreSQL schema | SQLAlchemy and Alembic migrations in `backend/` |
| Local app + database | `compose.yaml` and persistent Postgres Docker volume |
| Feature-separated browser E2E | `frontend/e2e/features/01...10...spec.ts`; labeled GitHub Issues #57–66 |
| Full-stack tests | `.github/workflows/fullstack-ci.yml` runs frontend, backend, Compose/PostgreSQL, integration and Playwright suites |
| Hosted first provider | Render Docker web service + **separately managed** PostgreSQL (Render does not execute the entire Compose file) |
| AWS infrastructure-as-code | `cloud/aws/cloudformation.yaml`, with `AllowCreation` and `ConfirmCreditUsage` safety gates |
| AWS Compose deployment | `cloud/aws/compose.aws.yaml`: app, private Postgres, HTTPS Caddy on a single EC2 |
| Container publication | `.github/workflows/publish-aws-image.yml` publishes `ghcr.io/nurdauleterbool/devatlas:latest` following successful full-stack checks |

## GitHub evidence (live workflow links)

- [Full-stack PostgreSQL and Compose CI/CD (successful, commit `bf56068`)](https://github.com/Nurdauleterbool/devatlas/actions/runs/41578525064)
- [AWS CloudFormation and Compose validation (successful, commit `bf56068`)](https://github.com/Nurdauleterbool/devatlas/actions/runs/41578524802)
- [GHCR publication (successful; Docker build-push succeeded)](https://github.com/Nurdauleterbool/devatlas/actions/runs/41578956369)
- [Render initial deploy timeout fix, PR #69](https://github.com/Nurdauleterbool/devatlas/pull/69)
- [AWS Compose/CloudFormation implementation, PR #70](https://github.com/Nurdauleterbool/devatlas/pull/70)
- [Amazon Linux 2023 bootstrap fix, PR #71](https://github.com/Nurdauleterbool/devatlas/pull/71)

Render was manually deployed successfully on commit `ed66bc9` after the original `7244d87` attempt timed out; its dashboard showed `Live`. Render Settings shows **Auto-Deploy: After CI Checks Pass**, but the assignment should **not** claim this behavior was demonstrated on a new commit until the resulting automatic Render deploy is checked.

AWS `CREATE_COMPLETE` occurred before containers were healthy. EC2 user-data originally failed to install Docker because Amazon Linux 2023 includes `curl-minimal`, which conflicted with full `curl`. The user restored the *existing instance* via Session Manager, installed Docker, cloned the repo and launched `bootstrap.sh`; the underlying source fix and a regression CI guard were merged in PR #71. A clean-from-scratch AWS boot with the corrected template **has not been repeated**, and must not be claimed as tested.

## What is still to verify

- [x] Render public HTTPS and DB-backed user selection after re-login (reported by user)
- [x] AWS CloudFormation `CREATE_COMPLETE`
- [x] AWS Docker Compose with healthy app and PostgreSQL, running HTTPS proxy
- [x] AWS public HTTPS `/api/v1/health` returns `{"status":"ok"}` (reported by user)
- [x] AWS DB-backed selection retained after logout/login (reported by user)
- [ ] Verify Render automatic redeployment happens after new commits pass CI
- [ ] Implement and **verify automatic AWS redeployment** when CI publishes a new GHCR image; current EC2 Compose stack does **not** update itself automatically
- [ ] Verify restart/EC2 reboot persistence and implement a backup strategy for any non-disposable data
- [ ] Manual QA signoff and attach **actual**, suitably redacted AWS/Render screenshots to Issue #56
- [ ] Evaluate whether the course requires managed HA/production hardening (one t3.micro is a single-point-of-failure educational demo)

## Free Plan, resource cleanup, security

The AWS account was shown as **Free Plan with $100 promotional credits** prior to launching. A live EC2 t3.micro, 16-GB EBS volume and allocated Elastic IPv4 **consume credits while allocated**. If no longer needed, export any data you need, delete stack `devatlas-aws` in CloudFormation, verify removal of EC2, EBS and EIP, and review Billing usage. Deleting the stack **destroys the PostgreSQL data stored on the EC2 root disk**. Merely stopping the server is not sufficient to eliminate all charges.

No production credentials, CloudFormation stack internal identifiers, billing account data, or screenshot attachments are included in this Markdown file. Do not paste database secrets into Issues or screenshots. AWS is a class demo, not a high-availability production-grade deployment.
