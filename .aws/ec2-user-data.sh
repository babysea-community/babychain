#!/bin/bash
set -euo pipefail
umask 077

BABYCHAIN_IMAGE_URI="__BABYCHAIN_IMAGE_URI__"
BABYCHAIN_PARAMETER_PREFIX="__BABYCHAIN_PARAMETER_PREFIX__"
BABYCHAIN_SITE_URL="__BABYCHAIN_SITE_URL__"
BABYCHAIN_AWS_REGION="__BABYCHAIN_AWS_REGION__"
BABYCHAIN_CONTAINER_PORT="${BABYCHAIN_CONTAINER_PORT:-3000}"
BABYCHAIN_HOST_PORT="${BABYCHAIN_HOST_PORT:-80}"

log() {
  printf '[babychain-ec2] %s\n' "$*"
}

if [[ "$BABYCHAIN_IMAGE_URI" == "__BABYCHAIN_IMAGE_URI__" ]] || \
  [[ "$BABYCHAIN_PARAMETER_PREFIX" == "__BABYCHAIN_PARAMETER_PREFIX__" ]] || \
  [[ "$BABYCHAIN_SITE_URL" == "__BABYCHAIN_SITE_URL__" ]] || \
  [[ "$BABYCHAIN_AWS_REGION" == "__BABYCHAIN_AWS_REGION__" ]]; then
  log 'Render .aws/ec2-user-data.sh placeholders before passing it to EC2 user data.'
  exit 1
fi

BABYCHAIN_PARAMETER_PREFIX="${BABYCHAIN_PARAMETER_PREFIX%/}"
BABYCHAIN_HOME=/opt/babychain
BABYCHAIN_ENV_FILE="$BABYCHAIN_HOME/babychain.env"
BABYCHAIN_ENV_TMP="$BABYCHAIN_HOME/babychain.env.tmp"
BABYCHAIN_PARAMETERS_FILE="$BABYCHAIN_HOME/parameters.json"

cleanup_temp_files() {
  rm -f "$BABYCHAIN_ENV_TMP" "$BABYCHAIN_PARAMETERS_FILE"
}

trap cleanup_temp_files EXIT

log 'Installing runtime packages.'
dnf update -y
dnf install -y awscli curl docker jq

log 'Starting Docker.'
systemctl enable --now docker

install -d -m 0700 "$BABYCHAIN_HOME"

log 'Loading BabyChain parameters from AWS Systems Manager Parameter Store.'
aws ssm get-parameters-by-path \
  --region "$BABYCHAIN_AWS_REGION" \
  --path "$BABYCHAIN_PARAMETER_PREFIX" \
  --with-decryption \
  --recursive \
  --output json >"$BABYCHAIN_PARAMETERS_FILE"

if jq -e '.Parameters[] | select(.Value | test("[\\r\\n]"))' \
  "$BABYCHAIN_PARAMETERS_FILE" >/dev/null; then
  log 'SSM parameters for EC2 must be single-line values. Use comma-separated API keys.'
  exit 1
fi

jq -r '.Parameters[] | "\(.Name | split("/")[-1])=\(.Value)"' \
  "$BABYCHAIN_PARAMETERS_FILE" >"$BABYCHAIN_ENV_TMP"

parameter_value() {
  local key="$1"
  awk -F= -v key="$key" \
    '$1 == key { sub(/^[^=]*=/, ""); print; found=1; exit } END { if (!found) exit 1 }' \
    "$BABYCHAIN_ENV_TMP"
}

write_env_value() {
  local key="$1"
  local value="$2"
  printf '%s=%s\n' "$key" "$value" >>"$BABYCHAIN_ENV_FILE"
}

write_parameter_value() {
  local key="$1"
  local default_value="${2:-}"
  local value

  value="$(parameter_value "$key" || true)"
  write_env_value "$key" "${value:-$default_value}"
}

: >"$BABYCHAIN_ENV_FILE"
write_env_value NEXT_PUBLIC_SITE_URL "$BABYCHAIN_SITE_URL"
write_parameter_value OWNER_EMAIL
write_parameter_value OWNER_PASSWORD
write_parameter_value OWNER_SESSION_SECRET
write_parameter_value DATABASE_URL
write_parameter_value BABYCHAIN_API_KEY
write_parameter_value BABYCHAIN_CRON_SECRET
write_parameter_value BABYCHAIN_CALLBACK_SECRET
write_parameter_value BABYCHAIN_PROVIDER_MODE byok
write_parameter_value DASHSCOPE_API_KEY
write_parameter_value BFL_API_KEY
write_parameter_value BFL_REGION global
write_parameter_value BFL_API_BASE_URL https://api.bfl.ai/v1
write_parameter_value ARK_API_KEY
write_parameter_value GEMINI_API_KEY
write_parameter_value OPENAI_API_KEY
write_parameter_value RUNWAYML_API_SECRET
write_parameter_value BABYSEA_API_KEY
write_parameter_value BABYSEA_REGION us
write_parameter_value BABYSEA_API_BASE_URL https://api.us.babysea.ai
write_parameter_value BABYSEA_WEBHOOK_SECRET
write_parameter_value NEXT_PUBLIC_SENTRY_DSN
write_parameter_value NEXT_PUBLIC_SENTRY_ENVIRONMENT production
write_parameter_value SENTRY_ORG
write_parameter_value SENTRY_PROJECT
write_env_value HOSTNAME 0.0.0.0
write_env_value PORT "$BABYCHAIN_CONTAINER_PORT"
write_env_value NODE_ENV production

