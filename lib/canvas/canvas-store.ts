import 'server-only';

import { auroraQuery } from '@/lib/database/aurora';
import { deleteStoredAssets, type StoredAssetReference } from '@/lib/storage';
import { BabyChainError } from '@/lib/utils/errors';

import type { StoredCanvas, StoredCanvasNode } from './canvas-library';
import { normalizeCanvasTitle } from './names';

/**
 * Aurora-backed canvas persistence.
 *
 * Canvases are the saved node graphs from the dashboard canvas. They are
 * stored in AWS Aurora (PostgreSQL) so they survive logout, new devices, and
 * browser storage resets. Every query is scoped by `owner_email` from the
 * verified dashboard session — the id alone never grants access.
 */

const MAX_CANVASES_PER_OWNER = 200;
const MAX_NODES_PER_CANVAS = 24;
const MAX_NODES_JSON_BYTES = 64 * 1024;
// The workspace scratchpad holds many flows at once, so it gets more room
// than a saved (single-flow) canvas.
const MAX_WORKSPACE_NODES = 64;
const MAX_WORKSPACE_JSON_BYTES = 256 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CanvasRow = {
  id: string;
  title: string;
  nodes: unknown;
  last_run_id: string | null;
  save_version: number | string;
  created_at: Date;
  updated_at: Date;
};

export type SaveCanvasInput = {
  id: string;
  lastRunId?: string | null;
  title: string;
  nodes: StoredCanvasNode[];
  saveVersion: number;
};

export type CanvasResultPreview = {
  kind: 'image' | 'video';
  url: string;
};

export type CanvasLibraryItem = Omit<StoredCanvas, 'nodes'> & {
  modelIds: string[];
  resultPreviews: CanvasResultPreview[];
};

type CanvasListRow = {
  id: string;
  title: string;
  last_run_id: string | null;
  created_at: Date;
  updated_at: Date;
  model_ids: unknown;
  result_previews: unknown;
};

const MAX_RESULT_PREVIEWS = 4;

export async function listCanvases(
  ownerEmail: string,
): Promise<CanvasLibraryItem[]> {
  // The Library only renders model/inference badges and result previews, so
  // we never ship the full node graph here. Instead we reduce each canvas's
  // `nodes` to the list of model ids server-side (badges dedupe them) and let
  // every succeeded step output of the last run ride along (in step order,
  // capped at 4) so the card can show image → refine → video → modify, not
  // just the final pair.
  const result = await auroraQuery<CanvasListRow>(
    `select c.id, c.title, c.last_run_id, c.created_at, c.updated_at,
            (
              select coalesce(jsonb_agg(elem ->> 'modelId'), '[]'::jsonb)
                from jsonb_array_elements(
                       case when jsonb_typeof(c.nodes) = 'array'
                            then c.nodes else '[]'::jsonb end
                     ) as elem
               where elem ->> 'modelId' is not null
            ) as model_ids,
            previews.items as result_previews
       from babychain_private.canvas c
       left join lateral (
         select jsonb_agg(
                  jsonb_build_object('kind', p.step_kind, 'url', p.url)
                  order by p.step_index
                ) as items
           from (
             select s.step_kind, s.step_index, s.output_files[1] as url
               from babychain_private.chain_step s
              where s.run_id = c.last_run_id
                and s.status = 'succeeded'
                and cardinality(s.output_files) > 0
              order by s.step_index
              limit ${MAX_RESULT_PREVIEWS}
           ) p
       ) previews on true
      where c.owner_email = $1
        and not c.workspace
      order by c.created_at desc
      limit $2`,
    [normalizeOwnerEmail(ownerEmail), MAX_CANVASES_PER_OWNER],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lastRunId: row.last_run_id ?? null,
    modelIds: toModelIds(row.model_ids),
    resultPreviews: toResultPreviews(row.result_previews),
  }));
}

function toModelIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      ids.push(entry);
    }
  }
  return ids;
}

function toResultPreviews(value: unknown): CanvasResultPreview[] {
  if (!Array.isArray(value)) return [];

  const previews: CanvasResultPreview[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const kind = (entry as { kind?: unknown }).kind;
    const url = (entry as { url?: unknown }).url;
    if (
      (kind === 'image' || kind === 'video') &&
      typeof url === 'string' &&
      url.length > 0
    ) {
      previews.push({ kind, url });
    }
    if (previews.length >= MAX_RESULT_PREVIEWS) break;
  }
  return previews;
}

