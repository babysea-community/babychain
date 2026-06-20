-- ============================================================================
-- BabyChain runtime schema for AWS Aurora (PostgreSQL)
-- AuroraChainStore performs the verify/claim logic directly in SQL.
-- ============================================================================

create extension if not exists pgcrypto;
create schema if not exists babychain_private;

create or replace function babychain_private.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists babychain_private.api_key (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  key_prefix varchar(12) not null,
  key_hash text not null,
  scopes text[] not null default array['chains:run','chains:read','runs:cancel']::text[],
  expires_at timestamptz,
  last_used_at timestamptz,
  rotated_at timestamptz,
  replaced_by uuid references babychain_private.api_key(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists babychain_private.chain_run (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references babychain_private.api_key(id) on delete set null,
  api_key_prefix text not null,
  chain_slug text not null,
  chain_version text not null,
  status text not null default 'queued' check (status in ('queued','running','awaiting_agent','succeeded','failed','canceled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  current_step_key text,
  callback_url text,
  callback_status text check (callback_status is null or callback_status in ('delivering','delivered','failed')),
  callback_claimed_at timestamptz,
  client_request_id text,
  idempotency_key_hash text,
  estimate jsonb,
  metadata jsonb not null default '{}'::jsonb,
  execution_config jsonb not null default '{"type":"self_control"}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  byok_credentials jsonb,
  input_order jsonb
);

create table if not exists babychain_private.chain_step (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references babychain_private.chain_run(id) on delete cascade,
  step_index integer not null check (step_index >= 0),
  step_key text not null,
  step_kind text not null check (step_kind in ('image','video')),
  model_identifier text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','canceled','skipped')),
  depends_on text[] not null default '{}',
  request_params jsonb,
  babysea_generation_id text,
  babysea_prediction_id text,
  babysea_request_id text,
  babysea_idempotency_replayed boolean,
  provider_order text[] not null default '{}',
  provider_used text,
  output_files text[] not null default '{}',
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_metadata jsonb,
  unique (run_id, step_index),
  unique (run_id, step_key)
);

create table if not exists babychain_private.chain_agent_checkpoint (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references babychain_private.chain_run(id) on delete cascade,
  step_key text not null,
  previous_step_key text not null,
  mode text not null check (mode in ('review','autopilot')),
  provider text not null check (provider in ('bedrock')),
  model_identifier text not null,
  status text not null default 'suggested' check (status in ('suggested','approved','applied','failed')),
  input_snapshot jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  selected_prompt text,
  selected_params jsonb,
  error_code text,
  error_message text,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, step_key)
);

create table if not exists babychain_private.babysea_webhook_delivery (
  id text primary key,
  event_type text not null,
  generation_id text,
  status text not null default 'processing' check (status in ('processing','processed','failed')),
  payload jsonb not null,
  claimed_at timestamptz,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists babychain_private.callback_delivery (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references babychain_private.chain_run(id) on delete cascade,
  status text not null check (status in ('delivered','failed')),
  status_code integer,
  response_text text,
  created_at timestamptz not null default now()
);

create table if not exists babychain_private.audit_event (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references babychain_private.api_key(id) on delete set null,
  run_id uuid references babychain_private.chain_run(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists babychain_private.canvas (
  id uuid primary key,
  owner_email text not null check (char_length(owner_email) between 3 and 320),
  title text not null check (char_length(title) between 1 and 200),
  nodes jsonb not null default '[]'::jsonb,
  run_id uuid,
  workspace boolean not null default false,
  flow_runs jsonb not null default '{}'::jsonb,
  save_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One permanent workspace canvas per owner (the /dashboard/canvas scratchpad).
create unique index if not exists idx_bc_canvas_workspace_owner
  on babychain_private.canvas (owner_email)
  where workspace;

create index if not exists idx_bc_api_key_prefix on babychain_private.api_key (key_prefix) where is_active = true;
create index if not exists idx_bc_run_status_created on babychain_private.chain_run (status, created_at);
create index if not exists idx_bc_run_api_key_created on babychain_private.chain_run (api_key_id, created_at desc);
create unique index if not exists idx_bc_run_idempotency on babychain_private.chain_run (
  coalesce(api_key_id, '00000000-0000-0000-0000-000000000000'::uuid), api_key_prefix, chain_slug, idempotency_key_hash
) where idempotency_key_hash is not null;
create index if not exists idx_bc_step_run_index on babychain_private.chain_step (run_id, step_index);
create index if not exists idx_bc_step_generation on babychain_private.chain_step (babysea_generation_id) where babysea_generation_id is not null;
create index if not exists idx_bc_agent_checkpoint_run_step on babychain_private.chain_agent_checkpoint (run_id, step_key);
create index if not exists idx_bc_agent_checkpoint_status on babychain_private.chain_agent_checkpoint (status, created_at);
create index if not exists idx_bc_callback_run on babychain_private.callback_delivery (run_id, created_at desc);
create index if not exists idx_bc_audit_run on babychain_private.audit_event (run_id, created_at desc);
create index if not exists idx_bc_canvas_owner_updated on babychain_private.canvas (owner_email, updated_at desc);
create index if not exists idx_bc_canvas_owner_created on babychain_private.canvas (owner_email, created_at desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bc_api_key_touch') then
    create trigger trg_bc_api_key_touch before update on babychain_private.api_key
      for each row execute function babychain_private.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_bc_run_touch') then
    create trigger trg_bc_run_touch before update on babychain_private.chain_run
      for each row execute function babychain_private.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_bc_step_touch') then
    create trigger trg_bc_step_touch before update on babychain_private.chain_step
      for each row execute function babychain_private.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_bc_agent_checkpoint_touch') then
    create trigger trg_bc_agent_checkpoint_touch before update on babychain_private.chain_agent_checkpoint
      for each row execute function babychain_private.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_bc_canvas_touch') then
    create trigger trg_bc_canvas_touch before update on babychain_private.canvas
      for each row execute function babychain_private.touch_updated_at();
  end if;
end $$;