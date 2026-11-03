#!/usr/bin/env bash
# EC2 bootstrap for DevAtlas; run as root after cloning the GitHub repo.
set -euo pipefail

if [ "$#" -ne 1 ] || [[ ! "$1" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Usage: bootstrap.sh <allocated IPv4>" >&2
  exit 2
fi

export HOME=/root
cd /opt/devatlas
systemctl enable --now docker
install -d -m 0755 /usr/local/lib/docker/cli-plugins

# Pinned Compose release from official GitHub. Manual installs need maintenance.
curl --fail --location --silent --show-error \
  --retry 10 --retry-delay 10 \
  https://github.com/docker/compose/releases/download/v5.6.1/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod 0755 /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version

# Secrets are created on EC2, not in GitHub, CloudFormation, or instance UserData.
umask 077
if [ ! -f /opt/devatlas/.env.aws ]; then
  printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > /opt/devatlas/.env.aws
fi
sed -i '/^APP_IMAGE=/d; /^DOMAIN=/d' /opt/devatlas/.env.aws
printf 'APP_IMAGE=ghcr.io/nurdauleterbool/devatlas:latest\n' >> /opt/devatlas/.env.aws
printf 'DOMAIN=%s.sslip.io\n' "$1" >> /opt/devatlas/.env.aws
chmod 0600 /opt/devatlas/.env.aws

# The image package MUST be marked public in GitHub Packages before this step.
# Pull first on the small EC2 machine; it cannot safely compile the Node image.
docker compose --env-file /opt/devatlas/.env.aws -f cloud/aws/compose.aws.yaml pull
docker compose --env-file /opt/devatlas/.env.aws -f cloud/aws/compose.aws.yaml up -d --no-build
echo "DevAtlas containers launched; inspect: docker compose -f /opt/devatlas/cloud/aws/compose.aws.yaml ps"