export async function getCanvas(
  ownerEmail: string,
  canvasId: string,
): Promise<StoredCanvas | null> {
  if (!UUID_PATTERN.test(canvasId)) {
    return null;
  }

  const result = await auroraQuery<CanvasRow>(
    `select id, title, nodes, last_run_id, save_version, created_at, updated_at
       from babychain_private.canvas
      where owner_email = $1 and id = $2 and not workspace`,
    [normalizeOwnerEmail(ownerEmail), canvasId],
  );

  const row = result.rows[0];
  return row ? toStoredCanvas(row) : null;
}

/**
 * The workspace canvas: one permanent, owner-scoped scratchpad row backing
 * /dashboard/canvas. It is never listed in the Library and is only emptied
 * by the explicit "Reset canvas" action (which overwrites it with the
 * default flow).
 */
export type WorkspaceCanvas = {
  nodes: StoredCanvasNode[];
  flowRuns: Record<string, string>;
};

export async function getWorkspaceCanvas(
  ownerEmail: string,
): Promise<WorkspaceCanvas | null> {
  const result = await auroraQuery<{ nodes: unknown; flow_runs: unknown }>(
    `select nodes, flow_runs
       from babychain_private.canvas
      where owner_email = $1 and workspace`,
    [normalizeOwnerEmail(ownerEmail)],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    nodes: Array.isArray(row.nodes) ? (row.nodes as StoredCanvasNode[]) : [],
    flowRuns: toFlowRuns(row.flow_runs),
  };
}

/**
 * When the owner's workspace came into existence: the creation time of the
 * earliest canvas row (workspace scratchpad or first saved canvas). Null
 * until the owner has used the canvas at least once.
 */
export async function getWorkspaceCreatedAt(
  ownerEmail: string,
): Promise<string | null> {
  const result = await auroraQuery<{ created_at: Date | null }>(
    `select min(created_at) as created_at
       from babychain_private.canvas
      where owner_email = $1`,
    [normalizeOwnerEmail(ownerEmail)],
  );

  const createdAt = result.rows[0]?.created_at;
  return createdAt ? createdAt.toISOString() : null;
}

export async function saveWorkspaceCanvas(
  ownerEmail: string,
  nodes: StoredCanvasNode[],
  saveVersion: number,
): Promise<void> {
  const owner = normalizeOwnerEmail(ownerEmail);
  const version = normalizeSaveVersion(saveVersion);

  if (!Array.isArray(nodes)) {
    throw new BabyChainError('invalid_canvas', 'Nodes must be an array.', 400);
  }

  if (nodes.length === 0) {
    throw new BabyChainError(
      'invalid_canvas',
      'Workspace must contain at least one node.',
      400,
    );
  }

  if (nodes.length > MAX_WORKSPACE_NODES) {
    throw new BabyChainError(
      'invalid_canvas',
      `Workspace must contain ${MAX_WORKSPACE_NODES} nodes or fewer.`,
      400,
    );
  }

  const sanitized = nodes.map(sanitizeNode);
  const serialized = JSON.stringify(sanitized);

  if (Buffer.byteLength(serialized, 'utf8') > MAX_WORKSPACE_JSON_BYTES) {
    throw new BabyChainError(
      'invalid_canvas',
      `Workspace content must be ${MAX_WORKSPACE_JSON_BYTES} bytes or smaller.`,
      400,
    );
  }

  // Prune run pointers for flows that no longer exist on the canvas.
  const flowIds = sanitized
    .map((node) => node.flowId)
    .filter((flowId): flowId is string => typeof flowId === 'string');

  await auroraQuery(
    `insert into babychain_private.canvas (id, owner_email, title, nodes, workspace, save_version)
     values (gen_random_uuid(), $1, 'Workspace', $2::jsonb, true, $4)
     on conflict (owner_email) where workspace do update
        set nodes = excluded.nodes,
            save_version = excluded.save_version,
            flow_runs = (
              select coalesce(
                jsonb_object_agg(entry.key, entry.value) filter (
                  where entry.key = any($3::text[])
                ),
                '{}'::jsonb
              )
              from jsonb_each(babychain_private.canvas.flow_runs) as entry
            )
      where babychain_private.canvas.save_version < excluded.save_version`,
    [owner, serialized, flowIds, version],
  );
}

