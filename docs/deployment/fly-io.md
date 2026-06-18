# Deploy BabyChain on Fly.io

Fly.io runs BabyChain from the production `Dockerfile` in this starter. Use this guide when you want a long-running Docker deployment with Fly-managed TLS and regional placement.

## Prerequisites

- A Fly.io account and the `flyctl` CLI installed.
- A reachable PostgreSQL database, preferably Aurora/RDS for production.
- BabyChain schema applied with `pnpm run aurora:migrate` against `DATABASE_URL`.
- BYOK provider credentials. Default deployments use `BABYCHAIN_PROVIDER_MODE=byok`, so set all inference provider keys in the order shown below.
- Optional BabySea credentials only if you switch `BABYCHAIN_PROVIDER_MODE` to `babysea`.
- A public app URL selected before the first build, for example `https://babychain.fly.dev` or a custom domain.

### 1. Create the Fly app

From this starter directory:

```bash
fly launch --no-deploy --copy-config --name babychain
```

The starter includes `fly.toml` with:

- `internal_port = 3000`
- `force_https = true`
- `min_machines_running = 1`
- `auto_stop_machines = false`

Change `app` and `primary_region` in `fly.toml` before deploying if you want a different app name or region.

### 2. Set runtime secrets

Set the values BabyChain reads at runtime. Keep secrets in Fly; do not commit them.

```bash
fly secrets set \
  NEXT_PUBLIC_SITE_URL="https://babychain.fly.dev" \
  OWNER_EMAIL="owner@example.com" \
  OWNER_PASSWORD="YOUR_OWNER_PASSWORD" \
  OWNER_SESSION_SECRET="YOUR_OWNER_SESSION_SECRET" \
  DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" \
  BABYCHAIN_API_KEY="YOUR_BABYCHAIN_API_KEY" \
  BABYCHAIN_CRON_SECRET="YOUR_BABYCHAIN_CRON_SECRET" \
  BABYCHAIN_CALLBACK_SECRET="YOUR_BABYCHAIN_CALLBACK_SECRET" \
  BABYCHAIN_PROVIDER_MODE="byok" \
  DASHSCOPE_API_KEY="YOUR_DASHSCOPE_API_KEY" \
  BFL_API_KEY="YOUR_BFL_API_KEY" \
  BFL_REGION="global" \
  BFL_API_BASE_URL="https://api.bfl.ai/v1" \
  ARK_API_KEY="YOUR_ARK_API_KEY" \
  GEMINI_API_KEY="YOUR_GEMINI_API_KEY" \
  OPENAI_API_KEY="YOUR_OPENAI_API_KEY" \
  RUNWAYML_API_SECRET="YOUR_RUNWAY_API_KEY" \
  BABYSEA_API_KEY="YOUR_BABYSEA_API_KEY_OR_PLACEHOLDER" \
  BABYSEA_REGION="us" \
  BABYSEA_API_BASE_URL="https://api.us.babysea.ai" \
  BABYSEA_WEBHOOK_SECRET="YOUR_BABYSEA_WEBHOOK_SECRET_OR_PLACEHOLDER" \
  NEXT_PUBLIC_SENTRY_DSN="" \
  NEXT_PUBLIC_SENTRY_ENVIRONMENT="production" \
  SENTRY_ORG="YOUR_SENTRY_ORG" \
  SENTRY_PROJECT="YOUR_SENTRY_PROJECT"
```

The BabySea and Sentry values can be placeholders when you stay in BYOK mode and do not upload source maps. Keep `SENTRY_AUTH_TOKEN` in CI or your build environment only when you intentionally upload source maps; it is not needed by the running container. For BabySea mode, change `BABYCHAIN_PROVIDER_MODE` to `babysea` and replace the BabySea placeholders with real values.

### 3. Deploy with build args

Next.js bakes public variables into the build, so pass the public URL during `fly deploy` too.

```bash
fly deploy \
  --build-arg NEXT_PUBLIC_SITE_URL="https://babychain.fly.dev" \
  --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT="production"
```

If you use a custom domain, update the secret and redeploy with the same URL:

```bash
fly certs add your-app.example.com
fly secrets set NEXT_PUBLIC_SITE_URL="https://your-domain.example.com"
fly deploy \
  --build-arg NEXT_PUBLIC_SITE_URL="https://your-domain.example.com"
```

### 4. Schedule run recovery

BabyChain processes runs immediately after creation, but non-Vercel hosts still need a periodic recovery call for interrupted or queued work.

Use an external scheduler that can send an HTTP header every 1 to 5 minutes:

```bash
curl -fsS \
  -H "Authorization: Bearer YOUR_BABYCHAIN_CRON_SECRET" \
  "https://babychain.fly.dev/api/cron/process-runs?limit=5"
```

Set the schedule to every minute for high-volume deployments, or every five minutes for low-volume deployments. The route is idempotent and only processes eligible pending runs.

### 5. Verify the deployment

```bash
fly status
fly logs
curl -fsS \
  -H "Authorization: Bearer YOUR_BABYCHAIN_API_KEY" \
  https://babychain.fly.dev/api/v1/models
```

To validate locally before deploying:

```bash
pnpm run doctor
```

## Troubleshooting

- If the app starts but the browser shows stale public URLs, redeploy with the correct `NEXT_PUBLIC_SITE_URL` build arg.
- If run creation works but processing stalls, check the external scheduler and `BABYCHAIN_CRON_SECRET` header.
- If provider calls fail, confirm `BABYCHAIN_PROVIDER_MODE` matches the provider secrets you set.
- If machines stop between requests, keep `auto_stop_machines = false` and `min_machines_running = 1` in `fly.toml`.
