# Deploy BabyChain with Docker

Docker is not a native one-click host for BabyChain. The Dockerfile gives you a production image, but you still need to build it with public Next.js values, provide runtime secrets, expose the container, add HTTPS, and run a scheduler for queued-run recovery.

Use this guide when you want to run BabyChain on any Docker-capable host or publish a reusable image from GitHub Actions.

## What this uses

- [`Dockerfile`](../../Dockerfile) builds a production Next.js image on `node:24-bookworm-slim`.
- [`.dockerignore`](../../.dockerignore) keeps local build output, dependencies, logs, and env files out of the build context.
- [`.github/workflows/docker.yml`](../../.github/workflows/docker.yml) builds pull requests and can publish main or tag images to Docker Hub.
- The final image runs as the non-root `node` user and exposes port `3000`.

## Prerequisites

- Docker installed and running on the machine that builds the image.
- Runtime values from [`.env.example`](../../.env.example).
- A reachable PostgreSQL database, preferably Aurora/RDS for production.
- BabyChain schema applied with `pnpm run aurora:migrate` against `DATABASE_URL`.
- Provider keys required by your provider mode.

## Build-time values and runtime secrets

Next.js reads `NEXT_PUBLIC_*` values at build time. Set the final public URL before you build:

- Local test: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- Production: `NEXT_PUBLIC_SITE_URL=https://your-domain.example`

Runtime secrets must be provided when the container starts, not as Docker build args. Keep these in `.env.local`, your host secret manager, or your orchestrator:

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-domain.example
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD=YOUR_OWNER_PASSWORD
OWNER_SESSION_SECRET=YOUR_OWNER_SESSION_SECRET
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
BABYCHAIN_API_KEY=YOUR_BABYCHAIN_API_KEY
BABYCHAIN_CRON_SECRET=YOUR_BABYCHAIN_CRON_SECRET
BABYCHAIN_CALLBACK_SECRET=YOUR_BABYCHAIN_CALLBACK_SECRET
BABYCHAIN_PROVIDER_MODE=byok
DASHSCOPE_API_KEY=YOUR_DASHSCOPE_API_KEY
BFL_API_KEY=YOUR_BFL_API_KEY
BFL_REGION=global
BFL_API_BASE_URL=https://api.bfl.ai/v1
ARK_API_KEY=YOUR_ARK_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
RUNWAYML_API_SECRET=YOUR_RUNWAY_API_KEY
BABYSEA_API_KEY=YOUR_BABYSEA_API_KEY_OR_PLACEHOLDER
BABYSEA_REGION=us
BABYSEA_API_BASE_URL=https://api.us.babysea.ai
BABYSEA_WEBHOOK_SECRET=YOUR_BABYSEA_WEBHOOK_SECRET_OR_PLACEHOLDER
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ORG=YOUR_SENTRY_ORG
SENTRY_PROJECT=YOUR_SENTRY_PROJECT
SENTRY_AUTH_TOKEN=YOUR_SENTRY_AUTH_TOKEN
```

Default deployments use `BABYCHAIN_PROVIDER_MODE=byok`, so fill all BYOK inference keys. The BabySea and Sentry values can be placeholders when you stay in BYOK mode and do not upload source maps.

### 1. Prepare an ENV file

```bash
cp .env.example .env.local
```

Fill `.env.local` with real runtime values. Keep `NEXT_PUBLIC_SITE_URL` in the env file too, but still pass it as a build arg so the client bundle is built for the right deployment. Before first run, apply the schema to the configured database:

```bash
pnpm run aurora:migrate
```

### 2. Build the image locally

```bash
export NEXT_PUBLIC_SITE_URL=http://localhost:3000

docker build \
	--build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
	-t babychain:local .
```

If you use Sentry client telemetry, also pass `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_ENVIRONMENT` as build args.

### 3. Run the container

```bash
docker run --rm \
	--name babychain \
	--env-file .env.local \
	-e NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
	-p 3000:3000 \
	babychain:local