export async function recordWorkspaceFlowRun(
  ownerEmail: string,
  flowId: string,
  runId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(runId) || !flowId || flowId.length > 64) {
    return false;
  }

  const result = await auroraQuery(
    `update babychain_private.canvas
        set flow_runs = flow_runs || jsonb_build_object($2::text, $3::text)
      where owner_email = $1 and workspace`,
    [normalizeOwnerEmail(ownerEmail), flowId, runId],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function saveCanvas(
  ownerEmail: string,
  input: SaveCanvasInput,
): Promise<StoredCanvas> {
  const owner = normalizeOwnerEmail(ownerEmail);
  const canvas = validateSaveInput(input);
  const saveVersion = normalizeSaveVersion(input.saveVersion);

  const countResult = await auroraQuery<{ total: string }>(
    `select count(*)::text as total
       from babychain_private.canvas
      where owner_email = $1 and id <> $2 and not workspace`,
    [owner, canvas.id],
  );

  if (Number(countResult.rows[0]?.total ?? 0) >= MAX_CANVASES_PER_OWNER) {
    throw new BabyChainError(
      'canvas_limit_reached',
      `Canvas library is full (${MAX_CANVASES_PER_OWNER} canvases). Delete a canvas before saving a new one.`,
      400,
    );
  }

  const result = await auroraQuery<CanvasRow>(
    `insert into babychain_private.canvas (id, owner_email, title, nodes, save_version, last_run_id)
     values ($1, $2, $3, $4::jsonb, $5, $6)
     on conflict (id) do update
        set title = excluded.title,
            nodes = excluded.nodes,
            save_version = excluded.save_version,
            last_run_id = coalesce(excluded.last_run_id, babychain_private.canvas.last_run_id)
      where babychain_private.canvas.owner_email = excluded.owner_email
        and not babychain_private.canvas.workspace
        and babychain_private.canvas.save_version < excluded.save_version
  returning id, title, nodes, last_run_id, save_version, created_at, updated_at`,
    [
      canvas.id,
      owner,
      canvas.title,
      JSON.stringify(canvas.nodes),
      saveVersion,
      canvas.lastRunId ?? null,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    const existing = await auroraQuery<CanvasRow>(
      `select id, title, nodes, last_run_id, save_version, created_at, updated_at
         from babychain_private.canvas
        where owner_email = $1 and id = $2 and not workspace`,
      [owner, canvas.id],
    );

    const existingRow = existing.rows[0];
    if (existingRow && Number(existingRow.save_version) >= saveVersion) {
      return toStoredCanvas(existingRow);
    }
  }

  // A conflicting id owned by someone else updates zero rows.
  if (!row) {
    throw new BabyChainError('canvas_not_found', 'Canvas was not found.', 404);
  }

  return toStoredCanvas(row);
}

export async function deleteCanvas(
  ownerEmail: string,
  canvasId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(canvasId)) {
    return false;
  }

  const result = await auroraQuery<{ last_run_id: string | null }>(
    `delete from babychain_private.canvas
      where owner_email = $1 and id = $2 and not workspace
      returning last_run_id`,
    [normalizeOwnerEmail(ownerEmail), canvasId],
  );

  const deleted = result.rows[0];

  if (!deleted) {
    return false;
  }

  // Reclaim the canvas's stored image/video files (S3 / Vercel Blob) for its
  // last run. The chain_run / chain_step history rows are intentionally left
  // in place — only the binary assets are removed. Cleanup is best-effort so a
  // storage hiccup never blocks the delete the owner already requested.
  if (deleted.last_run_id) {
    try {
      await deleteRunOutputAssets(deleted.last_run_id);
    } catch (error) {
      console.warn('[babychain] canvas asset cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        runId: deleted.last_run_id,
      });
    }
  }

  return true;
}

/**
 * Reclaims a run's stored output assets once no canvas still references it —
 * neither a saved canvas's last run nor a workspace flow pointer. This is the
 * storage-lifecycle guard that stops a superseded run from leaving orphaned
 * media behind, while never deleting assets for a run that is still shown
 * somewhere. The chain_run / chain_step history rows are untouched.
 */
