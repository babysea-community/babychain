import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireOwnerSession } from '@/lib/auth/owner';
import { getInternalApiBaseUrl } from '@/lib/api/internal-url';
import {
  getCanvas,
  getWorkspaceCanvas,
  recordWorkspaceFlowRun,
  renameCanvas,
  saveCanvas,
  saveWorkspaceCanvas,
  setCanvasLastRun,
  type SaveCanvasInput,
} from '@/lib/canvas/canvas-store';
import type { StoredCanvasNode } from '@/lib/canvas/canvas-library';
import { formatPublicModelName } from '@/lib/models/display';
import { listModelCatalog } from '@/lib/models/model-library';
import {
  getSemanticModelSchemaFields,
  isImageInputCapableModel,
  isImageToVideoChainModel,
  isVideoToVideoChainModel,
} from '@/lib/models/semantic-schema';
import { BabyChainError } from '@/lib/utils/errors';
import { getBabyChainApiKeys } from '@/lib/utils/env';

import { Canvas } from './canvas';
import type { FieldGroup, FieldSpec, CanvasModel, StepRole } from './canvas';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Canvas' };

const PROVIDER_LABELS: Record<string, string> = {
  'black-forest-labs': 'Black Forest Labs',
  'alibaba-cloud': 'Alibaba Cloud',
  byteplus: 'BytePlus',
  google: 'Google',
  openai: 'OpenAI',
  runway: 'Runway',
};

function rolesForModel(
  modelIdentifier: string,
  kind: 'image' | 'video',
): StepRole[] {
  if (kind === 'image') {
    const roles: StepRole[] = ['image'];
    if (isImageInputCapableModel(modelIdentifier)) {
      roles.push('refine');
    }
    return roles;
  }

  const roles: StepRole[] = [];
  if (isImageToVideoChainModel(modelIdentifier)) {
    roles.push('video');
  }
  if (isVideoToVideoChainModel(modelIdentifier)) {
    roles.push('modify');
  }
  return roles;
}

function listCanvasModels(): CanvasModel[] {
  const models: CanvasModel[] = [];
  for (const entry of listModelCatalog()) {
    const roles = rolesForModel(entry.modelIdentifier, entry.kind);
    if (roles.length === 0) {
      continue;
    }
    models.push({
      id: entry.modelIdentifier,
      label: formatPublicModelName(entry.modelIdentifier),
      provider: entry.provider,
      providerLabel: PROVIDER_LABELS[entry.provider] ?? entry.provider,
      kind: entry.kind,
      roles,
    });
  }
  return models.sort((a, b) => a.label.localeCompare(b.label));
}

// ----------------------------------------------------------------------------
// Field derivation
// ----------------------------------------------------------------------------
//
// Node cards are generated from the Semantic Lady schema of the selected
// model, so every field, enum option, numeric range, and default matches
// exactly what the run API validates. Both BYOK and BabySea modes speak the
// same normalized generation_* contract.

// File/object inputs are wired by the chain itself (each step receives the
// previous step's output), so they never render as node-card fields.
const SKIPPED_FIELD_TYPES = new Set([
  'url',
  'url-array',
  'object',
  'string-array',
]);

function semanticFieldSpec(field: {
  name: string;
  type: string;
  enum?: readonly (string | number)[];
  min?: number;
  max?: number;
  default?: unknown;
  required?: boolean;
}): FieldSpec | null {
  if (SKIPPED_FIELD_TYPES.has(field.type)) {
    return null;
  }

  const required = field.required === true;

  if (field.type === 'enum') {
    const options = (field.enum ?? []).map(String);
    if (options.length === 0) return null;
    // Pass through the model's own default verbatim. Only required enums
    // without a documented default fall back to the first option — optional
    // ones stay empty so the provider default applies.
    const fallback =
      typeof field.default === 'string' || typeof field.default === 'number'
        ? String(field.default)
        : required
          ? options[0]
          : undefined;
    return {
      name: field.name,
      type: 'select',
      options,
      ...(fallback !== undefined ? { default: fallback } : {}),
      ...(required ? { required } : {}),
    };
  }

  if (field.type === 'integer' || field.type === 'number') {
    return {
      name: field.name,
      type: 'number',
      ...(typeof field.min === 'number' ? { min: field.min } : {}),
      ...(typeof field.max === 'number' ? { max: field.max } : {}),
      ...(typeof field.default === 'number' ? { default: field.default } : {}),
      ...(required ? { required } : {}),
    };
  }

  if (field.type === 'boolean') {
    return {
      name: field.name,
      type: 'boolean',
      ...(typeof field.default === 'boolean' ? { default: field.default } : {}),
    };
  }

  if (field.type === 'string') {
    const isPrompt = field.name.endsWith('_prompt');
    return {
      name: field.name,
      type: isPrompt ? 'textarea' : 'text',
      ...(isPrompt ? { rows: 3 } : {}),
      ...(typeof field.default === 'string' ? { default: field.default } : {}),
      ...(required ? { required } : {}),
    };
  }

  return null;
}

