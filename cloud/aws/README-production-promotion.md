# Production promotion — manual only

**IMPORTANT:** The production EC2 is not touched by GitHub CI or code merges.
The production update can run **only when a person explicitly launches**
Actions → **Promote verified development image to production** → Run workflow,
from branch `main`.

It requires TWO human-supplied inputs:

- `release_sha`: exact 40-character commit SHA currently deployed on Development.
- `confirm_production`: exact phrase `PROMOTE_TO_PRODUCTION`.

Workflow order: **preflight → production approval → promote**.

1. **Preflight** uses the Development-only OIDC role
   `arn:aws:iam::645023698537:role/DevAtlasGitHubDevelopmentRole` and
   verifies the exact candidate image on Development EC2
   `i-02e00d28cf030334d`, without changing the instance.
2. **Approval** uses the GitHub `production` Environment. Repository
   owners should configure `Settings → Environments → production →
   Required reviewers` if their plan supports approval protection.
   Without required reviewers, the step by itself is NOT a human approval;
   the workflow still requires manual dispatch and confirmation phrase.
3. **Promote** uses **only** the Production OIDC role
   `arn:aws:iam::645023698537:role/DevAtlasGitHubDeployRole`,
   whose `ssm:SendCommand` access is constrained to Production EC2
   `i-04c0e9c7e74eaba84`. The job intentionally has no
   `environment:` attribute because the IAM trust condition is pinned
   to the exact GitHub `main` **ref** OIDC subject, not an environment sub.
4. It saves `.env.aws.rollback` before changing the immutable image SHA,
   checks HTTPS health, and attempts to restore the previous configuration
   and container if an error occurs. This rollback cannot automatically
   reverse database schema migrations or recover lost data.

The workflow is NOT run as part of CI; test workflows
`production-promotion-safety-ci.yml` merely parse its scripts and assert
safe target selection. No Production deployment has been tested or
authorized in this assignment session.

**Before any real Production promotion** obtain an explicit owner approval,
a database backup, plan for database compatibility, and verify the
production GitHub Environment reviewer protection settings. Do not use
this workflow as a substitute for a full change-management review.