async function reclaimRunAssetsIfOrphaned(
  owner: string,
  runId: string,
): Promise<void> {
  if (!UUID_PATTERN.test(runId)) {
    return;
  }

  const referenced = await auroraQuery<{ referenced: boolean }>(
    `select exists (
       select 1
         from babychain_private.canvas
        where owner_email = $1
          and (
            last_run_id = $2::uuid
            or exists (
              select 1
                from jsonb_each_text(flow_runs) as fr
               where fr.value = $2
            )
          )
     ) as referenced`,
    [owner, runId],
  );

  if (referenced.rows[0]?.referenced) {
    return;
  }

  await deleteRunOutputAssets(runId);
}

/**
 * Deletes the stored output assets for a run from the configured storage
 * provider, using the `babychain_storage` metadata recorded on each step when
 * the files were persisted. Inference-hosted outputs (no stored metadata) are
 * left untouched. The chain_step rows themselves are not modified.
 */
async function deleteRunOutputAssets(runId: string): Promise<void> {
  if (!UUID_PATTERN.test(runId)) {
    return;
  }

  const result = await auroraQuery<{ provider_metadata: unknown }>(
    `select provider_metadata
       from babychain_private.chain_step
      where run_id = $1
        and provider_metadata -> 'babychain_storage' is not null`,
    [runId],
  );

  const references = result.rows.flatMap((row) =>
    extractStoredAssetReferences(row.provider_metadata),
  );

  await deleteStoredAssets(references);
}

function extractStoredAssetReferences(value: unknown): StoredAssetReference[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const storage = (value as { babychain_storage?: unknown }).babychain_storage;
  if (!storage || typeof storage !== 'object') {
    return [];
  }

  const assets = (storage as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) {
    return [];
  }

  const references: StoredAssetReference[] = [];
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object') {
      continue;
    }

    const provider = (asset as { provider?: unknown }).provider;
    const storagePath = (asset as { storage_path?: unknown }).storage_path;

    if (
      (provider === 'aws-s3' || provider === 'vercel-blob') &&
      typeof storagePath === 'string' &&
      storagePath.length > 0
    ) {
      references.push({ provider, storagePath });
    }
  }

  return references;
}

/**
 * Renames a saved (Library) canvas. Returns false when the canvas does not
 * exist for this owner — callers treat rename as best-effort (the flow may
 * not have been saved yet).
 */
export async function renameCanvas(
  ownerEmail: string,
  canvasId: string,
  title: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(canvasId)) {
    return false;
  }

  const trimmed = normalizeCanvasTitle(title);
  if (!trimmed) {
    throw new BabyChainError(
      'invalid_canvas',
      'Canvas name cannot be empty.',
      400,
    );
  }

  const result = await auroraQuery(
    `update babychain_private.canvas
        set title = $3,
            nodes = (
              select coalesce(
                jsonb_agg(
                  case
                    when entry->>'id' like 'info\\_%'
                    then jsonb_set(entry, '{values,name}', to_jsonb($3::text))
                    else entry
                  end
                ),
                '[]'::jsonb
              )
              from jsonb_array_elements(nodes) as entry
            )
      where owner_email = $1 and id = $2 and not workspace`,
    [normalizeOwnerEmail(ownerEmail), canvasId, trimmed],
  );

  if ((result.rowCount ?? 0) === 0) {
    return false;
  }

  return true;
}

/**
 * Links the most recent chain run to a canvas so reloads and other tabs can
 * resume tracking it. The run itself lives in `chain_run`; this is only the
 * pointer.
 */
export async function setCanvasLastRun(
  ownerEmail: string,
  canvasId: string,
  runId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(canvasId) || !UUID_PATTERN.test(runId)) {
    return false;
  }

  const owner = normalizeOwnerEmail(ownerEmail);

  // Capture the run this canvas pointed at before the update. The two CTEs run
  // against the same snapshot, so `prev` reads the pre-update value even though
  // `updated` overwrites it — letting us reclaim a superseded run's media.
  const result = await auroraQuery<{
    previous_last_run_id: string | null;
    updated_count: number;
  }>(
    `with prev as (
       select last_run_id as previous_last_run_id
         from babychain_private.canvas
        where owner_email = $1 and id = $2 and not workspace
     ),
     updated as (
       update babychain_private.canvas
          set last_run_id = $3
        where owner_email = $1 and id = $2 and not workspace
        returning id
     )
     select prev.previous_last_run_id,
            (select count(*) from updated)::int as updated_count
       from prev`,
    [owner, canvasId, runId],
  );

  const row = result.rows[0];

  if (!row || Number(row.updated_count) === 0) {
    return false;
  }

  // Enterprise storage lifecycle: a saved canvas only ever shows its latest
  // run, so the run it just replaced is no longer reachable from here. If no
  // other canvas (or the workspace's flow pointers) still references it, its
  // stored image/video files are now orphaned — reclaim them. The chain_run /
  // chain_step history rows are kept; only the binary assets are removed.
  const previousRunId = row.previous_last_run_id;

  if (previousRunId && previousRunId !== runId) {
    try {
      await reclaimRunAssetsIfOrphaned(owner, previousRunId);
    } catch (error) {
      console.warn('[babychain] superseded run asset cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        runId: previousRunId,
      });
    }
  }

  return true;
}

