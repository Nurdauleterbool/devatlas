# Development-only AWS deployment: IAM setup

**Account:** `645023698537` · **Region:** `us-east-1`

| Purpose | ID |
|---|---|
| Development EC2 (ONLY SSM write target) | `i-02e00d28cf030334d` |
| Production EC2 (**DO NOT ALTER**) | `i-04c0e9c7e74eaba84` |
| Development OIDC role | `DevAtlasGitHubDevelopmentRole` |
| Existing Production OIDC role (**DO NOT ALTER**) | `DevAtlasGitHubDeployRole` |

A separate Development GitHub OIDC role was created with branch-bound trust:
`repo:Nurdauleterbool/devatlas:ref:refs/heads/main`, audience
`sts.amazonaws.com`. The IAM inline permission is intentionally separated
to prevent access to Production. There is no need to change Production IAM.

## Apply exact Development-only inline policy

Run **from the owner's AWS CloudShell** (us-east-1) after confirming identity:

```bash
set -euo pipefail
test "$(aws sts get-caller-identity --query Account --output text)" = "645023698537"
curl -fsSL https://raw.githubusercontent.com/Nurdauleterbool/devatlas/main/cloud/aws/development-ssm-policy.json -o /tmp/devatlas-development-ssm-policy.json
python3 -m json.tool /tmp/devatlas-development-ssm-policy.json >/dev/null
aws iam put-role-policy \
  --role-name DevAtlasGitHubDevelopmentRole \
  --policy-name DevAtlasDevelopmentSSMOnly \
  --policy-document file:///tmp/devatlas-development-ssm-policy.json
aws iam get-role-policy \
  --role-name DevAtlasGitHubDevelopmentRole \
  --policy-name DevAtlasDevelopmentSSMOnly \
  --query PolicyDocument --output json
```

**Do not execute this until the policy file is merged to `main`.** The GitHub
branch version is used for code review before merging. The policy permits only
`ssm:SendCommand` on Development EC2 and the `AWS-RunShellScript` document,
with minimal command-result read permissions. No `iam:*`, `ec2:*`, and no
`ssm:SendCommand` on Production.

## Automatic Development Deploy

Workflow `.github/workflows/deploy-aws.yml` checks successful image publishing
from `main`, assumes **only** `DevAtlasGitHubDevelopmentRole`, targets the
Development EC2, sets `DEVATLAS_ENVIRONMENT=development`, deploys the
immutable image SHA, tests HTTPS health and attempts rollback on failure.

The job intentionally does not use a GitHub `environment:` context because
the role's OIDC trust permits **only a `ref:refs/heads/main` subject**.
Setting `environment: development` requires updating the IAM OIDC trust to
an exact `environment:development` subject, and should not be done
without adjusting the role first.

**Never** use the Development role to promote to Production. The manual
`promote-production.yml` is separate and must still require a deliberate
user approval/review before use.

## Quick read-only verification

```bash
aws ssm describe-instance-information \
  --region us-east-1 \
  --filters Key=InstanceIds,Values=i-02e00d28cf030334d \
  --query 'InstanceInformationList[].PingStatus'
```

When the policy is attached, merge the approved deploy workflow change and
observe **Publish DevAtlas container for AWS** followed by
**Deploy DevAtlas to AWS development (after CI)** on GitHub Actions. Production
promotion is never triggered automatically.
