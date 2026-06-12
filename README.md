<div align="center">

<img src="public/icon.png" width="80" alt="BabyChain icon" />

# BabyChain

Canvas studio and durable chain API for image and video model workflows with one final callback.

### Every output becomes the next input.

<br />

[![Website](https://custom-icon-badges.demolab.com/badge/visit-website-33AAFF?style=for-the-badge&logo=babychain)](https://babychain.babysea.live)

<br />

<strong>Project details</strong>

[![BabySea OSS Starter](https://custom-icon-badges.demolab.com/badge/oss-starter-2563EB?style=for-the-badge&logo=babysea&logoColor=white)](#babysea-oss-taxonomy)
[![BabySea OSS Status Production](https://custom-icon-badges.demolab.com/badge/oss_status-production-C026D3?style=for-the-badge&logo=babysea&logoColor=white)](#status)
[![License](https://custom-icon-badges.demolab.com/badge/license-apache_2.0-059669?style=for-the-badge&logo=apache&logoColor=white)](LICENSE)

<br/>

<strong>Checks</strong>

[![GitLabCI](https://img.shields.io/gitlab/pipeline-status/babysea/babychain?branch=main&style=for-the-badge&label=gitlabci&logo=gitlab&logoColor=white&color=FC6D26)](https://gitlab.com/babysea/babychain/-/commits/main)
[![CircleCI](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcircleci.com%2Fapi%2Fv1.1%2Fproject%2Fcircleci%2F2uTLcwc4naeNuKDP41es88%2FLkDoyyGhqLz6j1Wi6mUHWd%2Ftree%2Fmain%3Flimit%3D1&query=%24%5B0%5D.status&style=for-the-badge&logo=circleci&logoColor=white&label=circleci&color=003740)](https://dl.circleci.com/status-badge/redirect/circleci/2uTLcwc4naeNuKDP41es88/LkDoyyGhqLz6j1Wi6mUHWd/tree/main)
[![Codecov](https://img.shields.io/codecov/c/github/babysea-community/babychain?style=for-the-badge&label=codecov&logo=codecov&logoColor=white&color=FF0077&token=MTbBUiu9cN)](https://codecov.io/github/babysea-community/babychain)
[![Sentry](https://img.shields.io/github/actions/workflow/status/babysea-community/babychain/sentry-check.yml?style=for-the-badge&label=sentry&logo=sentry&logoColor=white&color=181225)](https://github.com/babysea-community/babychain/actions/workflows/sentry-check.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/babysea-community/babychain/codeql.yml?style=for-the-badge&label=codeql&logo=github&logoColor=white)](https://github.com/babysea-community/babychain/actions/workflows/codeql.yml)
[![Package](https://img.shields.io/github/actions/workflow/status/babysea-community/babychain/package-check.yml?style=for-the-badge&label=package&logo=npm&logoColor=white)](https://github.com/babysea-community/babychain/actions/workflows/package-check.yml)

<br/>

<strong>Built with</strong>

[![Next.js](https://img.shields.io/badge/next_js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/react-53C1DE?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![BabySea](https://custom-icon-badges.demolab.com/badge/babysea-48D1CC?style=for-the-badge&logo=babysea&logoColor=white)](https://babysea.ai)
[![AWS Aurora](https://custom-icon-badges.demolab.com/badge/aws_aurora-3B46CA?style=for-the-badge&logo=aws-aurora)](https://aws.amazon.com/rds/aurora)
[![Upstash](https://img.shields.io/badge/upstash-00E9A3?style=for-the-badge&logo=upstash&logoColor=white)](https://upstash.com)
[![Sentry](https://img.shields.io/badge/sentry-181225?style=for-the-badge&logo=sentry&logoColor=white)](https://sentry.io)

<br/>

<strong>One-click deploy</strong>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbabysea-community%2Fbabychain&project-name=babychain&repository-name=babychain&env=NEXT_PUBLIC_SITE_URL,OWNER_EMAIL,OWNER_PASSWORD,OWNER_SESSION_SECRET,DATABASE_URL,BABYCHAIN_API_KEY,BABYCHAIN_CRON_SECRET,BABYCHAIN_CALLBACK_SECRET,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN,BABYCHAIN_PROVIDER_MODE,DASHSCOPE_API_KEY,BFL_API_KEY,BFL_REGION,BFL_API_BASE_URL,ARK_API_KEY,GEMINI_API_KEY,OPENAI_API_KEY,RUNWAYML_API_SECRET)

<br />

<img src="public/card.png" alt="BabyChain card" />

<br />

<img src="public/dashboard.png" alt="BabyChain dashboard" />

</div>

<br />

## BabySea OSS taxonomy

BabySea open source projects are organized into three categories:

[![BabySea OSS SDK](https://custom-icon-badges.demolab.com/badge/oss-sdk-7C3AED?style=for-the-badge&logo=babysea&logoColor=white)](#babysea-oss-taxonomy)
[![BabySea OSS Primitive](https://custom-icon-badges.demolab.com/badge/oss-primitive-EA580c?style=for-the-badge&logo=babysea&logoColor=white)](#babysea-oss-taxonomy)
[![BabySea OSS Starter](https://custom-icon-badges.demolab.com/badge/oss-starter-2563EB?style=for-the-badge&logo=babysea&logoColor=white)](#babysea-oss-taxonomy)

| Category      | Description                                                                                                                                       |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SDK**       | Typed developer entry points for creating, tracking, and managing BabySea workloads from application code.                                        |
| **Primitive** | Reusable infrastructure boundaries extracted from BabySea's execution control plane. Each primitive focuses on one system concern.                |
| **Starter**   | Deployable reference applications that combine product UI, auth, storage, and BabySea execution patterns. Some starters may also include billing. |

## Status

BabySea OSS projects are published into three status levels:

[![BabySea OSS Status Working](https://custom-icon-badges.demolab.com/badge/oss_status-working-DB2777?style=for-the-badge&logo=babysea&logoColor=white)](#status)
[![BabySea OSS Status Production](https://custom-icon-badges.demolab.com/badge/oss_status-production-C026D3?style=for-the-badge&logo=babysea&logoColor=white)](#status)
[![BabySea OSS Status Alpha](https://custom-icon-badges.demolab.com/badge/oss_status-alpha-D97706?style=for-the-badge&logo=babysea&logoColor=white)](#status)

| Status         | Description                                                                                                                                                                          |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Working**    | Fully implemented and deployable. All documented capabilities function as described. Suitable for personal and small-team use. No breaking-change guarantees between versions.       |
| **Production** | Working plus a hardened public runtime contract. Validated against a stated infrastructure stack with deterministic behavior, explicit failure modes, and a documented upgrade path. |
| **Alpha**      | Early-stage implementation. Core structure exists but some capabilities may be incomplete, undocumented, or subject to breaking changes. Not recommended for production deployments. |

See [`CHANGELOG.md`](CHANGELOG.md) to track releases and public contract changes.

---

## Overview

BabyChain is a visual studio for chaining generative media models, backed by a durable HTTP API. Owners compose multi-flow image → video chains on a canvas — every edit persists automatically to Aurora — and the exact same chain contract is callable from product code through authenticated API routes. There is no local model/GPU runtime requirement and no caller-side provider keys: deploy BabyChain, configure server-side credentials, design flows on the canvas, run them in place, and let products call the same durable API.

## Why BabyChain

BabyChain turns model-to-model media workflows into durable backend runs. Compose flows on the canvas or send one API request — either way BabyChain starts the chain, persists every step, hands generated media from one model to the next, and sends one signed callback when the final result is ready.

- **Multi-flow canvas studio**: run many independent image → video flows side by side on one permanent workspace. Every edit autosaves to Aurora and survives reloads, logout, and device switches; only an explicit reset clears it.
- **Run in place, save what matters**: each flow ends in a runner card — "Run only" streams step outputs onto the canvas; "Run and save" also snapshots the flow into the Library with its results.
- **Same contract for products**: the canvas drives `POST /api/v1/chains/runs` — the exact API your product code calls. Nothing is studio-only magic.
- **Self-hosted control plane**: deploy on Vercel with your own environment and secrets.
- **Server-side credentials**: keep inference provider keys or BabySea keys inside your backend. Caller apps only use BabyChain API keys.
- **Durable execution**: store run state, ordered steps, provider request ids, generation ids, outputs, callbacks, and failure details in Aurora.
- **Product-ready callbacks**: return a public run resource from create/get routes and send the same resource through one final signed webhook.
- **Schema-true node cards**: canvas fields are generated from each model's Semantic Lady schema — exact fields, enum options, ranges, and defaults — so the UI can never offer a parameter the run API would reject.

## BabyChain and canvas workflow tools

BabyChain has a canvas of its own, so the difference is not "canvas versus no canvas." The difference is where the workflow becomes production infrastructure. Local graph tools are strong creative workbenches. BabyChain is a deployable control plane: the canvas is a persistent, multi-flow studio on top of the same authenticated API, durable Aurora state, provider credentials, callbacks, and run timeline that product code uses.

| Area              | Canvas workflow tools                              | BabyChain                                                              |
| :---------------- | :------------------------------------------------- | :--------------------------------------------------------------------- |
| Primary interface | Canvas-first workflow authoring                    | Multi-flow canvas studio plus stable HTTP API for the same contract    |
| Runtime           | Desktop/local runtime or UI-managed cloud runtime  | Self-hosted Vercel deployment with Aurora-backed state                 |
| Persistence       | Workflow files, local state, or tool-specific jobs | Durable runs, ordered steps, request params, outputs, audit, callbacks |
| Model access      | Local model files or tool-specific provider nodes  | Server-side BYOK provider keys or BabySea key                          |
| Caller experience | Open UI, run graph, inspect outputs                | Compose/test in studio, then poll API or receive signed callback       |
| Production fit    | Creative iteration and workflow authoring          | Product backends, queues, retries, idempotency, auth, webhooks         |

Use BabyChain when a visual generative workflow is ready to become infrastructure: design and test visually, then expose a stable API contract that product code can call repeatedly without exposing inference credentials or asking every user to operate a model UI.

## Use cases

BabyChain runs workflow-driven chains for product backends that need generated media without embedding provider logic into every application. Common patterns include prompt-to-video features, image-to-video campaigns, avatar or product motion pipelines, internal media automation, and API products that need one stable callback after several provider calls.

The built-in `chain` template starts with an image model, runs an image-to-video model, and can optionally modify the video with a compatible video-to-video model. Select models under `input.chain_models`, then put each model request body inside `image_model_input`, `refine_model_input`, `video_model_input`, or `modify_model_input`. BabyChain does not flatten provider schema fields at the top level. In BabySea mode, those model input objects use BabySea-normalized `generation_*` fields. In BYOK mode, those model input objects use the selected provider model's raw schema fields from `GET /api/v1/models` or `GET /api/v1/models/{modelId}`. Add `refine_model` and `refine_model_input` when one image model should feed a second image model before video. Add `modify_model` and `modify_model_input` when the video result should feed a compatible video-to-video model. See [`SUPPORTED_MODELS.md`](SUPPORTED_MODELS.md) for the supported model names and mode availability.

| Chain   | Model input objects                                                                  | Model flow                                                      |
| :------ | :----------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `chain` | `image_model_input`, `video_model_input`                                             | image model → `image-to-video`                                  |
| `chain` | `image_model_input`, `refine_model_input`, `video_model_input`                       | image model → image model → `image-to-video`                    |
| `chain` | `image_model_input`, `video_model_input`, `modify_model_input`                       | image model → `image-to-video` → `video-to-video`               |
| `chain` | `image_model_input`, `refine_model_input`, `video_model_input`, `modify_model_input` | image model → image model → `image-to-video` → `video-to-video` |

## Architecture

```mermaid
flowchart LR
    subgraph Clients
        OWNER["Owner browser<br/>(canvas + library)"]
        APP["Product backends<br/>(API callers)"]
    end

    subgraph Vercel["Vercel (Next.js App Router)"]
        UI["/dashboard/*<br/>server components + actions"]
        API["/api/v1/chains/*<br/>/api/v1/models/*"]
        RUNNER["Chain runner<br/>(step orchestration,<br/>idempotency, callbacks)"]
        CRON["/api/cron/process-runs"]
    end

    subgraph AWS["AWS Aurora PostgreSQL — babychain_private"]
        RUNS[("chain_run / chain_step<br/>(durable run state)")]
        CANVAS[("canvas<br/>(saved node graphs)")]
        KEYS[("api_key / audit_event<br/>callback_delivery / babysea_webhook_delivery")]
    end

    subgraph Providers["Inference providers (server-side BYOK keys)"]
        BFL["Black Forest Labs"]
        RW["Runway"]
        ALI["Alibaba Cloud DashScope"]
        GGL["Google Gemini API"]
        OAI["OpenAI"]
        BP["BytePlus ARK"]
    end

    OWNER -->|owner session JWT| UI
    APP -->|Bearer API key| API
    UI -->|server actions| API
    UI <-->|save / load / delete| CANVAS
    API --> RUNNER
    CRON --> RUNNER
    RUNNER <-->|persist every step| RUNS
    API <-->|auth + audit| KEYS
    RUNNER -->|image / video generation| BFL & RW & ALI & GGL & OAI & BP
    RUNNER -->|one signed callback| APP
```

Aurora is the system of record: every run, step, output URL, API key hash, audit event, callback delivery, inbound BabySea webhook delivery, and saved canvas lives in the `babychain_private` schema. Vercel hosts the stateless control plane — any function instance can pick up a run mid-chain because all state round-trips through Aurora. Polling `GET /api/v1/chains/get/{runId}` (or the cron route) advances in-flight runs, so long chains survive serverless function time limits.

## Quickstart

Run locally:

```bash
git clone https://github.com/babysea-community/babychain.git
cd babychain
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Fill `.env.local` from [`.env.example`](.env.example) (at minimum `DATABASE_URL`, the `OWNER_*` dashboard credentials, the `BABYCHAIN_*` secrets, and one provider key for BYOK), apply the database schema, then start the app:

```bash
pnpm run aurora:migrate   # creates the babychain_private schema + tables
pnpm dev
```

Open <http://localhost:3011>. The owner dashboard lives at `/dashboard/canvas`; login with `OWNER_EMAIL` / `OWNER_PASSWORD`, build a chain on the canvas, and click **Run chain** to submit through the same `POST /api/v1/chains/runs` route used by API callers.

> `pnpm run aurora:migrate` reads `DATABASE_URL` from `.env.local` and applies [`scripts/aurora-migrate.mjs`](scripts/aurora-migrate.mjs). It is idempotent (`create … if not exists`), so it is safe to re-run after schema changes.

## Database (AWS Aurora / PostgreSQL)

BabyChain stores all durable runtime state — API keys, chain runs, ordered steps, saved canvases, webhook deliveries, callbacks, and audit events — in a private `babychain_private` schema on **AWS Aurora PostgreSQL**. `DATABASE_URL` is the only required database value.

```bash
# Aurora cluster writer endpoint (sslmode=require enables TLS)
DATABASE_URL=postgresql://USER:PASSWORD@CLUSTER.cluster-xxxx.REGION.rds.amazonaws.com:5432/postgres?sslmode=require
```

Aurora presents an Amazon RDS CA that is not in the Node.js trust store. For Aurora/RDS endpoints, include `?sslmode=require` in `DATABASE_URL` so the connection clearly requests TLS. BabyChain's pool strips `sslmode`/`ssl` query params and connects with TLS using `rejectUnauthorized: false`, so no manual CA bundle is required. To connect to a local PostgreSQL instead, point `DATABASE_URL` at `localhost` (TLS is auto-disabled for `localhost`/`127.0.0.1`).

### Quick start: create the cluster in the AWS Console

The fastest path is **RDS → Create database** in the AWS Console. These are the selections used by the BabyChain demo deployment. They create an Aurora PostgreSQL Serverless v2 cluster that works with the checked-in `pg` connection code after you allow network access to port `5432` and run `pnpm run aurora:migrate`.

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

### Provision Aurora PostgreSQL with VPC networking

The steps below create an Aurora PostgreSQL cluster reachable from your app (Vercel functions, a Codespace, or your laptop). Replace `REGION`, IDs, and the CIDR/IP placeholders.

**1. VPC and subnets.** Aurora must live in a VPC across at least two Availability Zones. The default VPC works; for production create a dedicated VPC (e.g. `10.0.0.0/16`) with two private subnets for the DB and (optionally) two public subnets for a bastion/NAT.

```bash
# Use the default VPC + its subnets, or note your own IDs:
aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text
aws ec2 describe-subnets --filters Name=vpc-id,Values=<VPC_ID> \
  --query 'Subnets[].SubnetId' --output text
```

**2. DB subnet group** (tells Aurora which subnets to span — needs ≥2 AZs):

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name babychain-subnets \
  --db-subnet-group-description "BabyChain Aurora subnets" \
  --subnet-ids <SUBNET_A> <SUBNET_B>
```

**3. Security group** (the VPC firewall). Open **TCP 5432** only to the sources that must reach the database:

```bash
aws ec2 create-security-group \
  --group-name babychain-aurora \
  --description "BabyChain Aurora Postgres access" \
  --vpc-id <VPC_ID>
# => returns <SG_ID>

# Allow Postgres from your app. For a fixed egress IP use a /32; for
# serverless platforms with dynamic IPs, scope to the VPC CIDR or use an
# RDS Proxy / PrivateLink instead of opening it publicly.
aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> --protocol tcp --port 5432 --cidr <YOUR_IP>/32
```

> Security: never leave `5432` open to `0.0.0.0/0` for a real deployment. Prefer a private subnet + RDS Proxy, AWS PrivateLink, or a bastion/VPN. `0.0.0.0/0` is acceptable only for a short-lived throwaway demo, and rotate the password afterward.

**4. Create the Aurora PostgreSQL cluster + a writer instance:**

```bash
aws rds create-db-cluster \
  --db-cluster-identifier babychain \
  --engine aurora-postgresql \
  --engine-version 16.4 \
  --master-username postgres \
  --master-user-password '<STRONG_PASSWORD>' \
  --db-subnet-group-name babychain-subnets \
  --vpc-security-group-ids <SG_ID> \
  --database-name postgres

aws rds create-db-instance \
  --db-instance-identifier babychain-1 \
  --db-cluster-identifier babychain \
  --engine aurora-postgresql \
  --db-instance-class db.serverless   # or db.r6g.large for provisioned
```

For **Aurora Serverless v2**, also set capacity on the cluster:

```bash
aws rds modify-db-cluster --db-cluster-identifier babychain \
  --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=4
```

**5. Public reachability (only if connecting from outside the VPC).** To reach Aurora from your laptop or a Codespace, the instance needs `--publicly-accessible`, the subnets need a route to an internet gateway, and your IP must be allowed in the security group (step 3). For Vercel/production, keep the cluster private and connect from within the VPC (VPC peering / PrivateLink) or via RDS Proxy.

**6. Get the writer endpoint and build `DATABASE_URL`:**

```bash
aws rds describe-db-clusters --db-cluster-identifier babychain \
  --query 'DBClusters[0].Endpoint' --output text
# DATABASE_URL=postgresql://postgres:<PASSWORD>@<ENDPOINT>:5432/postgres?sslmode=require
```

**7. Apply the schema:**

```bash
pnpm run aurora:migrate
```

> Aurora Serverless v2 can scale to zero / pause; the first connection after idle may take 10–30s to wake the cluster. BabyChain's pool uses a 30s connection timeout to absorb this cold start so the first run does not fail.

**Troubleshooting connectivity**

| Symptom                                                | Fix                                                                                                                                                                                                                                |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database "babychain" does not exist`                  | The cluster name is not always the PostgreSQL database name. If you used the AWS default database, connect to `/postgres`, not `/babychain`: `postgresql://USER:PASSWORD@WRITER-ENDPOINT:5432/postgres?sslmode=require`.           |
| `pnpm run aurora:migrate` times out or prints no error | The database is not reachable from your current runtime. Check public reachability and security-group inbound rules for TCP `5432`. From a local machine or Codespace, add your current public IP as `x.x.x.x/32`.                 |
| Vercel can’t load Library / Canvas after migration     | Standard Vercel egress IPs are dynamic. Without Vercel static egress/private networking, the quick demo option is a temporary inbound PostgreSQL rule from `0.0.0.0/0`. Do not use `All TCP`; expose only PostgreSQL port `5432`.  |
| You selected RDS Proxy but Vercel still cannot connect | RDS Proxy endpoints are normally private inside your VPC. They work for Lambda/ECS/EC2 or Vercel private networking, not for ordinary public Vercel functions. Use the Aurora writer endpoint unless private networking is set up. |
| `no pg_hba.conf entry` / TLS error                     | Keep `?sslmode=require` in `DATABASE_URL`; BabyChain handles the RDS CA automatically.                                                                                                                                             |
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
chain_run
chain_step
```

For a temporary public demo, the least-broad inbound rule is:

| Type       | Protocol | Port | Source      |
| :--------- | :------- | :--- | :---------- |
| PostgreSQL | TCP      | 5432 | `0.0.0.0/0` |

Remove that broad rule after the demo/judging window and replace it with static egress IPs, private networking, or an AWS runtime inside the VPC.

## Models and modes

Set `BABYCHAIN_PROVIDER_MODE=byok` for direct inference provider execution or `BABYCHAIN_PROVIDER_MODE=babysea` for BabySea SDK execution.

Supported model names and mode availability are listed in [`SUPPORTED_MODELS.md`](SUPPORTED_MODELS.md).

BabyChain supports two self-hosted provider modes:

| Mode      | What it means                                                                                                           |
| :-------- | :---------------------------------------------------------------------------------------------------------------------- |
| `byok`    | BabyChain calls supported inference providers directly with provider credentials from your server environment.          |
| `babysea` | BabyChain calls BabySea with your BabySea API key while keeping the same BabyChain routes, callbacks, and run contract. |

All modes keep caller applications on BabyChain API keys. Provider credentials never belong in frontend code or caller requests.

## API

| Action       | Method and path                      | Example                           |
| :----------- | :----------------------------------- | :-------------------------------- |
| List chains  | `GET /api/v1/chains`                 |                                   |
| Create chain | `POST /api/v1/chains/runs`           | [`chain`](docs/examples/chain.md) |
| Get run      | `GET /api/v1/chains/get/{runId}`     |                                   |
| Cancel run   | `POST /api/v1/chains/cancel/{runId}` |                                   |

Send caller requests with `Authorization: Bearer <caller API key>`, using a key configured from [`.env.example`](.env.example) or created in the private API key table. The linked chain example uses BabySea-normalized request params; BYOK callers should use the raw provider schema returned by the model schema routes. Run resources include a `timeline` array so callers can render ordered step status, timing, provider, output count, and error details without reshaping the `steps` payload. Actionable errors include a `guidance.what_to_try_next` list for common provider, model, credential, and chaining failures.

## Runtime

- Each invocation starts or polls one provider step.
- Step output URLs are supplied to dependent steps by BabyChain, while generated media is exposed in run and step responses.
- A configured `webhook_url` receives one final signed callback with the same public run resource returned by `GET /api/v1/chains/get/{runId}`.
- Provider credentials stay server-side.
- Step submit idempotency keys are deterministic per run, step, and chain version, helping retries avoid duplicate provider submits when the downstream provider honors idempotency.

## Tests

Provider adapter contract coverage lives with the provider adapter suite:

```bash
pnpm test:run -- test/provider-adapters.test.ts
```

The shared contract checks that each adapter returns zero-cost direct estimates and accepts best-effort cancel contexts. Provider-specific cases below it guard raw request mapping, output extraction, and failure normalization.

## Deployment

### Vercel

For free-plan, keep the checked-in settings: `maxDuration = 300` on long-running routes and the daily cron schedule in [`vercel.json`](vercel.json). For pro-plan, to implement one-minute recovery, change the cron schedule in [`vercel.json`](vercel.json) to `* * * * *`. Raise long-running route `maxDuration` values only where your Vercel plan supports the higher budget.

Set every value from [`.env.example`](.env.example) in the Vercel project (notably `DATABASE_URL`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_SESSION_SECRET`, and the `BABYCHAIN_*` secrets). Apply the schema once with `pnpm run aurora:migrate` (locally, pointed at the production `DATABASE_URL`) before the first deploy.

**Reaching Aurora from Vercel.** Vercel functions have dynamic egress IPs, so allowing a single IP in the Aurora security group is not reliable. Use one of:

- **RDS Proxy** in front of Aurora with a publicly resolvable endpoint, scoped by security group — recommended; it also pools connections for serverless functions.
- **AWS PrivateLink / VPC peering** to keep Aurora private and connect over private networking.
- A short-lived demo only: a publicly accessible cluster with the security group scoped to the VPC CIDR.

See [Database (AWS Aurora / PostgreSQL)](#database-aws-aurora--postgresql) above for the full VPC + security-group walkthrough.

## Customize

| Change     | Files                                                                                                   |
| :--------- | :------------------------------------------------------------------------------------------------------ |
| UI         | `app/page.tsx`, `app/dashboard/canvas/page.tsx`, `app/dashboard/canvas/canvas.tsx`                      |
| Chains     | `lib/chains/templates.ts`, `lib/chains/types.ts`, `test/templates.test.ts`                              |
| Runner     | `lib/chains/runner.ts`                                                                                  |
| Responses  | `lib/chains/presenters.ts`                                                                              |
| Auth       | `lib/api/auth.ts`, `lib/api/index.ts`, `scripts/aurora-migrate.mjs`                                     |
| Storage    | `lib/chains/store.ts`, `scripts/aurora-migrate.mjs`                                                     |
| Monitoring | `instrumentation.ts`, `instrumentation-client.ts`, `lib/monitoring`, `scripts/sentry-project-check.mjs` |
| Deploy     | `.env.example`, `vercel.json`, `scripts/doctor.mjs`                                                     |

## Troubleshooting

| Symptom                     | Fix                                                                                                                                                                                      |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doctor` fails              | Read the provider-mode summary, missing env var, or deploy file printed by `doctor`; env names live in [`.env.example`](.env.example).                                                   |
| Studio shows `fetch failed` | On Vercel, confirm `NEXT_PUBLIC_SITE_URL` is the deployed `https://...` URL and all required env vars pass `pnpm run doctor`. Locally, run with `pnpm dev` on port `3011` or set `PORT`. |
| Route returns 401           | Confirm the caller key exists in the bootstrap value from [`.env.example`](.env.example) or `babychain_private.api_key`.                                                                 |
| Route returns 404           | Compare the requested path with the API table above.                                                                                                                                     |
| Run stays queued            | Check provider credentials, webhook reachability, and scheduler execution.                                                                                                               |
| Callback is missing         | Check `webhook_url`, callback host DNS, receiver status codes, and callback delivery records.                                                                                            |

## Security and compliance

BabyChain publishes its trust signals through public GitLab and GitHub checks so contributors can inspect the actual CI configuration, jobs, and reports.

| Signal                      | Coverage                                                                                                                                                          |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitLab application security | SAST, Advanced SAST, IaC scanning, Dependency Scanning, Secret Detection, Code Quality, guarded Container Scanning, package audit, and redacted Gitleaks.         |
| Runtime scan                | Scheduled/manual GitLab DAST runs against the public demo target.                                                                                                 |
| License compliance          | Dependency license inventory is reviewed against [LICENSES.md](LICENSES.md); approval policies are deferred until the GitLab group has enough eligible reviewers. |
| Repository guards           | GitHub CodeQL, Package Check, Sentry Project Check, CircleCI, and Codecov stay public for cross-provider verification.                                            |

Container scanning is present in CI but only runs when `CS_IMAGE` is configured for a repository that publishes a container image.

## Community

BabyChain is an Apache-2.0 open-source starter in [`babysea-community/babychain`](https://github.com/babysea-community/babychain). Issues, pull requests, design discussion, and security reports should follow [`CONTRIBUTING.md`](CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), and [`SECURITY.md`](SECURITY.md).

## License

[Apache License 2.0](LICENSE). Use it, fork it, ship it.