function validateSaveInput(input: SaveCanvasInput): SaveCanvasInput {
  if (!UUID_PATTERN.test(input.id)) {
    throw new BabyChainError(
      'invalid_canvas',
      'Canvas id must be a UUID.',
      400,
    );
  }

  const title = normalizeCanvasTitle(input.title) || 'Canvas';
  const lastRunId = input.lastRunId ?? null;

  if (lastRunId !== null && !UUID_PATTERN.test(lastRunId)) {
    throw new BabyChainError(
      'invalid_canvas',
      'Canvas last run id must be a UUID.',
      400,
    );
  }

  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    throw new BabyChainError(
      'invalid_canvas',
      'Canvas must contain at least one node.',
      400,
    );
  }

  if (input.nodes.length > MAX_NODES_PER_CANVAS) {
    throw new BabyChainError(
      'invalid_canvas',
      `Canvas must contain ${MAX_NODES_PER_CANVAS} nodes or fewer.`,
      400,
    );
  }

  const nodes = input.nodes.map(sanitizeNode);
  const serialized = JSON.stringify(nodes);

  if (Buffer.byteLength(serialized, 'utf8') > MAX_NODES_JSON_BYTES) {
    throw new BabyChainError(
      'invalid_canvas',
      `Canvas content must be ${MAX_NODES_JSON_BYTES} bytes or smaller.`,
      400,
    );
  }

  return {
    id: input.id,
    lastRunId,
    nodes,
    saveVersion: input.saveVersion,
    title,
  };
}

function normalizeSaveVersion(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BabyChainError(
      'invalid_canvas',
      'Canvas save version must be a positive safe integer.',
      400,
    );
  }

  return value;
}

function sanitizeNode(node: StoredCanvasNode): StoredCanvasNode {
  if (
    !node ||
    typeof node !== 'object' ||
    typeof node.id !== 'string' ||
    typeof node.role !== 'string' ||
    typeof node.modelId !== 'string'
  ) {
    throw new BabyChainError(
      'invalid_canvas',
      'Canvas nodes must include id, role, and modelId.',
      400,
    );
  }

  const values: StoredCanvasNode['values'] = {};

  for (const [key, value] of Object.entries(node.values ?? {})) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      values[key] = value;
    }
  }

  return {
    id: node.id.slice(0, 80),
    role: node.role.slice(0, 40),
    modelId: node.modelId.slice(0, 200),
    ...(typeof node.flowId === 'string' && node.flowId
      ? { flowId: node.flowId.slice(0, 64) }
      : {}),
    values,
    position: {
      x: finiteNumber(node.position?.x),
      y: finiteNumber(node.position?.y),
    },
  };
}

function toFlowRuns(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const runs: Record<string, string> = {};
  for (const [key, runId] of Object.entries(value)) {
    if (typeof runId === 'string' && UUID_PATTERN.test(runId)) {
      runs[key] = runId;
    }
  }
  return runs;
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeOwnerEmail(ownerEmail: string): string {
  const normalized = ownerEmail.trim().toLowerCase();

  if (!normalized) {
    throw new BabyChainError(
      'unauthorized',
      'Canvas access requires an authenticated owner session.',
      401,
    );
  }

  return normalized;
}

function toStoredCanvas(row: CanvasRow): StoredCanvas {
  return {
    id: row.id,
    title: row.title,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lastRunId: row.last_run_id ?? null,
    nodes: Array.isArray(row.nodes) ? (row.nodes as StoredCanvasNode[]) : [],
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
