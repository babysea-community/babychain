import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../lib/database/schema.sql', import.meta.url),
  'utf8',
);

describe('Aurora migration', () => {
  it('keeps BabyChain runtime tables in a private schema', () => {
    expect(migration).toContain(
      'create schema if not exists babychain_private;',
    );
    expect(migration).not.toMatch(/create table if not exists public\./i);
  });

  it('creates the BabyChain runtime tables', () => {
    expect(migration).toContain(
      'create table if not exists babychain_private.api_key',
    );
    expect(migration).toContain(
      'create table if not exists babychain_private.chain_run',
    );
    expect(migration).toContain(
      'create table if not exists babychain_private.chain_step',
    );
    expect(migration).toContain('babysea_request_id text');
  });

  it('stores a JSONB-safe sidecar for public input key order', () => {
    expect(migration).toContain('input_order jsonb');
  });

  it('includes BYOK provider runtime fields in the fresh schema', () => {
    expect(migration).toContain('byok_credentials jsonb');
    expect(migration).toContain('provider_metadata jsonb');
  });

  it('creates the owner-scoped canvas table', () => {
    expect(migration).toContain(
      'create table if not exists babychain_private.canvas',
    );
    expect(migration).toContain('owner_email text not null');
    expect(migration).toContain('idx_bc_canvas_owner_updated');
    expect(migration).toContain('idx_bc_canvas_owner_created');
    expect(migration).toContain('trg_bc_canvas_touch');
    expect(migration).toContain(
      'alter table babychain_private.canvas add column if not exists last_run_id uuid',
    );
  });

  it('supports the permanent workspace canvas', () => {
    expect(migration).toContain('workspace boolean not null default false');
    expect(migration).toContain("flow_runs jsonb not null default '{}'");
    expect(migration).toContain('idx_bc_canvas_workspace_owner');
  });
});
