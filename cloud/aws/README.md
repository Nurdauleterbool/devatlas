# DevAtlas on AWS — CloudFormation + Docker Compose

This is **classroom infrastructure-as-code**, not a confirmed live AWS
deployment or a highly available commercial production system.

## Architecture

One small EC2 instance hosts a Compose stack:

- Caddy HTTPS reverse proxy: public ports 80 and 443 only
- FastAPI + built React: private port 10000, image pulled from GHCR
- PostgreSQL: private container network, Docker named volume

No SSH port or public database port is exposed. EC2 uses IAM Session Manager
for diagnostic access. The CloudFormation stack creates **one EC2**, **one
16 GB gp3 EBS root volume**, **one Elastic IPv4**, a security group,
and an instance role/profile, only after explicit confirmation.

Data is stored on the instance root disk, not in a managed multi-zone DB.
**Removing the stack, replacing the instance, or losing that disk can destroy
data. Back up data before deletion.** No RDS, load balancer, NAT gateway,
autoscaling, or high-cost managed services are used.

## Free Plan and safety gates

Check account eligibility, remaining credits, and rates in the **AWS Billing
and Cost Management** console first. New AWS Free Plan accounts can have
initial $100 credit, with up to another $100 earned from eligible activities,
and end after 6 months or credit exhaustion. This is **not** an unlimited
free EC2 server. Elastic IPv4 is separately metered, and EC2/EBS consume
credits. Never choose Paid plan or activate paid upgrades just to finish the
course assignment.

If account or identity verification asks for permission you do not have,
use an authorized school or guardian-managed AWS account rather than trying
to bypass it.

The CloudFormation template has **four resource-creation prerequisites**:
`AllowCreation=yes`, `ConfirmCreditUsage=yes`, a reviewed `VpcId`, and a
reviewed **public** `SubnetId`. Defaults are **no, no, empty, empty**, so
the template does not provision EC2 by default. It is safe to review as code.
Creating the stack may require IAM `CAPABILITY_IAM` acknowledgment.

**Do not create a real stack until a full cost review and explicit authorization.**

## Preparation before a live launch

1. Verify GitHub Actions `Publish DevAtlas container for AWS` succeeded on
   the latest `main` commit (only runs after Full-stack CI passes).
2. Open the package associated with
   `ghcr.io/nurdauleterbool/devatlas` on GitHub. GitHub packages are private
   by default. Make it **public** if you intend your EC2 host to download it
   without credentials. Public visibility cannot be reversed.
3. In AWS, make sure the account is **Free Plan**, not Paid Plan, and has
   adequate credit remaining. No AWS credentials are needed in GitHub to use
   this template; never put secret keys in GitHub or chat.
4. Review the VPC and public subnet: it must have an Internet Gateway,
   outbound route and public IPv4 access. `us-east-1` is an example region;
   resource availability and rates depend on region.

## Preview template without provisioning

```bash
python -m pip install 'cfn-lint>=1.0,<2'
cfn-lint cloud/aws/cloudformation.yaml
bash -n cloud/aws/bootstrap.sh
POSTGRES_PASSWORD=ci-demo APP_IMAGE=ghcr.io/nurdauleterbool/devatlas:latest DOMAIN=198.51.100.10.sslip.io \
  docker compose -f cloud/aws/compose.aws.yaml config --quiet
```

## Live deployment — only when permitted and reviewed

Use AWS Console → **CloudFormation** → **Create stack** → **With new
resources** → **Upload a template file**, then select
`cloud/aws/cloudformation.yaml`. Select an appropriate VPC and public subnet.
**Leave both creation switches at `no` until the Free Plan and costs are
verified**. To provision, both switches must be `yes` and valid VPC/subnet
parameters must be supplied. Review the resource list and acknowledge
IAM permissions. There is no reason to deploy if you do not have eligible
AWS account access.

If the stack has provisioned successfully, find the HTTPS address in
**Outputs → DemoURL**. The name uses the Elastic IP plus the independent
`sslip.io` DNS service; Caddy requests TLS via a public CA. TLS issuance,
DNS and user-data execution can fail independently of CloudFormation's
`CREATE_COMPLETE` status. Verify `/api/v1/health`, then signup, learning,
quiz, refresh and logout/login.

**For production:** use your own domain, monitored backups, managed secrets,
image pinning, recovery/patching plan, resource alerting and preferably a
managed HA database; this template is a class demonstration, not SLA-grade
hosting.

## Amazon Linux 2023 first-boot recovery

If the CloudFormation stack reaches `CREATE_COMPLETE` but HTTPS shows
`ERR_CONNECTION_REFUSED`, inspect EC2 Session Manager →
`sudo tail -n 80 /var/log/cloud-init-output.log`. In the original template,
`dnf install docker git curl openssl` conflicted with the default Amazon Linux
2023 `curl-minimal`. Current template omits the unnecessary full `curl` package.

To recover the **existing** EC2 instance safely, run these commands in EC2
Session Manager (do not recreate the stack):

```bash
sudo dnf install -y docker git openssl
sudo systemctl enable --now docker
sudo docker --version
# A failed cloud-init at dnf has not cloned the repo yet:
sudo git clone --branch main --depth 1 https://github.com/Nurdauleterbool/devatlas.git /opt/devatlas
sudo bash /opt/devatlas/cloud/aws/bootstrap.sh 54.89.51.192
sudo docker ps -a
```

Replace the IP with the stack's `DemoURL` IP if different. If the clone reports
that the directory already exists, inspect it first rather than deleting data.
The bootstrap creates `/opt/devatlas/.env.aws` with a private database password;
never paste this file into chat or commit it. If launch fails, inspect Docker
status and logs and keep the stack intact while debugging.

## Operations, troubleshooting and teardown

- View CloudFormation `Events` and `Outputs`, and EC2 instance status.
- Via authorized AWS Session Manager access, check
  `/var/log/cloud-init-output.log`, `docker compose -f
  /opt/devatlas/cloud/aws/compose.aws.yaml ps`, and Caddy logs.
- Never paste `/opt/devatlas/.env.aws`, passwords or connection strings
  into GitHub issues or chat. The PostgreSQL password is generated locally
  on EC2 and stored in a root-only file.
- Stop/restart the instance only when needed; a stopped instance can still
  have EBS and allocated IPv4 costs.
- To stop credit consumption, export any data you need, **Delete Stack**
  through CloudFormation, confirm that EC2, EBS, Elastic IP, security group,
  and IAM resources are actually removed, and inspect billing usage.
- Delete the stack when the classroom demonstration is over. Do not assume
  AWS Credits or a stop action makes resources permanently free.

Evidence for Issue #55: link this CloudFormation template, the AWS IaC
validation workflow, and (if actually authorized/deployed) the AWS stack
Outputs and HTTPS `/api/v1/health` screenshot. Never claim deployment
based on passing local CI alone.