```

Open <http://localhost:3000>.

For a long-running host, use a restart policy and a production env file:

```bash
docker run --detach \
	--name babychain \
	--restart unless-stopped \
	--env-file /etc/babychain.env \
	-p 3000:3000 \
	babychain:latest
```

### 4. Add HTTPS and a stable URL

The container serves HTTP. For production, put TLS in front with a reverse proxy, load balancer, Cloudflare Tunnel, or another managed ingress. Rebuild the image with the final HTTPS `NEXT_PUBLIC_SITE_URL` before sending real callback URLs, browser traffic, or bearer tokens through the deployment.

### 5. Schedule queued-run recovery

Docker does not read Vercel Cron. Run an external scheduler every few minutes to call `GET /api/cron/process-runs` with `Authorization: Bearer BABYCHAIN_CRON_SECRET`.

Example host cron entry:

```cron
*/5 * * * * . /etc/babychain.env && curl -fsS -H "Authorization: Bearer $BABYCHAIN_CRON_SECRET" "$NEXT_PUBLIC_SITE_URL/api/cron/process-runs?limit=5" >/dev/null
```

If your host uses systemd, create a timer that runs the same curl command. Keep `BABYCHAIN_CRON_SECRET` in a root-readable env file or host secret manager.

### 6. Publish from GitHub actions

[`.github/workflows/docker.yml`](../../.github/workflows/docker.yml) uses `docker/metadata-action`, `docker/login-action`, `docker/setup-buildx-action`, and `docker/build-push-action`.

Configure the repository before expecting pushes:

| Name                             | Type                | Purpose                                                     |
| :------------------------------- | :------------------ | :---------------------------------------------------------- |
| `DOCKER_USERNAME`                | Repository variable | Docker Hub namespace used for `DOCKER_USERNAME/babychain`.  |
| `DOCKER_PASSWORD`                | Repository secret   | Docker Hub token or password used by `docker/login-action`. |
| `NEXT_PUBLIC_SITE_URL`           | Repository variable | Public URL baked into the Next.js image.                    |
| `NEXT_PUBLIC_SENTRY_DSN`         | Repository variable | Optional public Sentry DSN.                                 |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Repository variable | Optional public Sentry environment.                         |

Pull requests build without pushing. Main branch and `v*` tags push only when both Docker Hub credentials are configured. The workflow attaches SBOM plus provenance attestations.

### 7. Update a running host

Build and tag a new image, then replace the running container:

```bash
docker build \
	--build-arg NEXT_PUBLIC_SITE_URL="https://your-domain.example" \
	-t babychain:latest .

docker rm -f babychain

docker run --detach \
	--name babychain \
	--restart unless-stopped \
	--env-file /etc/babychain.env \
	-p 3000:3000 \
	babychain:latest
```

If you pull from Docker Hub or another registry, replace the build command with `docker pull your-namespace/babychain:tag`.

### 8. Verify and debug

```bash
docker ps --filter name=babychain
docker logs --tail=100 babychain
curl -fsS "$NEXT_PUBLIC_SITE_URL" >/dev/null
```

For API checks, send caller requests with `Authorization: Bearer BABYCHAIN_API_KEY`.

## Troubleshooting

| Symptom                         | Check                                                                                 |
| :------------------------------ | :------------------------------------------------------------------------------------ |
| Browser points to the wrong URL | Rebuild with the final HTTPS URL before building.                                     |
| Container starts then exits     | Check `docker logs babychain` for missing env values.                                 |
| Runs stay queued                | Confirm the external scheduler is calling `/api/cron/process-runs`.                   |
| Provider calls fail             | Confirm the provider mode and provider keys match the chain models being used.        |
| Local build is slow or huge     | Confirm `.dockerignore` excludes `.next`, `.env`, `.env.*`, logs, and `node_modules`. |
