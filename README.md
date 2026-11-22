<div align="center">

<img src="public/icon.png" width="80" alt="BabyChain icon" />

# BabyChain

Visual canvas studio, agentic workflow orchestration, and durable API for chaining image and video generation models.

### Every output becomes the next input.

<br />

[![Website](https://custom-icon-badges.demolab.com/badge/visit-website-33AAFF?style=for-the-badge&logo=babychain)](https://babychain.babysea.live)

<br />

<strong>Checks</strong>

[![Vercel Status](https://img.shields.io/github/deployments/babysea-community/babychain/production?style=for-the-badge&label=vercel&logo=vercel&logoColor=white&color=000000)](https://babychain.vercel.app)
[![Docker Status](https://img.shields.io/docker/v/babyseaoss/babychain?style=for-the-badge&label=docker&logo=docker&logoColor=white&color=2560FF)](https://hub.docker.com/r/babyseaoss/babychain)
[![GitLabCI](https://img.shields.io/gitlab/pipeline-status/babysea/babychain?branch=main&style=for-the-badge&label=gitlabci&logo=gitlab&logoColor=white&color=FC6D26)](https://gitlab.com/babysea/babychain/-/commits/main)
[![CircleCI](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcircleci.com%2Fapi%2Fv1.1%2Fproject%2Fcircleci%2F2uTLcwc4naeNuKDP41es88%2FLkDoyyGhqLz6j1Wi6mUHWd%2Ftree%2Fmain%3Flimit%3D1&query=%24%5B0%5D.status&style=for-the-badge&logo=circleci&logoColor=white&label=circleci&color=003740)](https://dl.circleci.com/status-badge/redirect/circleci/2uTLcwc4naeNuKDP41es88/LkDoyyGhqLz6j1Wi6mUHWd/tree/main)
[![Sentry](https://img.shields.io/github/actions/workflow/status/babysea-community/babychain/sentry-check.yml?style=for-the-badge&label=sentry&logo=sentry&logoColor=white&color=181225)](https://github.com/babysea-community/babychain/actions/workflows/sentry-check.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/babysea-community/babychain/codeql.yml?style=for-the-badge&label=codeql&logo=github&logoColor=white)](https://github.com/babysea-community/babychain/actions/workflows/codeql.yml)
[![Package](https://img.shields.io/github/actions/workflow/status/babysea-community/babychain/package-check.yml?style=for-the-badge&label=package&logo=npm&logoColor=white)](https://github.com/babysea-community/babychain/actions/workflows/package-check.y

<strong>One-click deploy</strong>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbabysea-community%2Fbabychain&project-name=babychain&repository-name=babychain&env=NEXT_PUBLIC_SITE_URL,OWNER_EMAIL,OWNER_PASSWORD,OWNER_SESSION_SECRET,DATABASE_URL,BABYCHAIN_API_KEY,BABYCHAIN_CRON_SECRET,BABYCHAIN_CALLBACK_SECRET,BABYCHAIN_PROVIDER_MODE,DASHSCOPE_API_KEY,BFL_API_KEY,BFL_REGION,BFL_API_BASE_URL,ARK_API_KEY,GEMINI_API_KEY,OPENAI_API_KEY,RUNWAYML_API_SECRET)

<br />

<img src="public/runner-self-control-1.png" alt="BabyChain mode" />

<img src="public/runner-self-control-2.png" alt="BabyChain mode" />

**Self Control**: you write every prompt and parameter.

<br/>

<img src="public/runner-agent-copilot-1.png" alt="BabyChain mode" />

<img src="public/runner-agent-copilot-2.png" alt="BabyChain mode" />

**Agentic Copilot**: proposes the prompt and fields for the next step; you lock the values and approve before it runs.

<br />

<img src="public/runner-agent-autopilot-1.png" alt="BabyChain mode" />

<img src="public/runner-agent-autopilot-2.png" alt="BabyChain mode" />

**Agentic Autopilot**: applies each planned step automatically and hands every output to the next model.

</div>

<br />

---

## Contents

- [1. Overview](#1-overview)
- [2. Architecture](#2-architecture)
- [3. Quickstart](#3-quickstart)
- [4. Database](#4-database)
- [5. Models and Modes](#5-models-and-modes)
- [6. Storage](#6-storage)
- [7. Agentic Workflow](#7-agentic-workflow)
- [8. Community](#8-community)
- [9. License](#9-license)

---

## 1. Overview

BabyChain is a visual studio for chaining generative media models, backed by a durable HTTP API. Owners compose multi-flow image → video chains on a canvas; every edit persists automatically to Aurora, and the exact same chain contract is callable from product code through authenticated API routes. Deploy BabyChain, configure server-side credentials, design flows on the canvas, run them in place, and call the same durable API from any product. No local model runtime is required and no provider keys belong in the caller.

### Why BabyChain

BabyChain turns model-to-model media workflows into durable backend runs. Compose flows on the canvas or send one API request. Either way, BabyChain starts the chain, persists every step, hands generated media from one model to the next, and sends one signed callback when the final result is ready.

- **Multi-flow canvas studio**: run many independent image → video flows side by side on one permanent workspace. Every edit autosaves to Aurora and survives reloads, logout, and device switches; only an explicit reset clears it.
- **Run in place, save what matters**: each flow ends in a runner card. "Run only" streams step outputs onto the canvas; "RUN + SAVE" also snapshots the flow into the Library with its results.
- **Same contract for products**: the canvas drives `POST /api/v1/chains/runs`, the exact API your product code calls. There is no separate studio-only contract.
- **Self-hosted control plane**: deploy on Vercel with your own environment and secrets.
- **Server-side credentials**: keep inference provider keys or BabySea keys inside your backend. Caller apps only use BabyChain API keys.
- **Durable execution**: store run state, ordered steps, provider request ids, generation ids, outputs, callbacks, and failure details in Aurora.
- **Product-ready callbacks**: return a public run resource from create/get routes and send the same resource through one final signed webhook.
- **Schema-true node cards**: canvas fields are generated from each model's Semantic Lady schema, including exact fields, enum options, ranges, and defaults, so the UI can never offer a parameter the run API would reject.

[Semantic Lady](https://github.com/babysea-community/semantic-lady) powers the last point. BabyChain uses the published Semantic Lady `generation_*` schema as the single source of truth for BYOK model cards, field validation, defaults, provider routing metadata, and chain compatibility, all evaluated before any provider request is sent.

### BabyChain and canvas workflow tools

BabyChain provides a canvas too. The distinction is not that node-graph tools lack APIs: ComfyUI-style workflows can run locally, and Comfy Cloud exposes an API for submitting workflow JSON, tracking async jobs, and retrieving outputs. BabyChain is narrower and more product-opinionated: the canvas edits a normalized image/video chain contract backed by the same authenticated API, AWS Aurora state, server-side credentials, callbacks, and run timeline that product code uses directly.

| Area              | ComfyUI-style workflow tools                                      | BabyChain                                                                         |
| :---------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| Primary interface | General node-graph workflow authoring                             | Opinionated multi-flow image/video studio plus stable HTTP API for the same chain |
| Runtime           | Local runtime or cloud workflow execution                         | Self-hosted Vercel control plane with AWS Aurora-backed state                     |
| Persistence       | Workflow JSON, local or cloud job state, and output files         | Durable runs, ordered steps, request params, outputs, audit, callbacks            |
| Model access      | Local models, provider nodes, or a workflow cloud API             | Server-side BYOK provider keys or BabySea key behind normalized `generation_*`    |
| Caller experience | Submit/export a graph, monitor a job, and download outputs        | Submit one normalized chain, poll the run API, or receive one signed callback     |
| Production fit    | Flexible graph execution, creative iteration, and workflow export | Product backends, queues, retries, idempotency, auth, webhooks                    |

Use BabyChain when a visual generative workflow is ready to become an application contract: design and test visually, then expose one normalized API that product code can call repeatedly without exposing inference credentials or asking every user to understand the underlying provider graph.

### Use cases

BabyChain targets product backends that need generated media without embedding inference provider logic into every application. Common patterns:

- Prompt-to-video pipelines from a text prompt through image generation to video synthesis
- Image-to-video campaigns that transform stored or uploaded images into motion assets
- Avatar and product motion pipelines for consistent character or product animation
- Internal media automation for batch generation without direct provider integration
- API products that expose one stable endpoint and signed callback after several provider calls

### Chain template

The built-in `chain` template orchestrates up to four model steps. Select models under `input.chain_models` and provide model inputs as nested objects. BabyChain does not flatten model fields at the top level.

| Chain   | Model input objects                                                                  | Model flow                                                      |
| :------ | :----------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `chain` | `image_model_input`, `video_model_input`                                             | image model → `image-to-video`                                  |
| `chain` | `image_model_input`, `refine_model_input`, `video_model_input`                       | image model → image model → `image-to-video`                    |
| `chain` | `image_model_input`, `video_model_input`, `modify_model_input`                       | image model → `image-to-video` → `video-to-video`               |
| `chain` | `image_model_input`, `refine_model_input`, `video_model_input`, `modify_model_input` | image model → image model → `image-to-video` → `video-to-video` |

In both `byok` and `babysea` modes, model input objects use normalized `generation_*` fields. In BYOK mode, field metadata (exact fields, enum options, ranges, defaults, and provider model IDs) is served by Semantic Lady via `GET /api/v1/models` or `GET /api/v1/models/{modelId}`.

See [`SUPPORTED_MODELS.md`](SUPPORTED_MODELS.md) for supported model names and mode availability.

## 2. Architecture

Solid edges are control/request flow; dotted edges are data/media flow. Everything inside the **Vercel trust boundary** runs with server-side credentials that API callers never receive. **Semantic Lady** is the schema brain for BYOK mode: it supplies `generation_*` fields, validation, defaults, and provider routing without ever executing a provider call, while `babysea` mode runs the same contract through the BabySea SDK.

### System container

Aurora is the single system of record: every run, ordered step, output URL, API key hash, audit event, callback delivery, inbound BabySea webhook delivery, agent checkpoint, and saved canvas lives in the `babychain_private` schema. The Vercel runtime is stateless: the `processRun` engine advances one action per invocation (start a step, poll a running step, or finalize) and is driven from four entry points: creating a run, polling `GET /api/v1/chains/get/{runId}`, the recovery cron, and the inbound `/api/webhooks/babysea` signed webhook. Because all state round-trips through Aurora, any function instance can resume a run mid-chain, so long chains survive serverless time limits.

Two provider modes share the same routes and run contract. **BYOK mode** resolves model fields, validation, and provider routing through **Semantic Lady**, then the runner calls the inference provider directly with server-side keys. **`babysea` mode** submits through the BabySea SDK and receives completion on the signed inbound webhook. For `chain_agent` runs the runner grounds **Amazon Nova (Amazon Bedrock)** with the same Semantic Lady downstream schema and records every suggestion in `chain_agent_checkpoint`. When media storage is enabled, each succeeded step's outputs are copied into your own AWS S3 (or CloudFront) or Vercel Blob store and the stored URL is preferred for API responses, downstream handoff, and Agentic Workflow checkpoints. Errors and traces from server and browser flow to Sentry. Provider, BabySea, Amazon Nova, database, and storage credentials never leave the trust boundary; callers only ever hold a BabyChain API key.

### Runtime: Agentic Workflow Copilot run

In **Copilot**, the run pauses at each downstream step with `status = awaiting_agent` and a `suggested` checkpoint; the caller approves, optionally editing `selected_prompt`/`selected_params` via `POST /api/v1/chains/continue/{runId}`, and BabyChain re-validates the edit against Semantic Lady before submitting. In **Autopilot**, the planner's schema-valid suggestion is auto-approved and the run continues without pausing. If a caller stops polling, the recovery cron advances or finalizes in-flight runs and the one final signed callback is still delivered.

## 3. Quickstart

This path is for a new user starting from an empty clone. It gets the dashboard, API, database schema, and one real provider-backed run working locally before deployment.

### Prerequisites

- **Node.js** `>=24.14.0 <25`.
- **pnpm** `11.7.0` (the version declared in [`package.json`](package.json)).
- **PostgreSQL** reachable from your machine. AWS Aurora PostgreSQL is the production target; local PostgreSQL also works for development.
- **Inference credentials for the models you select.** For the default BYOK mode, configure provider keys for the image/video models you plan to run. A first image-to-video run needs an image-capable model key and a video-capable model key, or one provider key that supports both roles. See [5. Models and Modes](#5-models-and-modes).

Agentic Workflow modes are optional for the first setup. They require `AWS_BEARER_TOKEN_BEDROCK`; `BEDROCK_REGION` and `BEDROCK_NOVA_AGENT_MODEL` default to `us-east-1` and `us.amazon.nova-2-lite-v1:0` if left unset.

### 1. Clone and install

```bash
git clone https://github.com/babysea-community/babychain.git
cd babychain
pnpm install --frozen-lockfile
cp .env.example .env.local
```

### 2. Configure `.env.local`

Fill `.env.local` from [`.env.example`](.env.example). For a local BYOK run, these are the required groups:

| Group               | Required values                                                                                                                                                              |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App URL             | `NEXT_PUBLIC_SITE_URL=http://localhost:3011`                                                                                                                                 |
| Owner login         | `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_SESSION_SECRET`                                                                                                                      |
| Database            | `DATABASE_URL`                                                                                                                                                               |
| BabyChain API       | `BABYCHAIN_API_KEY`, `BABYCHAIN_CRON_SECRET`, `BABYCHAIN_CALLBACK_SECRET`                                                                                                    |
| Provider mode       | `BABYCHAIN_PROVIDER_MODE=byok`                                                                                                                                               |
| BYOK provider keys  | At least the provider keys required by the models you will run: `DASHSCOPE_API_KEY`, `BFL_API_KEY`, `ARK_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `RUNWAYML_API_SECRET` |
| Agentic Workflow    | Optional for first setup. Set `AWS_BEARER_TOKEN_BEDROCK` to enable Copilot/Autopilot; region/model have defaults.                                                            |
| Durable media store | Optional: `BABYCHAIN_STORAGE_PROVIDER` plus S3 or Vercel Blob values                                                                                                         |

Generate strong secret values with OpenSSL:

```bash
openssl rand -hex 32
```

Use a different generated value for `OWNER_SESSION_SECRET`, `BABYCHAIN_CRON_SECRET`, and `BABYCHAIN_CALLBACK_SECRET`. `BABYCHAIN_API_KEY` can be any long secret string; prefixing it (for example `bchn_...`) makes it easier to recognize in logs.

For Aurora/RDS, keep `?sslmode=require` in `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@WRITER-ENDPOINT:5432/postgres?sslmode=require
```

For local PostgreSQL, point at localhost; BabyChain disables TLS automatically for `localhost` and `127.0.0.1`.

### 3. Check wiring and apply the schema

Run the deployment doctor before the migration. It validates required files, required environment variables, provider mode, provider keys, and basic TCP reachability to `DATABASE_URL`.

```bash
pnpm run doctor
```

If the database is intentionally unavailable while you are only checking env names, skip just the reachability probe:

```bash
BABYCHAIN_DOCTOR_SKIP_DB_REACHABILITY=1 pnpm run doctor
```

Apply the database schema:

```bash
pnpm run aurora:migrate   # creates the babychain_private schema + tables
```

`pnpm run aurora:migrate` reads `DATABASE_URL` from `.env.local` and applies [`scripts/aurora-migrate.mjs`](scripts/aurora-migrate.mjs). It is idempotent, so it is safe to run again after schema changes.

### 4. Start the app and run a chain

```bash
pnpm dev
```

Open <http://localhost:3011/dashboard/canvas> and log in with `OWNER_EMAIL`/`OWNER_PASSWORD`.

For the first run, choose models that match the provider keys in `.env.local`. For example, if you configured only a BFL key, image generation can work but an image-to-video chain still needs a video provider key. If you configured Alibaba Cloud, BytePlus, Google, or Runway keys, pick image and video models from the same configured provider to reduce first-run variables.

Click **Run only** to stream outputs onto the canvas, or **RUN + SAVE** to also store the finished flow in the Library. A successful setup shows card badges moving from `queued` to `running` to `succeeded`; the same run can be fetched through `GET /api/v1/chains/get/{runId}`.

### API

| Action                                | Method and path                        |
| :------------------------------------ | :------------------------------------- |
| List chains                           | `GET /api/v1/chains`                   |
| Create chain                          | `POST /api/v1/chains/runs`             |
| Get run                               | `GET /api/v1/chains/get/{runId}`       |
| Continue Agentic Workflow Copilot run | `POST /api/v1/chains/continue/{runId}` |
| Cancel run                            | `POST /api/v1/chains/cancel/{runId}`   |

All requests require `Authorization: Bearer <API key>`. Keys are bootstrapped from [`.env.example`](.env.example) or provisioned in the `babychain_private.api_key` table.

BYOK callers should read request field definitions from Semantic Lady model schema routes (`GET /api/v1/models` or `GET /api/v1/models/{modelId}`) before constructing `generation_*` input objects.

**cURL shape:**

> List chains

```bash
curl --request GET \
  --url "https://your-domain.example.com/api/v1/chains" \
  --header "Authorization: Bearer $BABYCHAIN_API_KEY"
```

> Create chain

`refine_model`/`modify_model` and their `*_model_input` objects are optional; include them only for the longer variants in the [Chain template](#chain-template) table. `execution` defaults to `{ "type": "self_control" }`; set `type` to `chain_agent` with `mode` of `copilot` or `autopilot` to use the Agentic Workflow. `webhook_url` is optional and receives the one final signed callback. The `Idempotency-Key` header is optional but recommended so retries do not create duplicate runs.

```bash
curl --request POST \
  --url "https://your-domain.example.com/api/v1/chains/runs" \
  --header "Authorization: Bearer $BABYCHAIN_API_KEY" \
  --header "Content-Type: application/json" \
  --header "Idempotency-Key: your-unique-idempotency-key" \
  --data '{
  "input": {
    "chain_models": {
      "image_model": "...",
      "refine_model": "...",
      "video_model": "...",
      "modify_model": "..."
    },
    "image_model_input": {},
    "refine_model_input": {},
    "video_model_input": {},
    "modify_model_input": {}
  },
  "execution": { "type": "self_control" },
  "webhook_url": "https://your-app.example.com/webhooks/babychain"
}'
```

> Get run

```bash
curl --request GET \
  --url "https://your-domain.example.com/api/v1/chains/get/{runId}" \
  --header "Authorization: Bearer $BABYCHAIN_API_KEY"
```

> Continue Agentic Workflow Copilot run

Only Agentic Workflow **Copilot** runs use this route (Autopilot advances automatically). Start the run with `"execution": { "type": "chain_agent", "mode": "copilot" }`, then poll `GET /api/v1/chains/get/{runId}` until the run `status` is `awaiting_agent`. Take the `agent_checkpoints[]` entry whose `status` is `suggested`, send its `id` as `checkpoint_id` to approve it, and edit `selected_prompt`/`selected_params` first if you want to override the planner's suggestion.

```bash
curl --request POST \
  --url "https://your-domain.example.com/api/v1/chains/continue/{runId}" \
  --header "Authorization: Bearer $BABYCHAIN_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
  "checkpoint_id": "00000000-0000-0000-0000-000000000000",
  "selected_prompt": "A gentle dolly-in as warm window light flickers across her face.",
  "selected_params": {
    "generation_prompt": "A gentle dolly-in as warm window light flickers across her face.",
    "generation_duration": 5
  }
}'
```

> Cancel run

```bash
curl --request POST \
  --url "https://your-domain.example.com/api/v1/chains/cancel/{runId}" \
  --header "Authorization: Bearer $BABYCHAIN_API_KEY"
```

**Response details:**

- `timeline`: ordered array of step status, timing, provider, output count, and error details. Renders the full run history without reshaping the raw `steps` payload.
- `agent_checkpoints`: Agentic Workflow suggestions, selected prompt data, and checkpoint status for Copilot/Autopilot runs.
- `guidance.what_to_try_next`: actionable list on error responses covering provider failures, invalid model fields, missing credentials, and chain incompatibilities.

### Runtime

- Each invocation starts or polls one provider step.
- Step output URLs are supplied to dependent steps by BabyChain, while generated media is exposed in run and step responses.
- A configured `webhook_url` receives one final signed callback with the same public run resource returned by `GET /api/v1/chains/get/{runId}`.
- Provider credentials stay server-side.
- Step submit idempotency keys are deterministic per run, step, and chain version, helping retries avoid duplicate provider submits when the downstream provider honors idempotency.

### Tests

Provider adapter contract lives with the provider adapter suite:

```bash
pnpm test:run -- test/provider-adapters.test.ts
```

The shared contract checks that each adapter returns zero-cost direct estimates and accepts best-effort cancel contexts. Provider-specific cases below it guard Semantic Lady field translation, output extraction, and failure normalization.

### Troubleshooting

| Symptom                     | Fix                                                                                                                                                                                      |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doctor` fails              | Read the provider-mode summary, missing env var, or deploy file printed by `doctor`; env names live in [`.env.example`](.env.example).                                                   |
| Studio shows `fetch failed` | On Vercel, confirm `NEXT_PUBLIC_SITE_URL` is the deployed `https://...` URL and all required env vars pass `pnpm run doctor`. Locally, run with `pnpm dev` on port `3011` or set `PORT`. |
| Route returns 401           | Confirm the caller key exists in the bootstrap value from [`.env.example`](.env.example) or `babychain_private.api_key`.                                                                 |
| Route returns 404           | Compare the requested path with the API table above.                                                                                                                                     |
| Run stays queued            | Check provider credentials, webhook reachability, and scheduler execution.                                                                                                               |
| Callback is missing         | Check `webhook_url`, callback host DNS, receiver status codes, and callback delivery records.                                                                                            |

## 4. Database

BabyChain stores all durable runtime state in a private `babychain_private` schema on AWS Aurora PostgreSQL: API keys, chain runs, ordered steps, agent checkpoints, saved canvases, webhook deliveries, callbacks, and audit events. `DATABASE_URL` is the only required database value.

```bash
# Aurora cluster writer endpoint (sslmode=require enables TLS)
DATABASE_URL=postgresql://USER:PASSWORD@CLUSTER.cluster-xxxxxxxxxxxx.REGION.rds.amazonaws.com:5432/postgres?sslmode=require
```

Aurora presents an Amazon RDS CA that is not in the Node.js trust store. For Aurora/RDS endpoints, include `?sslmode=require` in `DATABASE_URL` so the connection clearly requests TLS. BabyChain's pool strips `sslmode`/`ssl` query params and connects with TLS using `rejectUnauthorized: false`, so no manual CA bundle is required. To connect to a local PostgreSQL instead, point `DATABASE_URL` at `localhost` (TLS is auto-disabled for `localhost`/`127.0.0.1`).

### AWS Console

The fastest path is **RDS → Create database** in the AWS Console. These are the selections used by the BabyChain demo deployment. They create an Aurora Serverless v2 cluster that works with the checked-in `pg` connection code after you allow network access to port `5432` and run `pnpm run aurora:migrate`.

| Setting                       | Selection                                           |
| :---------------------------- | :-------------------------------------------------- |
| Engine type                   | Aurora (PostgreSQL Compatible)                      |
| Database creation method      | Full configuration                                  |
| Engine version                | Aurora PostgreSQL (Compatible with PostgreSQL 17.7) |
| Templates                     | Production                                          |
| Cluster scalability type      | Serverless v2                                       |
| Capacity range (ACUs)         | Minimum `1`, Maximum `2`                            |
| DB cluster identifier         | your cluster name                                   |
| Master username               | your master username                                |
| Credentials management        | Self managed                                        |
| Master password               | your database password                              |
| Configuration options         | Aurora Standard                                     |
| Multi-AZ deployment           | Don't create an Aurora Replica                      |
| Compute resource              | Don't connect to an EC2 compute resource            |
| Network type                  | Dual-stack mode                                     |
| Virtual private cloud (VPC)   | Create new VPC                                      |
| DB subnet group               | Create new DB Subnet Group                          |
| Public access                 | Yes                                                 |
| VPC security group (firewall) | Create new                                          |
| New VPC security group name   | `vpcsecurity-babychain` (or your own name)          |
| Availability Zone             | No preference                                       |
| RDS Proxy                     | Create an RDS Proxy                                 |
| Certificate authority         | `rds-ca-rsa2048-g1` (default)                       |
| RDS Data API                  | Enable the RDS Data API                             |
| Database port                 | `5432`                                              |
| Monitoring                    | Database Insights - Standard                        |
| Performance Insights          | Disabled                                            |
| Enhanced Monitoring           | Disabled                                            |
| Log exports                   | iam-db-auth-error log, PostgreSQL log               |

Notes:

- **Capacity minimum `1` ACU** keeps the demo database warm. If you choose a lower minimum that can pause, the first request after idle may take 10-30s to wake the cluster; BabyChain's 30s connection timeout is designed to absorb that cold start.
- **Public access: Yes** only makes the cluster addressable from outside the VPC. You must still add a security-group inbound rule for **TCP 5432** from the runtime that needs access. For local setup, use your current IP as `/32`. For a short demo on Vercel without static egress, you may temporarily allow a broader source, but do not leave `5432` open to `0.0.0.0/0` for production.
- **RDS Proxy** is useful for runtimes inside the same VPC, such as Lambda, ECS, EC2, or a Vercel private-networking setup. A normal public Vercel function cannot reach a private RDS Proxy endpoint by itself. If you deploy BabyChain on standard Vercel networking, use the Aurora writer endpoint in `DATABASE_URL` unless you have Vercel private networking configured.
- **RDS Data API** can be enabled for admin tooling, but BabyChain does not use it. The app uses the standard PostgreSQL wire protocol through `pg` and `DATABASE_URL`.
- The **DB cluster identifier** is not automatically the PostgreSQL database name. If you did not explicitly create a database named `babychain`, use `/postgres` in `DATABASE_URL`, for example `postgresql://USER:PASSWORD@WRITER-ENDPOINT:5432/postgres?sslmode=require`.

Once the cluster is **Available**, copy the **writer endpoint** from the Connectivity & security tab, build `DATABASE_URL` as shown above, add the required inbound security-group rule for port `5432`, then run `pnpm run aurora:migrate`.

### AWS CLI

The steps below create an Aurora cluster reachable from your app (Vercel functions, a Codespace, or your laptop). Replace `REGION`, IDs, and the CIDR/IP placeholders.

**1. VPC and subnets**

Aurora must live in a VPC across at least two Availability Zones. The default VPC works; for production create a dedicated VPC (e.g. `10.0.0.0/16`) with two private subnets for the DB and (optionally) two public subnets for a bastion/NAT.

```bash
# Use the default VPC + its subnets, or note your own IDs:
aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text
aws ec2 describe-subnets --filters Name=vpc-id,Values=<VPC_ID> \
  --query 'Subnets[].SubnetId' --output text
```

**2. DB subnet group**

Tells Aurora which subnets to span; needs ≥2 AZs):

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name babychain-subnets \
  --db-subnet-group-description "BabyChain Aurora subnets" \
  --subnet-ids <SUBNET_A> <SUBNET_B>
```

**3. Security group**

The VPC firewall. Open **TCP 5432** only to the sources that must reach the database:

```bash
aws ec2 create-security-group \
  --group-name babychain-aurora \
  --description "BabyChain Aurora Postgres access" \
  --vpc-id <VPC_ID>
# => returns <SG_ID>

# Allow Postgres from your app. For a fixed egress IP use a /32; for
# serverless platforms with dynamic IPs, scope to the VPC CIDR or use an
# RDS Proxy/PrivateLink instead of opening it publicly.
aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> --protocol tcp --port 5432 --cidr <YOUR_IP>/32
```

> Security: never leave `5432` open to `0.0.0.0/0` for a real deployment. Prefer a private subnet + RDS Proxy, AWS PrivateLink, or a bastion/VPN. `0.0.0.0/0` is acceptable only for a short-lived throwaway demo, and rotate the password afterward.

**4. Cluster and instance**

Create the Aurora PostgreSQL cluster + a writer instance. The engine version and capacity below match the console selections (Aurora PostgreSQL 17.7, Serverless v2 with 1-2 ACUs):

```bash
# Confirm the exact Aurora PostgreSQL 17.7 version string for your region first:
#   aws rds describe-db-engine-versions --engine aurora-postgresql \
#     --query 'DBEngineVersions[].EngineVersion' --output text
aws rds create-db-cluster \
  --db-cluster-identifier babychain \
  --engine aurora-postgresql \
  --engine-version 17.7 \
  --master-username postgres \
  --master-user-password '<STRONG_PASSWORD>' \
  --db-subnet-group-name babychain-subnets \
  --vpc-security-group-ids <SG_ID> \
  --database-name postgres \
  --port 5432 \
  --serverless-v2-scaling-configuration MinCapacity=1,MaxCapacity=2

aws rds create-db-instance \
  --db-instance-identifier babychain-1 \
  --db-cluster-identifier babychain \
  --engine aurora-postgresql \
  --db-instance-class db.serverless \
  --publicly-accessible
```

> The console's **RDS Proxy** and **RDS Data API** are optional and not required here: BabyChain connects to the Aurora writer endpoint with `pg`, so the CLI path omits them. Add them later only for an in-VPC runtime or admin tooling that needs them.

**5. Public reachability**

The writer instance above is created with `--publicly-accessible` to match the console's **Public access: Yes**. To actually reach it from your laptop or a Codespace, the subnets also need a route to an internet gateway and your IP must be allowed in the security group (step 3). For Vercel/production you can instead keep the cluster private and connect from within the VPC (VPC peering/PrivateLink) or via RDS Proxy.

**6. Endpoint and build database**

Get the writer endpoint and build `DATABASE_URL`:

```bash
aws rds describe-db-clusters --db-cluster-identifier babychain \
  --query 'DBClusters[0].Endpoint' --output text
# DATABASE_URL=postgresql://postgres:<PASSWORD>@<ENDPOINT>:5432/postgres?sslmode=require
```

**7. Apply the schema**

```bash
pnpm run aurora:migrate
```

> A minimum of 1 ACU (set above) keeps the cluster warm so it does not pause. If you lower `MinCapacity` to a value that allows auto-pause, the first connection after idle may take 10-30s to wake the cluster; BabyChain's pool uses a 30s connection timeout to absorb that cold start so the first run does not fail.

**Connectivity troubleshooting**

| Symptom                                                | Fix                                                                                                                                                                                                                                |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database "babychain" does not exist`                  | The cluster name is not always the PostgreSQL database name. If you used the AWS default database, connect to `/postgres`, not `/babychain`: `postgresql://USER:PASSWORD@WRITER-ENDPOINT:5432/postgres?sslmode=require`.           |
| `pnpm run aurora:migrate` times out or prints no error | The database is not reachable from your current runtime. Check public reachability and security-group inbound rules for TCP `5432`. From a local machine or Codespace, add your current public IP as `x.x.x.x/32`.                 |
| Vercel can’t load Library/Canvas after migration       | Standard Vercel egress IPs are dynamic. Without Vercel static egress/private networking, the quick demo option is a temporary inbound PostgreSQL rule from `0.0.0.0/0`. Do not use `All TCP`; expose only PostgreSQL port `5432`.  |
| You selected RDS Proxy but Vercel still cannot connect | RDS Proxy endpoints are normally private inside your VPC. They work for Lambda/ECS/EC2 or Vercel private networking, not for ordinary public Vercel functions. Use the Aurora writer endpoint unless private networking is set up. |
| `no pg_hba.conf entry`/TLS error                       | Keep `?sslmode=require` in `DATABASE_URL`; BabyChain handles the RDS CA automatically.                                                                                                                                             |
| Reachable via `psql` but app hangs                     | Confirm the app's actual egress IP is allowed on the database security group.                                                                                                                                                      |

To confirm the schema after migration, run this in the `postgres` database:

```sql
select table_name
from information_schema.tables
where table_schema = 'babychain_private'
order by table_name;
```

Expected tables:

```text
api_key
audit_event
babysea_webhook_delivery
callback_delivery
canvas
chain_agent_checkpoint
chain_run
chain_step
```

For a temporary public demo, the least-broad inbound rule is:

| Type       | Protocol | Port | Source      |
| :--------- | :------- | :--- | :---------- |
| PostgreSQL | TCP      | 5432 | `0.0.0.0/0` |

Remove that broad rule after the demo/judging window and replace it with static egress IPs, private networking, or an AWS runtime inside the VPC.

## 5. Models and Modes

Set `BABYCHAIN_PROVIDER_MODE=byok` for direct inference provider execution or `BABYCHAIN_PROVIDER_MODE=babysea` for BabySea SDK execution.

Supported model names and mode availability are listed in [`SUPPORTED_MODELS.md`](SUPPORTED_MODELS.md).

BabyChain supports two self-hosted provider modes:

| Mode      | What it means                                                                                                           |
| :-------- | :---------------------------------------------------------------------------------------------------------------------- |
| `byok`    | BabyChain calls supported inference providers directly with provider credentials from your server environment.          |
| `babysea` | BabyChain calls BabySea with your BabySea API key while keeping the same BabyChain routes, callbacks, and run contract. |

BabySea mode relies on the BabySea SDK's normalized `generation_*` contract. BYOK mode relies on Semantic Lady's normalized `generation_*` contract: it provides provider-aware model metadata, field definitions, enum options, defaults, and validation/UI alignment for direct adapters without storing credentials or executing provider calls.

All modes keep caller applications on BabyChain API keys. Provider credentials never belong in frontend code or caller requests.

### Natural video openings

Image-to-video models pin the conditioning image as the literal first frame, so a chained clip opens on a frozen copy of the previous step before motion begins. BabyChain softens that with editable code constants in [`lib/config/natural-video.ts`](lib/config/natural-video.ts) (not environment variables, so the decision ships with the image):

```ts
export const VIDEO_HANDOFF_AS_REFERENCE = false; // opt-in: open in motion at the source (BytePlus/Alibaba)
export const VIDEO_TRIM_LEAD_IN_MS = 800; // default fix: trim the static hold in ms (0 = off)
export const VIDEO_FFMPEG_PATH = 'ffmpeg'; // binary for the trim
```

By default BabyChain treats every video model the same: it trims the first 800ms - the brief static hold - off every stored clip with ffmpeg, so no provider opens on the previous image. This is provider-agnostic, so it also covers Runway and Google, which have no reference mode. The reference option below is an opt-in, no-re-encode alternative for the two providers that support it (and the recommended fix on serverless runtimes where ffmpeg cannot run).

| Constant                     | Default  | Controls                                                                                                                                                                                                                                                                                                                                                                                                                                                              | When to change                                                                                                                                     |
| :--------------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VIDEO_HANDOFF_AS_REFERENCE` | `false`  | Opt-in. Sends the auto chain handoff image to the providers that support it (BytePlus Seedance, Alibaba Wan i2v) as a subject `reference_image` instead of a pinned `first_frame`, so the clip opens already in motion in the handoff's style. Only the auto handoff is affected - a caller-provided first image (`generation_input_image_file`) stays `first_frame`, Alibaba `r2v` models are unchanged, and Runway/Google have no reference mode so they ignore it. | Set `true` to also fix BytePlus/Alibaba at the source - the recommended opening fix on serverless runtimes like Vercel, where the trim cannot run. |
| `VIDEO_TRIM_LEAD_IN_MS`      | `800`    | Trims that many milliseconds off the start of every stored video output with ffmpeg, dropping the static hold uniformly across every provider (Runway and Google included, which ignore the reference role). Needs an output storage provider (bytes are downloaded to re-encode) and ffmpeg (bundled in the Docker image); fails open to the original bytes on any error, a safe no-op without ffmpeg (e.g. Vercel).                                                 | Lower toward `500` if it clips real motion, raise toward `1000` if a hold remains; set `0` to disable the trim.                                    |
| `VIDEO_FFMPEG_PATH`          | `ffmpeg` | Path to the ffmpeg binary used by the trim.                                                                                                                                                                                                                                                                                                                                                                                                                           | Set an absolute path if ffmpeg is not on `PATH`.                                                                                                   |

Why trim by default: it is the only fix that works for every provider, since Runway and Google always treat the input as their literal first frame. The reference option is a no-re-encode alternative for the two providers that support it, and the recommended choice on serverless runtimes where ffmpeg cannot run.

## 6. Storage

BabyChain runs without media storage by default. In that mode it keeps the provider URL or inline data URL returned by the inference provider. For production chains, enable storage so completed step outputs are copied into your own bucket/blob store before the step is marked succeeded. API responses, canvas previews, downstream handoff, and Agentic Workflow checkpoints then prefer the stored public URL.

### AWS S3

Use AWS S3 when you want your own S3 bucket, CloudFront distribution, or custom media domain:

```bash
BABYCHAIN_STORAGE_PROVIDER=aws-s3
AWS_S3_REGION=
AWS_S3_ACCESS_KEY_ID=
AWS_S3_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_S3_ENDPOINT_URL=
```

`AWS_S3_ENDPOINT_URL` is the browser-readable base URL BabyChain returns for stored media. It can be a CloudFront distribution domain, your custom CloudFront domain, a bucket-hosted S3 URL, or an AWS S3 path-style bucket URL. BabyChain still writes objects to AWS S3 using `AWS_S3_REGION` and `AWS_S3_BUCKET_NAME`; true S3-compatible services with custom write endpoints are not part of this provider. Do not set a second public base URL.

Create an IAM user or role for BabyChain with object write/read access limited to the media bucket. Replace `your-bucket-name` with the value used in `AWS_S3_BUCKET_NAME`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BabyChainListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::your-bucket-name"
    },
    {
      "Sid": "BabyChainWriteMediaObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Sid": "BabyChainFindMediaDistribution",
      "Effect": "Allow",
      "Action": ["cloudfront:ListDistributions"],
      "Resource": "*"
    },
    {
      "Sid": "BabyChainInvalidateMediaCache",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::your-account-id:distribution/your-distribution-id"
    }
  ]
}
```

For CloudFront, point the distribution origin at the same S3 bucket and set `AWS_S3_ENDPOINT_URL` to the CloudFront or custom domain. If the bucket itself is private, configure CloudFront origin access so browsers can read the CloudFront URL while BabyChain writes with the IAM credentials above. When an owner deletes a canvas card, BabyChain removes the run's `runs/<runId>/` objects from the bucket and then invalidates the matching `/runs/<runId>/*` CloudFront paths, so deleted images and videos stop being served from edge caches immediately instead of lingering until their TTL expires. BabyChain finds the distribution by matching the `AWS_S3_ENDPOINT_URL` host against each distribution's domain or alternate domain name (CNAME), which is why the `cloudfront:ListDistributions` and `cloudfront:CreateInvalidation` permissions above are included; the invalidation is best-effort, so a public URL that points straight at S3 or missing CloudFront permissions simply skips it without blocking the delete.

### Vercel Blob

Use Vercel Blob when the app is deployed on Vercel and you want the simplest hosted object store:

```bash
BABYCHAIN_STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=
```

Create the token in Vercel Storage, add it to the same Vercel project as BabyChain, then redeploy. BabyChain writes objects under `runs/<runId>/<stepKey>/output-<index>.<ext>` and stores the returned Blob URL in run metadata.

## 7. Agentic Workflow

BabyChain supports three `chain_runner` modes:

| chain_runner                     | What it does                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Self Control**                 | Runs the current canvas prompts end-to-end using `execution.type = "self_control"`.                                                                 |
| **Agentic Workflow · Copilot**   | Runs the first step from the user's seed prompt, then pauses at each downstream checkpoint so you can approve or edit the planner's next prompt.    |
| **Agentic Workflow · Autopilot** | Runs the first step from the user's seed prompt, then lets the planner write each downstream prompt and schema-valid required fields automatically. |

The Agentic Workflow uses Amazon Nova through Amazon Bedrock as a prompt-planning layer. It does not add a fifth model role to `chain_models`; the media workflow remains `image_model`, optional `refine_model`, `video_model`, and optional `modify_model`. It stores checkpoint suggestions, selected prompts, validation outcomes, repair attempts, instruction version, schema version, model id, latency, and token usage in Aurora alongside the run timeline.

Agentic Workflow prompts live under `lib/agents/instructions` and follow Amazon's published Amazon Nova prompting guidance. The planner sends Nova a stable system prompt (persona; an extended-thinking reasoning method, Nova 2 reasoning mode at low effort, with no `<thinking>` tags, that observes the media first, diverges into three deliberately distinct directions, then decides; the schema-true JSON output contract returned in an `<output>` block; and a trust boundary that treats run input and media as untrusted data) plus a per-run user message carrying the media and context. The first pass runs in Nova 2 reasoning mode (low effort, temperature 1/top-p 0.9, with a 10k-token budget that holds the private reasoning and the final JSON) so the three suggestions genuinely differ, while the one-pass self-repair turns reasoning off and stays greedy (temperature 0, top-k 1) for reliable structured output. Grounding follows the Nova "provide supporting text" RAG pattern: BabyChain frames the downstream schema, current models, prior params, and a typed internal tool boundary (`read_downstream_schema`, `select_schema_defaults`) as the planner's trusted reference and instructs it to use only the schema fields, enums, and limits that appear there. BabyChain also pins provider-native prompt enhancement off by default on the planner's proposed parameters, so a model default cannot silently rewrite the planned prompt (in Copilot a reviewer can opt back in). Bedrock tool calling and Knowledge Bases are not required for the current flow; add a Knowledge Base later only for durable brand/style memory across runs (`read_previous_step_summary` and `retrieve_brand_context` are reserved for that).

Configure the Agentic Workflow with:

```bash
AWS_BEARER_TOKEN_BEDROCK=
BEDROCK_REGION=us-east-1
BEDROCK_NOVA_AGENT_MODEL=us.amazon.nova-2-lite-v1:0
```

Until BabyChain Media Storage is enabled, the Agentic Workflow reads previous outputs from the existing provider URL or inline data URL. Provider URLs can expire, redirect, or exceed the temporary 24MB checkpoint media limit, so storage should be added before relying on long-running or large-video Agentic Workflow runs in production.

### Tuning the planner

The model id, region, and Bedrock key above are environment variables. The planner's reasoning depth, creativity, and token budget are code constants in [`lib/agents/bedrock-nova.ts`](lib/agents/bedrock-nova.ts), so a self-hoster can tune them to their own latency, cost, and quality needs:

```ts
const AGENT_MAX_OUTPUT_TOKENS = 10000; // must hold the reasoning AND the final JSON
const AGENT_REASONING_EFFORT = 'low'; // 'low' | 'medium' | 'high'
const AGENT_REASONING_TEMPERATURE = 1; // creative (first) pass only
const AGENT_REASONING_TOP_P = 0.9; // creative (first) pass only
```

| Constant                      | Default | Controls                                                                                                                                                                                          | When to change                                                                                        |
| :---------------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| `AGENT_REASONING_EFFORT`      | `low`   | Nova 2 extended-thinking depth on the creative pass. `low` fits this single-pass image + schema analysis; `medium` suits multi-step/multi-tool coordination; `high` targets STEM-grade reasoning. | Raise to `medium` for complex briefs if you accept higher latency and cost.                           |
| `AGENT_REASONING_TEMPERATURE` | `1`     | Creativity of the three suggestions. Higher diverges more (and slightly raises malformed-JSON odds, which the repair pass absorbs).                                                               | Lower toward `0.7` for safer, more conservative variations.                                           |
| `AGENT_REASONING_TOP_P`       | `0.9`   | Nucleus-sampling breadth on the creative pass.                                                                                                                                                    | Pair with temperature; lower for tighter output.                                                      |
| `AGENT_MAX_OUTPUT_TOKENS`     | `10000` | Output budget. **Reasoning tokens are billed as output and count against this**, so it must hold the private reasoning _and_ the final JSON (Nova 2 allows up to ~65k).                           | Raise it whenever you raise effort, or the answer can be truncated to an empty, unparseable response. |

Two hard rules from the Nova 2 docs: reasoning effort `high` **forbids** `temperature`, `topP`, and `topK` (keep effort at `low`/`medium` if you tune those), and the one-pass self-repair always runs greedy (temperature 0, top-k 1) with reasoning off so a malformed creative response still gets a reliable structured fix, it is intentionally not tunable.

### Model profile: Amazon Nova 2 Lite

The Agentic Workflow runs on **Amazon Nova 2 Lite** through Amazon Bedrock (`BEDROCK_NOVA_AGENT_MODEL=us.amazon.nova-2-lite-v1:0` by default) and BabyChain calls it through the `Converse` API (see [`lib/agents/bedrock-nova.ts`](lib/agents/bedrock-nova.ts)).

### Model details

Nova 2 Lite is Amazon's cost-efficient multimodal model for simple automation, document processing, and customer support across text, images, and video. For more information about model development and performance.

| Property          | Value        |
| :---------------- | :----------- |
| Model launch date | Dec 02, 2025 |
| Model lifecycle   | Active       |
| Context window    | 1M tokens    |
| Max output tokens | 64K          |
| Knowledge cutoff  | Oct 2025     |

### Modalities

| Modality  | Input | Output |
| :-------- | :---: | :----: |
| Text      |  ✅   |   ✅   |
| Image     |  ✅   |   ❌   |
| Video     |  ✅   |   ❌   |
| Audio     |  ❌   |   ❌   |
| Speech    |  ❌   |   ❌   |
| Embedding |   -   |   ❌   |

### APIs and endpoints

`bedrock-runtime` is the only supported endpoint (`bedrock-mantle` is not supported). Supported APIs: **Converse** ✅ and **Invoke** ✅ (Chat Completions ❌, Responses ❌). BabyChain uses **Converse**.

### Prompt caching

| Supported | Min tokens/checkpoint | Max checkpoints | TTL       | Cacheable fields        |
| :-------: | :-------------------- | :-------------: | :-------- | :---------------------- |
|    ✅     | 1K\*                  |        4        | 5 minutes | `system` and `messages` |

\* Amazon Nova models support up to 20K tokens for prompt caching, primarily for text prompts. See [Prompt caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html).

## 8. Community

Issues, pull requests, design discussion, and security reports should follow [`CONTRIBUTING.md`](CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), and [`SECURITY.md`](SECURITY.md).

## 9. License

[Apache License 2.0](LICENSE).
