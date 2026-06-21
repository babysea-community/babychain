# BabyChain

BabyChain is a self-hosted canvas studio and durable HTTP API for chaining image and video generation models. Design image-to-video workflows visually, run them from the dashboard, or call the same production API from your own application. BabyChain keeps provider credentials server-side, stores run state in PostgreSQL/Aurora, and sends one signed callback when the final result is ready.

## Image

```bash
docker pull babyseaoss/babychain:latest
```

Available tags:

- `latest`
- `0.2.0`

## Quick start

Create an environment file from the BabyChain `.env.example` and fill at least:

- `NEXT_PUBLIC_SITE_URL`
- `DATABASE_URL`
- `OWNER_EMAIL`
- `OWNER_PASSWORD`
- `OWNER_SESSION_SECRET`
- `BABYCHAIN_API_KEY`
- `BABYCHAIN_CRON_SECRET`
- `BABYCHAIN_CALLBACK_SECRET`
- Provider keys for your selected mode

<br/>

Then run:

```bash
docker run --rm \
  --name babychain \
  --env-file .env.local \
  -p 3000:3000 \
  babyseaoss/babychain:latest
```

Open:

```text
http://localhost:3000
```

The published `latest` image is built for local use at `http://localhost:3000`. For a production domain, build your own image with the final public URL:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL="https://your-domain.example.com" \
  -t babychain:production .
```

## Health check

The image exposes port `3000` and includes a container health check against:

```text
/api/v1/models
```

You can verify manually:

```bash
curl -fsS http://localhost:3000/api/v1/models
```

## Runtime requirements

BabyChain requires a reachable PostgreSQL database. AWS Aurora PostgreSQL is the recommended production database. Apply the schema before the first real run:

```bash
pnpm run aurora:migrate
```

For long-running deployments, schedule queued-run recovery by calling:

```text
GET /api/cron/process-runs
```

with:

```text
Authorization: Bearer BABYCHAIN_CRON_SECRET
```

## Security notes

- Runs as the non-root `node` user.
- Based on `node:24-alpine`.
- Does not ship npm/npx in the final runtime image.
- Provider credentials stay server-side.
- Caller applications authenticate with BabyChain API keys.
- `SENTRY_AUTH_TOKEN` is only needed in CI/build environments for optional source map uploads, not at runtime.

## Links

- Website: https://babychain.babysea.live
- Docker Hub: https://hub.docker.com/r/babyseaoss/babychain
- Source: https://github.com/babysea-community/babychain
- Supported models: https://github.com/babysea-community/babychain/blob/main/SUPPORTED_MODELS.md
- Docker deployment guide: https://github.com/babysea-community/babychain/blob/main/docs/deployment/docker.md
