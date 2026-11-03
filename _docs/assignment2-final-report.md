# DevAtlas — Assignment 2: Test, Containerise and Deploy

**Report date:** 3 November 2026  
**Repository:** https://github.com/Nurdauleterbool/devatlas  
**Submission:** GitHub repository, technical report, GitHub Issues, test runs and deployment evidence.

## 1. Executive summary
DevAtlas is a full-stack application designed to help IT students choose a career, explore skill prerequisites, pass practice quizzes and track progress. Assignment 2 extended the application with containerisation, PostgreSQL, Docker Compose, feature-separated Playwright E2E tests, continuous integration, and cloud deployments to Render and AWS.

**Accuracy note:** Post-merge AWS automated deployment was successful in GitHub Actions for commit `2e87b5f`, including OIDC, SSM and health-check steps. A manual persisted-user-data recheck after the rollout is still outstanding.

## 2. Technology stack and architecture
- **Frontend:** React, TypeScript and Vite; compiled to static assets.
- **Backend:** FastAPI serving the API and production frontend.
- **Database:** PostgreSQL through SQLAlchemy/Alembic in Compose and cloud; SQLite remains available for local development and tests.
- **Application container:** a single multi-stage Dockerfile builds the frontend and runs the backend.
- **Docker Compose:** application + private PostgreSQL + persistent volume.
- **AWS:** CloudFormation provisions one EC2; Compose manages FastAPI/React, private PostgreSQL and Caddy HTTPS.
- **Render:** Docker web service with *separate managed PostgreSQL*. Render does not execute the complete Compose file.
- **CI/CD:** GitHub Actions, GHCR container publishing, GitHub OIDC and AWS Systems Manager deployment workflow.

## 3. Implementation and test evidence

| Requirement | Result |
| --- | --- |
| Single frontend/backend Dockerfile | Implemented |
| PostgreSQL migration and Compose | Implemented and exercised in integration CI |
| Feature-specific Playwright E2E tests | Implemented, tracked in GitHub Issues with `e2e-test` |
| Frontend unit tests | 238/238 Vitest tests reported passed in PR #74 screenshot |
| Backend and integration tests | Successful PR #74 full-stack CI |
| Render deployment | Public HTTPS available; user confirmed persisted career selection after refresh/re-login |
| AWS CloudFormation deployment | EC2 + app + PostgreSQL + Caddy running; user confirmed API health and account persistence |
| Database backup | Root-only SQL dump `/root/devatlas-backup.sql` created on EC2 (41 KB); **off-host copy not verified** |
| Main-branch AWS auto-deploy | **Success** in run 41588539895, following successful CI and GHCR publication; manual account-state recheck pending |

## 4. CI/CD workflow
1. Push to `main` triggers `.github/workflows/fullstack-ci.yml`: frontend build, lint, Vitest, backend pytest, real PostgreSQL integration and Playwright E2E.
2. When full-stack CI succeeds, `.github/workflows/publish-aws-image.yml` publishes a GHCR image with a commit-SHA tag.
3. `.github/workflows/deploy-aws.yml` is configured to take temporary GitHub OIDC AWS credentials, issue AWS SSM commands on the existing EC2 and update only the application service with the built image.
4. Deployment checks the HTTPS API health endpoint. The workflow attempts to restore the previous app image setting on failure. A real rollback drill and successful live rollout remain unverified.

The successful **main-branch deployment** is evidenced by the CI, GHCR and AWS workflow runs listed below.

## 5. Cloud verification
- **Render:** https://devatlas-z0e0.onrender.com
- **AWS HTTPS:** https://54.89.51.192.sslip.io
- **AWS API health:** https://54.89.51.192.sslip.io/api/v1/health

During the walkthrough, the user verified the AWS API returned `{"status":"ok"}`, and the selected Frontend Developer career remained after logout/login. Those checks show an accessible app and DB-backed state, but are not high-availability, reboot or disaster-recovery proof.

## 6. Security, reliability and resource management
- App and database ports stay private behind Caddy HTTPS on AWS.
- GitHub OIDC avoids storing permanent AWS access keys in the repository.
- A constrained IAM role and SSM are used instead of public SSH.
- The PostgreSQL dump must also be securely stored **outside EC2**, with restore testing if required.
- The single EC2 is an educational deployment, not high-availability production infrastructure.
- EC2, EBS and allocated public IPv4 use AWS promotional credits. Billing must be monitored; unused infrastructure should be removed through CloudFormation only after data is backed up.

## 7. Outstanding acceptance checks
- [x] Post-merge CI succeeded for commit `2e87b5f113a6df114eb5de643ce0aef98e3dc547`.
- [x] GHCR publish and AWS auto-deploy both succeeded for the **same commit**.
- [ ] Manually recheck the live AWS API, login and saved career/progress after redeployment.
- [ ] Verify final IAM Trust Policy and GitHub repository Variables.
- [ ] Preserve a securely stored database backup outside the EC2 host.
- [ ] Attach redacted screenshots, complete final QA and close Issues #73 and #56 only after evidence.

## 8. Links to reproducible evidence
- [Repository](https://github.com/Nurdauleterbool/devatlas)
- [Existing live deployment evidence](assignment-deployment-evidence.md)
- [PR #74 — AWS automatic deployment](https://github.com/Nurdauleterbool/devatlas/pull/74)
- [Successful full-stack CI for PR #74](https://github.com/Nurdauleterbool/devatlas/actions/runs/41587130001)
- [Main CI after merge — Success](https://github.com/Nurdauleterbool/devatlas/actions/runs/41587941810)
- [GHCR image publish after merge — Success](https://github.com/Nurdauleterbool/devatlas/actions/runs/41588458865)
- [AWS deployment after merge — Success](https://github.com/Nurdauleterbool/devatlas/actions/runs/41588539895)
- [AWS auto-deploy tracking Issue #73](https://github.com/Nurdauleterbool/devatlas/issues/73)
- [Submission and QA evidence Issue #56](https://github.com/Nurdauleterbool/devatlas/issues/56)
- [CloudFormation and Compose](../cloud/aws/README.md)

## 9. Conclusion
DevAtlas has implemented the core requirements for containerisation, PostgreSQL, end-to-end testing, continuous integration and two hosted deployments. The AWS automated deployment completed successfully after merge, including AWS credential configuration, SSM deployment and health-check steps. Final manual account-data verification and an off-host backup remain before submission sign-off. The repository links actual source code, CI records, infrastructure-as-code and GitHub Issues rather than unverified claims.
