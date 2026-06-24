# Deploy BabyChain on Google Cloud Run

Google Cloud Run runs BabyChain from the production Docker image and gives you managed HTTPS, autoscaling, Cloud Logging, Secret Manager integration, and Cloud Scheduler for recovery jobs.

## Prerequisites

- Google Cloud project with billing enabled.
- `gcloud` CLI installed and authenticated.
- APIs enabled for Cloud Run, Cloud Build, Artifact Registry, Secret Manager, and Cloud Scheduler.
- A reachable PostgreSQL database, preferably Aurora/RDS for production.
- BabyChain schema applied with `pnpm run aurora:migrate` against `DATABASE_URL`.
- BYOK provider credentials. Default deployments use `BABYCHAIN_PROVIDER_MODE=byok`, so create the provider secrets required by the models you plan to run. The direct deploy command below uses `GEMINI_API_KEY` for Google models; create placeholders for unused providers if you use that command unchanged.
- Optional BabySea credentials only if you switch `BABYCHAIN_PROVIDER_MODE` to `babysea`.
- A final Cloud Run URL or custom domain selected before the production build.

### 1. Configure Google Cloud

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_NAME="babychain"
export IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/babychain/babychain:latest"

gcloud config set project "$PROJECT_ID"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com
```

Create the Artifact Registry repository once:

```bash
gcloud artifacts repositories create babychain \
  --repository-format=docker \
  --location="$REGION" \
  --description="BabyChain container images"
```

### 2. Store runtime secrets

Create Secret Manager entries for the values BabyChain reads at runtime.

```bash
printf '%s' 'owner@example.com' | gcloud secrets create babychain-owner-email --data-file=-
printf '%s' 'YOUR_OWNER_PASSWORD' | gcloud secrets create babychain-owner-password --data-file=-
printf '%s' 'YOUR_OWNER_SESSION_SECRET' | gcloud secrets create babychain-owner-session-secret --data-file=-
printf '%s' 'postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require' | gcloud secrets create babychain-database-url --data-file=-
printf '%s' 'YOUR_BABYCHAIN_API_KEY' | gcloud secrets create babychain-api-key --data-file=-
printf '%s' 'YOUR_BABYCHAIN_CRON_SECRET' | gcloud secrets create babychain-cron-secret --data-file=-
printf '%s' 'YOUR_BABYCHAIN_CALLBACK_SECRET' | gcloud secrets create babychain-callback-secret --data-file=-
printf '%s' 'YOUR_DASHSCOPE_API_KEY' | gcloud secrets create babychain-dashscope-api-key --data-file=-
printf '%s' 'YOUR_BFL_API_KEY' | gcloud secrets create babychain-bfl-api-key --data-file=-
printf '%s' 'YOUR_ARK_API_KEY' | gcloud secrets create babychain-ark-api-key --data-file=-
printf '%s' 'YOUR_GEMINI_API_KEY' | gcloud secrets create babychain-gemini-api-key --data-file=-
printf '%s' 'YOUR_OPENAI_API_KEY' | gcloud secrets create babychain-openai-api-key --data-file=-
printf '%s' 'YOUR_RUNWAY_API_KEY' | gcloud secrets create babychain-runway-api-secret --data-file=-
printf '%s' 'YOUR_BABYSEA_API_KEY_OR_PLACEHOLDER' | gcloud secrets create babychain-babysea-api-key --data-file=-
printf '%s' 'YOUR_BABYSEA_WEBHOOK_SECRET_OR_PLACEHOLDER' | gcloud secrets create babychain-babysea-webhook-secret --data-file=-
```

For BabySea mode, replace `YOUR_BABYSEA_API_KEY_OR_PLACEHOLDER` with a real BabySea API key.

If you are using direct `gcloud run deploy` flags instead of the YAML, you can omit the BabySea secrets while staying in BYOK mode.

Media storage and the Agentic Workflow planner are optional. To enable them, create the matching secrets and append them to the deploy command:

```bash
printf '%s' 'YOUR_AWS_BEARER_TOKEN_BEDROCK' | gcloud secrets create babychain-bedrock-bearer-token --data-file=-
printf '%s' 'YOUR_AWS_S3_ACCESS_KEY_ID' | gcloud secrets create babychain-s3-access-key-id --data-file=-
printf '%s' 'YOUR_AWS_S3_SECRET_ACCESS_KEY' | gcloud secrets create babychain-s3-secret-access-key --data-file=-
printf '%s' 'YOUR_BLOB_READ_WRITE_TOKEN' | gcloud secrets create babychain-blob-token --data-file=-
```

Then append the non-secret storage settings to `--set-env-vars` (set `BABYCHAIN_STORAGE_PROVIDER=aws-s3` or `vercel-blob`, plus `AWS_S3_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`) and the secrets to `--set-secrets` (`AWS_BEARER_TOKEN_BEDROCK=babychain-bedrock-bearer-token:latest`, `AWS_S3_ACCESS_KEY_ID=babychain-s3-access-key-id:latest`, `AWS_S3_SECRET_ACCESS_KEY=babychain-s3-secret-access-key:latest`, `BLOB_READ_WRITE_TOKEN=babychain-blob-token:latest`). The checked-in `.gcp/cloud-run-service.yaml` includes the non-secret defaults; add the matching secret references there only when you enable Agentic Workflow or storage from the YAML.

### 3. Build and push the image

Next.js bakes public values into the build. Use the final public URL as a Docker build arg.

```bash
export SITE_URL="https://babychain-REGION-PROJECT_HASH.a.run.app"