function deriveSemanticFields(modelId: string): FieldGroup {
  const schema = getSemanticModelSchemaFields(modelId);

  if (!schema) {
    // Defensive fallback — every catalog model ships a Semantic Lady schema.
    return {
      core: [
        {
          name: 'generation_prompt',
          type: 'textarea',
          required: true,
          rows: 3,
        },
      ],
      advanced: [],
    };
  }

  const core: FieldSpec[] = [];
  const advanced: FieldSpec[] = [];

  for (const field of schema) {
    const spec = semanticFieldSpec(field);
    if (!spec) continue;
    (field.tier === 'advanced' ? advanced : core).push(spec);
  }

  // First-step image input: the run API accepts
  // image_model_input.generation_input_file (array of HTTPS URLs) so an
  // image-to-image-capable model can start the chain from an existing image.
  // Rendered only on image_model cards — refine/video/modify inputs are
  // chain-wired from the previous step and must not be user-supplied.
  if (isImageInputCapableModel(modelId)) {
    core.push({ name: 'generation_input_file', type: 'text' });
  }

  core.sort((a, b) =>
    a.name === 'generation_prompt'
      ? -1
      : b.name === 'generation_prompt'
        ? 1
        : 0,
  );

  return { core, advanced };
}

// ----------------------------------------------------------------------------
// Server actions (thin owner-gated proxies onto BabyChain's own API)
// ----------------------------------------------------------------------------

async function getModelFieldsAction(
  modelId: string,
  kind: 'image' | 'video',
): Promise<FieldGroup> {
  'use server';
  await requireOwnerSession();
  void kind;
  return deriveSemanticFields(modelId);
}

function siteUrl(): string {
  return getInternalApiBaseUrl();
}

function callerKey(): string {
  const key = getBabyChainApiKeys()[0];
  if (!key) {
    throw new Error('BABYCHAIN_API_KEY is not configured.');
  }
  return key;
}

async function runChainAction(
  input: Record<string, unknown>,
  canvasId?: string,
): Promise<{ ok: true; run: unknown } | { ok: false; error: string }> {
  'use server';
  const session = await requireOwnerSession();
  try {
    const response = await fetch(`${siteUrl()}/api/v1/chains/runs`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${callerKey()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ input }),
      cache: 'no-store',
    });
    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: extractError(json) };
    }
    // Link the run to its canvas server-side so the association survives
    // even if the browser tab closes before the response lands. Reopening
    // the canvas then resumes tracking this run.
    if (canvasId && typeof json.id === 'string') {
      await setCanvasLastRun(session.email, canvasId, json.id).catch(
        () => undefined,
      );
    }
    return { ok: true, run: json };
  } catch (error) {
    return {
      ok: false,
      error: formatCanvasActionError(error),
    };
  }
}

async function getRunAction(runId: string): Promise<unknown | null> {
  'use server';
  await requireOwnerSession();
  try {
    const response = await fetch(`${siteUrl()}/api/v1/chains/get/${runId}`, {
      headers: { authorization: `Bearer ${callerKey()}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function cancelRunAction(runId: string): Promise<unknown | null> {
  'use server';
  await requireOwnerSession();
  try {
    const response = await fetch(`${siteUrl()}/api/v1/chains/cancel/${runId}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${callerKey()}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function saveCanvasAction(
  input: SaveCanvasInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  'use server';
  const session = await requireOwnerSession();
  try {
    const saved = await saveCanvas(session.email, input);
    return { ok: true, id: saved.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof BabyChainError
          ? error.message
          : 'Saving the canvas failed. Try again.',
    };
  }
}

async function saveWorkspaceAction(
  nodes: StoredCanvasNode[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  'use server';
  const session = await requireOwnerSession();
  try {
    await saveWorkspaceCanvas(session.email, nodes);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof BabyChainError
          ? error.message
          : 'Saving the workspace failed. Try again.',
    };
  }
}

async function recordFlowRunAction(
  flowId: string,
  runId: string,
): Promise<void> {
  'use server';
  const session = await requireOwnerSession();
  await recordWorkspaceFlowRun(session.email, flowId, runId).catch(
    () => undefined,
  );
}

async function renameCanvasAction(
  canvasId: string,
  title: string,
): Promise<void> {
  'use server';
  const session = await requireOwnerSession();
  // Best effort: no-op when the flow has not been saved to the Library yet.
  await renameCanvas(session.email, canvasId, title).catch(() => undefined);
}

function extractError(json: Record<string, unknown>): string {
  const error = json.error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Run failed to start.';
}

function formatCanvasActionError(error: unknown): string {
  if (error instanceof TypeError && error.message === 'fetch failed') {
    return 'BabyChain API is not reachable from the canvas. On Vercel, check NEXT_PUBLIC_SITE_URL; locally, run the app on port 3011 or set PORT.';
  }

  return error instanceof Error ? error.message : 'Run failed.';
}

export async function CanvasPageView({ canvasId }: { canvasId?: string } = {}) {
  const session = await requireOwnerSession();
  const storedCanvas = canvasId
    ? await getCanvas(session.email, canvasId)
    : null;

  if (canvasId && !storedCanvas) {
    redirect('/dashboard/canvas');
  }

  // The base canvas page is the permanent workspace: its nodes and per-flow
  // run pointers come from the owner's workspace row in Aurora.
  const workspace = canvasId
    ? null
    : await getWorkspaceCanvas(session.email).catch(() => null);

  return (
    <>
      <Canvas
        canvasId={storedCanvas?.id}
        initialNodes={storedCanvas?.nodes ?? workspace?.nodes ?? null}
        initialRunId={storedCanvas?.lastRunId ?? null}
        initialFlowRuns={workspace?.flowRuns ?? null}
        models={listCanvasModels()}
        getModelFieldsAction={getModelFieldsAction}
        runChainAction={runChainAction}
        getRunAction={getRunAction}
        cancelRunAction={cancelRunAction}
        saveCanvasAction={saveCanvasAction}
        saveWorkspaceAction={saveWorkspaceAction}
        recordFlowRunAction={recordFlowRunAction}
        renameCanvasAction={renameCanvasAction}
      />
    </>
  );
}

export default async function CanvasPage() {
  return <CanvasPageView />;
}