chmod 0600 "$BABYCHAIN_ENV_FILE"
cleanup_temp_files

env_value() {
  local key="$1"
  awk -F= -v key="$key" \
    '$1 == key { sub(/^[^=]*=/, ""); print; found=1; exit } END { if (!found) exit 1 }' \
    "$BABYCHAIN_ENV_FILE"
}

require_env_value() {
  local key="$1"
  local value

  if ! value="$(env_value "$key")" || [[ -z "$value" ]]; then
    log "Missing required SSM parameter $BABYCHAIN_PARAMETER_PREFIX/$key."
    exit 1
  fi
}

for required_name in \
  OWNER_EMAIL \
  OWNER_PASSWORD \
  OWNER_SESSION_SECRET \
  DATABASE_URL \
  BABYCHAIN_API_KEY \
  BABYCHAIN_CRON_SECRET \
  BABYCHAIN_CALLBACK_SECRET; do
  require_env_value "$required_name"
done

provider_mode="$(env_value BABYCHAIN_PROVIDER_MODE || true)"
provider_mode="${provider_mode:-byok}"

case "$provider_mode" in
  byok)
    require_env_value DASHSCOPE_API_KEY
    require_env_value BFL_API_KEY
    require_env_value ARK_API_KEY
    require_env_value GEMINI_API_KEY
    require_env_value OPENAI_API_KEY
    require_env_value RUNWAYML_API_SECRET
    ;;
  babysea)
    require_env_value BABYSEA_API_KEY
    require_env_value BABYSEA_API_BASE_URL
    ;;
  *)
    log "Unsupported BABYCHAIN_PROVIDER_MODE: $provider_mode."
    exit 1
    ;;
esac

registry="${BABYCHAIN_IMAGE_URI%%/*}"
if [[ "$registry" == *.dkr.ecr.*.amazonaws.com ]]; then
  log "Logging in to ECR registry $registry."
  aws ecr get-login-password --region "$BABYCHAIN_AWS_REGION" | \
    docker login --username AWS --password-stdin "$registry"
fi

log "Pulling $BABYCHAIN_IMAGE_URI."
docker pull "$BABYCHAIN_IMAGE_URI"

docker rm -f babychain >/dev/null 2>&1 || true

log 'Starting BabyChain container.'
docker run \
  --detach \
  --name babychain \
  --restart unless-stopped \
  --env-file "$BABYCHAIN_ENV_FILE" \
  --publish "$BABYCHAIN_HOST_PORT:$BABYCHAIN_CONTAINER_PORT" \
  "$BABYCHAIN_IMAGE_URI"

cat >"$BABYCHAIN_HOME/process-runs.sh" <<SCRIPT
#!/bin/bash
set -euo pipefail

ENV_FILE=$BABYCHAIN_ENV_FILE
CRON_SECRET="\$(awk -F= '\$1 == "BABYCHAIN_CRON_SECRET" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")"
CRON_LIMIT="\$(awk -F= '\$1 == "BABYCHAIN_CRON_LIMIT" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")"
CRON_LIMIT="\${CRON_LIMIT:-5}"

if [[ -z "\$CRON_SECRET" ]]; then
  echo 'BABYCHAIN_CRON_SECRET is missing from the EC2 env file.' >&2
  exit 1
fi

curl -fsS \
  -H "Authorization: Bearer \$CRON_SECRET" \
  "http://127.0.0.1:$BABYCHAIN_HOST_PORT/api/cron/process-runs?limit=\$CRON_LIMIT"
SCRIPT

chmod 0755 "$BABYCHAIN_HOME/process-runs.sh"

cat >/etc/systemd/system/babychain-cron.service <<'UNIT'
[Unit]
Description=Run BabyChain queued-run recovery once
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/babychain/process-runs.sh
UNIT

cat >/etc/systemd/system/babychain-cron.timer <<'UNIT'
[Unit]
Description=Run BabyChain queued-run recovery every five minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=30s
Unit=babychain-cron.service

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now babychain-cron.timer

log 'BabyChain EC2 bootstrap complete.'