gcloud auth configure-docker "$REGION-docker.pkg.dev"

docker build \
  --build-arg NEXT_PUBLIC_SITE_URL="$SITE_URL" \
  --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT="production" \
  -t "$IMAGE_URI" \
  .

docker push "$IMAGE_URI"
```

Cloud Build can run the same Dockerfile if you prefer remote builds. If you use Cloud Build with custom substitutions, mirror the same build args in your Cloud Build config.

### 4. Deploy to Cloud Run

Deploy with direct flags:

```bash
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --port 3000 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "PORT=3000,HOSTNAME=0.0.0.0,NEXT_TELEMETRY_DISABLED=1,NEXT_PUBLIC_SITE_URL=$SITE_URL,BABYCHAIN_PROVIDER_MODE=byok,BFL_REGION=global,BFL_API_BASE_URL=https://api.bfl.ai/v1,BABYSEA_REGION=us,BABYSEA_API_BASE_URL=https://api.us.babysea.ai,BEDROCK_REGION=us-east-1,BEDROCK_NOVA_AGENT_MODEL=us.amazon.nova-2-lite-v1:0,BABYCHAIN_STORAGE_PROVIDER=none,NEXT_PUBLIC_SENTRY_ENVIRONMENT=production" \
  --set-secrets "OWNER_EMAIL=babychain-owner-email:latest,OWNER_PASSWORD=babychain-owner-password:latest,OWNER_SESSION_SECRET=babychain-owner-session-secret:latest,DATABASE_URL=babychain-database-url:latest,BABYCHAIN_API_KEY=babychain-api-key:latest,BABYCHAIN_CRON_SECRET=babychain-cron-secret:latest,BABYCHAIN_CALLBACK_SECRET=babychain-callback-secret:latest,DASHSCOPE_API_KEY=babychain-dashscope-api-key:latest,BFL_API_KEY=babychain-bfl-api-key:latest,ARK_API_KEY=babychain-ark-api-key:latest,GEMINI_API_KEY=babychain-gemini-api-key:latest,OPENAI_API_KEY=babychain-openai-api-key:latest,RUNWAYML_API_SECRET=babychain-runway-api-secret:latest"
```

Or update placeholders in `.gcp/cloud-run-service.yaml` and apply it:

```bash
gcloud run services replace .gcp/cloud-run-service.yaml --region "$REGION"
```

For a custom domain, map the domain, update `SITE_URL`, rebuild, push, and redeploy so the public URL is baked into the Next.js build.

### 5. Add Cloud Scheduler recovery

BabyChain processes runs immediately after creation, but Cloud Run deployments should still call the recovery endpoint periodically.

```bash
export CRON_SECRET="YOUR_BABYCHAIN_CRON_SECRET"

gcloud scheduler jobs create http babychain-process-runs \
  --location="$REGION" \
  --schedule="*/5 * * * *" \
  --uri="$SITE_URL/api/cron/process-runs?limit=5" \
  --http-method=GET \
  --headers="Authorization=Bearer $CRON_SECRET"
```

Use `*/1 * * * *` for high-volume deployments. The endpoint is idempotent and only processes eligible pending runs.

### 6. Verify the deployment

```bash
gcloud run services describe "$SERVICE_NAME" --region "$REGION"
curl -fsS "$SITE_URL/"
curl -fsS \
  -H "Authorization: Bearer YOUR_BABYCHAIN_API_KEY" \
  "$SITE_URL/api/health"
```

Run the starter doctor before shipping changes:

```bash
pnpm run doctor
```

## Troubleshooting

- If public URLs are wrong, rebuild with the correct `NEXT_PUBLIC_SITE_URL` and redeploy.
- If deployment fails with missing secrets, either create the Secret Manager entries referenced by `.gcp/cloud-run-service.yaml` or remove unused optional provider entries.
- If run recovery stalls, confirm the Cloud Scheduler job sends `Authorization: Bearer YOUR_BABYCHAIN_CRON_SECRET`.
- If provider calls fail, confirm `BABYCHAIN_PROVIDER_MODE` matches the secrets attached to the Cloud Run service.
