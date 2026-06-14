'use client';

import '@xyflow/react/dist/style.css';

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import type {
  ComponentType,
  SVGProps,
  WheelEvent as ReactWheelEvent,
} from 'react';

import { FontAwesomeIcon } from '@/components/icons/font-awesome-icon';
import {
  InlineAlibabaCloud as InlineInferenceAlibabaCloud,
  InlineBlackForestLabsLight as InlineInferenceBlackForestLabsLight,
  InlineBytePlus as InlineInferenceBytePlus,
  InlineGoogle as InlineInferenceGoogle,
  InlineOpenAILight as InlineInferenceOpenAILight,
  InlineRunwayLight as InlineInferenceRunwayLight,
} from '@/components/icons/inline-inference';
import {
  InlineBlackForestLabsLight as InlineModelBlackForestLabsLight,
  InlineByteDance as InlineModelByteDance,
  InlineGoogle as InlineModelGoogle,
  InlineHappyHorseLight as InlineModelHappyHorseLight,
  InlineOpenAILight as InlineModelOpenAILight,
  InlineQwen as InlineModelQwen,
  InlineRunwayLight as InlineModelRunwayLight,
  InlineWan as InlineModelWan,
  InlineZImage as InlineModelZImage,
} from '@/components/icons/inline-model';
import { Button } from '@/components/ui/button';
import {
  createCanvasId,
  type StoredCanvasNode,
} from '@/lib/canvas/canvas-library';
import {
  createDefaultCanvasName,
  MAX_CANVAS_TITLE_LENGTH,
  normalizeCanvasTitle,
} from '@/lib/canvas/names';
import { cn } from '@/lib/utils';

type ModelIconKey =
  | 'black-forest-labs'
  | 'bytedance'
  | 'google'
  | 'happyhorse'
  | 'openai'
  | 'qwen'
  | 'runway'
  | 'wan'
  | 'z';

type InferenceIconKey =
  | 'alibaba-cloud'
  | 'black-forest-labs'
  | 'byteplus'
  | 'google'
  | 'openai'
  | 'runway';

const MODEL_ICONS: Record<
  ModelIconKey,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  'black-forest-labs': InlineModelBlackForestLabsLight,
  bytedance: InlineModelByteDance,
  google: InlineModelGoogle,
  happyhorse: InlineModelHappyHorseLight,
  openai: InlineModelOpenAILight,
  qwen: InlineModelQwen,
  runway: InlineModelRunwayLight,
  wan: InlineModelWan,
  z: InlineModelZImage,
};

const INFERENCE_ICONS: Record<
  InferenceIconKey,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  'alibaba-cloud': InlineInferenceAlibabaCloud,
  'black-forest-labs': InlineInferenceBlackForestLabsLight,
  byteplus: InlineInferenceBytePlus,
  google: InlineInferenceGoogle,
  openai: InlineInferenceOpenAILight,
  runway: InlineInferenceRunwayLight,
};

function modelIcon(modelId: string | undefined) {
  if (!modelId) return undefined;

  const iconKey = getModelIconKey(modelId);

  return iconKey ? MODEL_ICONS[iconKey] : undefined;
}

function getModelIconKey(modelId: string): ModelIconKey | null {
  const [namespace = ''] = modelId.split('/');

  if (namespace === 'bfl' || namespace === 'black-forest-labs') {
    return 'black-forest-labs';
  }

  if (namespace === 'bytedance' || namespace === 'byteplus') {
    return 'bytedance';
  }

  if (namespace === 'google') {
    return 'google';
  }

  if (namespace === 'happyhorse') {
    return 'happyhorse';
  }

  if (namespace === 'qwen') {
    return 'qwen';
  }

  if (namespace === 'gpt' || namespace === 'openai') {
    return 'openai';
  }

  if (namespace === 'runway') {
    return 'runway';
  }

  if (namespace === 'wan') {
    return 'wan';
  }

  if (namespace === 'z') {
    return 'z';
  }

  return null;
}

function inferenceIcon(provider: string | undefined) {
  if (!provider || !isInferenceIconKey(provider)) return undefined;

  return INFERENCE_ICONS[provider];
}

function isInferenceIconKey(value: string): value is InferenceIconKey {
  return value in INFERENCE_ICONS;
}

function handleDropdownWheel(event: ReactWheelEvent<HTMLDivElement>) {
  event.preventDefault();
  event.stopPropagation();

  const delta =
    event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * event.currentTarget.clientHeight
        : event.deltaY;

  event.currentTarget.scrollTop += delta;
}

// Custom model dropdown. A native <select> cannot render an SVG inside its
// <option> list, so this renders a button + popup so each option shows its
// model brand icon.
function ModelDropdown({
  options,
  value,
  disabled,
  onChange,
}: {
  options: CanvasModel[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value);
  const SelectedIcon = modelIcon(selected?.id);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as globalThis.Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="nodrag relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-full items-center gap-2 border border-border bg-input px-2.5 text-left text-xs text-foreground outline-none transition focus-visible:border-ring disabled:opacity-50"
      >
        {SelectedIcon ? (
          <SelectedIcon className="size-4 shrink-0" aria-hidden="true" />
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ?? 'Select a model'}
        </span>
        <FontAwesomeIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          icon="chevron-down"
        />
      </button>

      {open ? (
        <div
          className="nodrag nopan nowheel absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto overscroll-contain border border-border bg-card shadow-xl"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={handleDropdownWheel}
        >
          {options.map((option) => {
            const OptionIcon = modelIcon(option.id);
            const active = option.id === value;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition hover:bg-muted',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground',
                )}
              >
                {OptionIcon ? (
                  <OptionIcon className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="shrink-0 text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">
                  {option.providerLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FieldSelectDropdown({
  options,
  value,
  disabled,
  onChange,
}: {
  options: SelectOption[];
  value: FieldValue | undefined;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(
    (option) => String(option.value) === String(value ?? ''),
  );

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as globalThis.Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="nodrag relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((state) => !state)}
        className="flex h-8 w-full items-center gap-2 border border-border bg-input px-2.5 text-left text-xs text-foreground outline-none transition focus-visible:border-ring disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ?? 'Select'}
        </span>
        <FontAwesomeIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          icon="chevron-down"
        />
      </button>

      {open ? (
        <div
          className="nodrag nopan nowheel absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto overscroll-contain border border-border bg-card shadow-xl"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={handleDropdownWheel}
        >
          {options.map((option) => {
            const active = String(option.value) === String(value ?? '');

            return (
              <button
                type="button"
                key={`${option.label}:${String(option.value)}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center px-2.5 py-1.5 text-left text-xs transition hover:bg-muted',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Shared types (also imported by the app server page)
// ----------------------------------------------------------------------------

export type StepRole = 'image' | 'refine' | 'video' | 'modify';

export type FieldSpec = {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
  required?: boolean;
  default?: string | number | boolean;
  options?: SelectOption[];
  valueKind?: 'string' | 'number' | 'boolean' | 'string-array' | 'json';
  min?: number;
  max?: number;
  rows?: number;
};

export type FieldGroup = { core: FieldSpec[]; advanced: FieldSpec[] };

export type CanvasModel = {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
  kind: 'image' | 'video';
  roles: StepRole[];
};

type FieldValue = string | number | boolean;

type SelectOption = {
  label: string;
  value: FieldValue;
};

type RunStep = {
  step_key: string;
  status: string;
  generation_output_file?: string[];
};

type RunJson = {
  id: string;
  status: string;
  error_message?: string | null;
  steps?: RunStep[];
};

type CanvasProps = {
  canvasId?: string;
  initialTitle?: string | null;
  initialNodes?: StoredCanvasNode[] | null;
  initialRunId?: string | null;
  initialFlowRuns?: Record<string, string> | null;
  models: CanvasModel[];
  getModelFieldsAction: (
    modelId: string,
    kind: 'image' | 'video',
  ) => Promise<FieldGroup>;
  runChainAction: (
    input: Record<string, unknown>,
    canvasId?: string,
  ) => Promise<{ ok: true; run: unknown } | { ok: false; error: string }>;
  getRunAction: (runId: string) => Promise<unknown | null>;
  cancelRunAction: (runId: string) => Promise<unknown | null>;
  saveCanvasAction: (input: {
    id: string;
    title: string;
    nodes: StoredCanvasNode[];
    saveVersion: number;
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  saveWorkspaceAction: (
    nodes: StoredCanvasNode[],
    saveVersion: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  recordFlowRunAction: (flowId: string, runId: string) => Promise<boolean>;
  renameCanvasAction: (canvasId: string, title: string) => Promise<void>;
};

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const ROLE_RANK: Record<StepRole, number> = {
  image: 0,
  refine: 1,
  video: 2,
  modify: 3,
};
const ROLE_COLOR: Record<StepRole, string> = {
  image: '#f9a8d4',
  refine: '#67e8f9',
  video: '#c4b5fd',
  modify: '#fdba74',
};
const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);
const LIBRARY_CANVAS_ID_VALUE = 'library_canvas_id';

function kindForRole(role: StepRole): 'image' | 'video' {
  return role === 'image' || role === 'refine' ? 'image' : 'video';
}

function defaultValue(field: FieldSpec): FieldValue {
  if (field.default !== undefined) return field.default;
  // Optional fields without documented defaults stay empty so compact() drops
  // them and the provider applies its own default.
  return '';
}

function nodeNeedsSchemaNormalization(
  node: FlowNode,
  group: FieldGroup | undefined,
) {
  if (!group) return false;

  const fields = [...group.core, ...group.advanced];
  const known = new Set(fields.map((field) => field.name));

  for (const key of Object.keys(node.data.values)) {
    if (!known.has(key)) return true;
  }

  return fields.some((field) => node.data.values[field.name] === undefined);
}

function normalizeNodeValues(node: FlowNode, group: FieldGroup) {
  const fields = [...group.core, ...group.advanced];
  const known = new Set(fields.map((field) => field.name));
  const values: Record<string, FieldValue> = {};

  for (const [key, value] of Object.entries(node.data.values)) {
    if (known.has(key)) {
      values[key] = value;
    }
  }

  for (const field of fields) {
    if (values[field.name] === undefined) {
      values[field.name] = defaultValue(field);
    }
  }

  return { ...node, data: { ...node.data, values } };
}

function genId(role: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${role}_${rand}`;
}

function genFlowId(): string {
  return genId('flow');
}

const FLOW_X = 40;
const FLOW_COL_W = 520;
const FLOW_ROW_H = 980;

function snapshotNodes(nodes: FlowNode[]): StoredCanvasNode[] {
  // Runner cards are derived UI; info cards persist (they carry the flow's
  // canvas id + name).
  return nodes
    .filter((node) => node.type !== 'runner')
    .map((node) => ({
      id: node.id,
      role: node.data.role,
      modelId: node.data.modelId,
      flowId: node.data.flowId,
      values: node.data.values,
      position: node.position,
    }));
}

function restoreNodes(
  entries: StoredCanvasNode[],
  initialTitle?: string | null,
): FlowNode[] {
  // Defensive fallback for malformed stored nodes: treat missing flowId as one
  // flow instead of crashing the canvas.
  const fallbackFlowId = genFlowId();

  return entries
    .filter((entry) => entry && entry.id && entry.role)
    .map((entry) => {
      const type = entry.id.startsWith('info_') ? 'info' : 'model';
      const values = entry.values ?? {};

      return {
        id: entry.id,
        type,
        position: entry.position ?? { x: FLOW_X, y: 120 },
        data: {
          role: entry.role as StepRole,
          modelId: entry.modelId ?? '',
          flowId:
            typeof entry.flowId === 'string' && entry.flowId
              ? entry.flowId
              : fallbackFlowId,
          values:
            type === 'info' ? ensureInfoName(values, initialTitle) : values,
        },
      };
    });
}

function ensureInfoName(
  values: Record<string, FieldValue>,
  initialTitle?: string | null,
): Record<string, FieldValue> {
  const name = typeof values.name === 'string' ? values.name.trim() : '';
  if (name) return { ...values, name: normalizeCanvasTitle(name) };

  const savedTitle =
    typeof initialTitle === 'string' ? normalizeCanvasTitle(initialTitle) : '';

  return {
    ...values,
    name: savedTitle || createDefaultCanvasName(),
  };
}

/** Group model nodes by flow, each flow's nodes sorted by step rank. */
function flowsFrom(nodes: FlowNode[]): Map<string, FlowNode[]> {
  const flows = new Map<string, FlowNode[]>();
  for (const node of nodes) {
    if (node.type !== 'model') continue;
    const list = flows.get(node.data.flowId);
    if (list) {
      list.push(node);
    } else {
      flows.set(node.data.flowId, [node]);
    }
  }
  for (const list of flows.values()) {
    list.sort((a, b) => ROLE_RANK[a.data.role] - ROLE_RANK[b.data.role]);
  }
  return flows;
}

function needsFlowAuxReconcile(nodes: FlowNode[]) {
  const modelNodes = nodes.filter((node) => node.type === 'model');
  const auxById = new Map(
    nodes
      .filter((node) => node.type !== 'model')
      .map((node) => [node.id, node]),
  );
  const expectedAux = new Map<string, 'info' | 'runner'>();

  for (const [flowId, flowNodes] of flowsFrom(modelNodes)) {
    const first = flowNodes[0];
    const last = flowNodes[flowNodes.length - 1];
    if (!first || !last) continue;

    expectedAux.set(`info_${flowId}`, 'info');
    expectedAux.set(`runner_${flowId}`, 'runner');
  }

  if (auxById.size !== expectedAux.size) return true;

  for (const [id, type] of expectedAux) {
    if (auxById.get(id)?.type !== type) return true;
  }

  return false;
}

/** Re-place one flow's cards in rank order along its own row. */
function relayoutFlow(nodes: FlowNode[], flowId: string): FlowNode[] {
  const flowNodes = nodes
    .filter((node) => node.type === 'model' && node.data.flowId === flowId)
    .sort((a, b) => ROLE_RANK[a.data.role] - ROLE_RANK[b.data.role]);
  const rowY = Math.min(...flowNodes.map((node) => node.position.y));
  const positions = new Map(
    flowNodes.map((node, index) => [
      node.id,
      { x: FLOW_X + INFO_COL_W + index * FLOW_COL_W, y: rowY },
    ]),
  );
  // Info card leads the flow; the runner follows the last model card.
  positions.set(`info_${flowId}`, { x: FLOW_X, y: rowY });
  positions.set(`runner_${flowId}`, {
    x: FLOW_X + INFO_COL_W + flowNodes.length * FLOW_COL_W,
    y: rowY,
  });

  return nodes.map((node) =>
    positions.has(node.id)
      ? { ...node, position: positions.get(node.id)! }
      : node,
  );
}

function nextFlowY(nodes: FlowNode[]): number {
  if (nodes.length === 0) return 120;
  return Math.max(...nodes.map((node) => node.position.y)) + FLOW_ROW_H;
}

function flowName(nodes: FlowNode[], flowId?: string): string {
  const infoNode = nodes.find(
    (node) => node.type === 'info' && (!flowId || node.data.flowId === flowId),
  );
  const name = infoNode?.data.values.name;
  return typeof name === 'string' && name.trim()
    ? normalizeCanvasTitle(name)
    : createDefaultCanvasName();
}

function duplicateFlowName(name: string) {
  const base = normalizeCanvasTitle(name) || createDefaultCanvasName();
  const suffix = ' copy';

  if (base.length + suffix.length <= MAX_CANVAS_TITLE_LENGTH) {
    return `${base}${suffix}`;
  }

  return `${base.slice(0, MAX_CANVAS_TITLE_LENGTH - suffix.length)}${suffix}`;
}

function flowLibraryCanvasId(nodes: FlowNode[], flowId: string) {
  const infoNode = nodes.find(
    (node) => node.type === 'info' && node.data.flowId === flowId,
  );
  const value = infoNode?.data.values[LIBRARY_CANVAS_ID_VALUE];

  return typeof value === 'string' && value ? value : null;
}

function withFlowLibraryCanvasId(
  nodes: FlowNode[],
  flowId: string,
  libraryCanvasId: string,
) {
  return nodes.map((node) =>
    node.type === 'info' && node.data.flowId === flowId
      ? {
          ...node,
          data: {
            ...node.data,
            values: {
              ...node.data.values,
              [LIBRARY_CANVAS_ID_VALUE]: libraryCanvasId,
            },
          },
        }
      : node,
  );
}

// ----------------------------------------------------------------------------
// Node data + context
// ----------------------------------------------------------------------------

type NodeData = {
  role: StepRole;
  modelId: string;
  flowId: string;
  values: Record<string, FieldValue>;
  [key: string]: unknown;
};

const RUNNER_COLOR = '#8b95a8';
const INFO_COLOR = RUNNER_COLOR;
// Width reserved for the flow info card column: 280px card + the same 120px
// gap that separates model cards (FLOW_COL_W 520 − card 400) and the runner.
const INFO_COL_W = 400;

type FlowNode = Node<NodeData>;

type NodeStatus = { status: string; output?: string };

type FlowMeta = {
  roles: Set<StepRole>;
  autoName: string;
};

type CanvasContextValue = {
  models: CanvasModel[];
  fieldsByModel: Record<string, FieldGroup | undefined>;
  statusByNode: Record<string, NodeStatus | undefined>;
  runningFlowIds: ReadonlySet<string>;
  flowMeta: Record<string, FlowMeta | undefined>;
  flowCount: number;
  isSavedCanvas: boolean;
  updateModel: (id: string, modelId: string) => void;
  updateValue: (id: string, name: string, value: FieldValue) => void;
  removeNode: (id: string) => void;
  removeFlow: (flowId: string) => void;
  duplicateFlow: (flowId: string) => void;
  renameCanvas: (flowId: string, title: string) => void;
  addNodeToFlow: (flowId: string, role: StepRole) => void;
  runFlow: (flowId: string, save: boolean) => void;
  stopFlow: (flowId: string) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

function useCanvas(): CanvasContextValue {
  const value = useContext(CanvasContext);
  if (!value) {
    throw new Error('useCanvas outside provider');
  }
  return value;
}

// ----------------------------------------------------------------------------
// Field control
// ----------------------------------------------------------------------------

function FieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldSpec;
  value: FieldValue | undefined;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
}) {
  const base =
    'nodrag w-full border border-border bg-input px-2.5 text-xs text-foreground outline-none focus-visible:border-ring disabled:opacity-50';

  if (field.type === 'textarea') {
    return (
      <textarea
        className={cn(base, 'min-h-20 resize-y py-1.5')}
        rows={field.rows ?? 3}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <FieldSelectDropdown
        options={field.options ?? []}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        className={cn(base, 'h-8')}
        min={field.min}
        max={field.max}
        value={value === undefined || value === '' ? '' : Number(value)}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === '' ? '' : Number(event.target.value))
        }
      />
    );
  }
  if (field.type === 'boolean') {
    const checked = Boolean(value);
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'nodrag relative inline-flex h-6 w-11 items-center border transition',
          checked ? 'border-primary bg-primary/30' : 'border-border bg-input',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute size-4 transition',
            checked ? 'left-6 bg-primary' : 'left-1 bg-muted-foreground',
          )}
        />
      </button>
    );
  }
  return (
    <input
      className={cn(base, 'h-8')}
      value={String(value ?? '')}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function FieldRow({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldSpec;
  value: FieldValue | undefined;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[0.7rem] text-muted-foreground">
        {field.name}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </span>
      <FieldControl
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function NodeSchemaJsonBlock({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="max-h-80 overflow-auto border border-border bg-[#050505] p-3 font-mono text-[0.65rem] leading-5 text-[#f8fafc]">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

function createNodeSchemaJson({
  fields,
  modelId,
  modelLabel,
}: {
  fields: FieldSpec[];
  modelId: string;
  modelLabel: string;
}) {
  const required = fields
    .filter((field) => field.required)
    .map((field) => field.name);

  return {
    model: modelLabel,
    model_identifier: modelId,
    schema: {
      type: 'object',
      ...(required.length > 0 ? { required } : {}),
      properties: Object.fromEntries(
        fields.map((field, index) => [
          field.name,
          createNodeSchemaProperty(field, index),
        ]),
      ),
    },
  };
}

function createNodeSchemaProperty(field: FieldSpec, order: number) {
  const property: Record<string, unknown> = {
    type: jsonSchemaTypeForField(field),
    'x-order': order,
  };

  if (field.options?.length) {
    property.enum = field.options.map((option) => option.value);
  }

  if (field.default !== undefined) {
    property.default = field.default;
  }

  if (field.min !== undefined) {
    property.minimum = field.min;
  }

  if (field.max !== undefined) {
    property.maximum = field.max;
  }

  if (field.required) {
    property.required = true;
  }

  if (field.valueKind === 'string-array') {
    property.items = { type: 'string' };
  }

  return property;
}

function jsonSchemaTypeForField(field: FieldSpec) {
  if (field.valueKind === 'json') return 'object';
  if (field.valueKind === 'string-array') return 'array';
  if (field.valueKind === 'number') return 'number';
  if (field.valueKind === 'boolean') return 'boolean';
  return 'string';
}

// ----------------------------------------------------------------------------
// Media preview
// ----------------------------------------------------------------------------

function MediaPreview({ url, kind }: { url: string; kind: 'image' | 'video' }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return <MediaUnavailable kind={kind} />;
  }
  return (
    <div className="relative">
      {kind === 'video' ? (
        <video
          src={url}
          controls
          preload="metadata"
          onError={() => setFailed(true)}
          onLoadedMetadata={() => setLoaded(true)}
          // nodrag: without it ReactFlow treats the player as a drag handle —
          // grab cursor over the whole video and clicks on the controls drag
          // the card instead of playing/scrubbing.
          className="nodrag aspect-video w-full cursor-auto bg-black object-contain"
        />
      ) : (
        <img
          src={url}
          alt="output"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          className="aspect-video w-full bg-black object-contain"
        />
      )}
      {/* Until the media loads, cover the slot (and the browser's alt text /
          blank frame) with an explicit loading state. */}
      {!loaded ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black text-muted-foreground">
          <FontAwesomeIcon className="size-4 animate-spin" icon="spinner" />
          <span className="text-[0.65rem] leading-4">Loading…</span>
        </div>
      ) : null}
    </div>
  );
}

// Provider delivery URLs expire (inference providers remove outputs after a
// retention window). Show a media-kind icon instead of a broken element.
function MediaUnavailable({
  kind,
  className,
}: {
  kind: 'image' | 'video';
  className?: string;
}) {
  const icon = kind === 'video' ? 'video' : 'image';

  return (
    <div
      className={cn(
        'flex aspect-video w-full flex-col items-center justify-center gap-1.5 bg-black text-muted-foreground',
        className,
      )}
    >
      <FontAwesomeIcon className="size-5" icon={icon} />
      <span className="px-2 text-center text-[0.65rem] leading-4">
        Removed by inference provider
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Custom node
// ----------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  canceled: 'Canceled',
  skipped: 'Skipped',
};

function ModelNodeComponent({ id, data }: NodeProps) {
  const node = data as NodeData;
  const { role, modelId, values, flowId } = node;
  const {
    models,
    fieldsByModel,
    statusByNode,
    runningFlowIds,
    flowMeta,
    isSavedCanvas,
    updateModel,
    updateValue,
    removeNode,
    addNodeToFlow,
  } = useCanvas();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const kind = kindForRole(role);
  const color = ROLE_COLOR[role];
  const options = models.filter((model) => model.roles.includes(role));
  const model = models.find((entry) => entry.id === modelId);
  const liveGroup = fieldsByModel[modelId];
  const nodeStatus = statusByNode[id];
  const HeaderIcon = inferenceIcon(model?.provider);
  const meta = flowMeta[flowId];
  const running = runningFlowIds.has(flowId);
  const addableRole: StepRole | null =
    role === 'image' && !meta?.roles.has('refine')
      ? 'refine'
      : role === 'video' && !meta?.roles.has('modify')
        ? 'modify'
        : null;

  // Keep the last loaded field group visible while a newly selected model's
  // schema loads, so the card does not collapse to a "Loading" box and jump.
  const [stickyGroup, setStickyGroup] = useState(liveGroup);
  useEffect(() => {
    if (liveGroup) setStickyGroup(liveGroup);
  }, [liveGroup]);
  const group = liveGroup ?? stickyGroup;
  const loading = !liveGroup;

  return (
    <div className="group relative w-[400px] border border-border bg-card shadow-lg">
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
      {/* Every model card receives a rope — image_model from the flow's
          canvas_flow card, later steps from the previous model card. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background"
        style={{ backgroundColor: color }}
      />
      {/* Every model card connects forward — to the next step or to the
          flow's runner card — so all roles render a source handle. */}
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background"
        style={{ backgroundColor: color }}
      />

      {/* Touching the node line reveals the next optional step for this
          flow: refine after image, modify after video. */}
      {addableRole && !running && !isSavedCanvas ? (
        <button
          type="button"
          onClick={() => addNodeToFlow(flowId, addableRole)}
          className="nodrag absolute right-0 top-1/2 z-10 flex -translate-y-1/2 translate-x-[calc(100%+14px)] items-center gap-1 border border-border bg-card px-2 py-1 text-[0.65rem] font-medium text-muted-foreground opacity-0 shadow-lg transition hover:border-ring hover:text-foreground group-hover:opacity-100"
          style={{ borderLeftColor: ROLE_COLOR[addableRole] }}
        >
          <FontAwesomeIcon className="size-3" icon="plus" />
          {addableRole}_model
        </button>
      ) : null}

      {/* Section 1: card name + status badge, vertically centered */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="font-mono text-xs font-semibold" style={{ color }}>
          {role}_model
        </div>
        <div className="flex items-center gap-1.5">
          {nodeStatus ? (
            <span
              className={cn(
                'border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide',
                nodeStatus.status === 'succeeded' &&
                  'border-chart-3 text-chart-3',
                nodeStatus.status === 'failed' &&
                  'border-destructive text-destructive',
                nodeStatus.status === 'running' &&
                  'border-primary text-primary animate-pulse',
                (nodeStatus.status === 'queued' ||
                  nodeStatus.status === 'skipped' ||
                  nodeStatus.status === 'canceled') &&
                  'border-border text-muted-foreground',
              )}
            >
              {STATUS_LABELS[nodeStatus.status] ?? nodeStatus.status}
            </span>
          ) : null}
          {/* image_model and video_model are always required, so they have no
              delete control. refine_model and modify_model are optional. */}
          {role === 'refine' || role === 'modify' ? (
            <span className="group/remove relative">
              <button
                type="button"
                aria-label="Remove"
                disabled={running || isSavedCanvas}
                onClick={() => removeNode(id)}
                className="nodrag flex size-6 items-center justify-center border border-transparent text-muted-foreground transition hover:border-border hover:text-destructive disabled:opacity-40"
              >
                <FontAwesomeIcon className="size-3" icon="trash" />
              </button>
              {isSavedCanvas ? (
                <span className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-56 border border-border bg-card px-2.5 py-1.5 text-center text-[0.65rem] leading-4 text-foreground shadow-xl group-hover/remove:block">
                  Saved canvases keep their structure. Edit this flow on the
                  Canvas page instead.
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      {/* Section 2: inference provider name, its own separated section */}
      {model ? (
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-[0.65rem] text-muted-foreground">
          {HeaderIcon ? (
            <HeaderIcon className="size-3.5" aria-hidden="true" />
          ) : null}
          {model.providerLabel}
        </div>
      ) : null}

      {/* Section 3: model select + schema fields */}
      <div className="space-y-3 p-3">
        <div className="grid gap-1">
          <span className="font-mono text-[0.7rem] text-muted-foreground">
            model
          </span>
          <ModelDropdown
            options={options}
            value={modelId}
            disabled={running}
            onChange={(next) => updateModel(id, next)}
          />
        </div>

        {!group ? (
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
            <FontAwesomeIcon className="size-3.5 animate-spin" icon="spinner" />
            Loading schema…
          </div>
        ) : (
          <>
            {loading ? (
              <div className="h-0.5 w-full overflow-hidden bg-border">
                <div className="h-full w-1/3 animate-pulse bg-primary" />
              </div>
            ) : null}
            <div className="border border-border">
              <button
                type="button"
                aria-expanded={schemaOpen}
                onClick={() => setSchemaOpen((open) => !open)}
                className="nodrag flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left font-mono text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
              >
                <span>JSON Schema</span>
                <FontAwesomeIcon
                  className={cn(
                    'size-3.5 transition-transform',
                    schemaOpen && 'rotate-180',
                  )}
                  icon="chevron-down"
                />
              </button>
              {schemaOpen ? (
                <div className="border-t border-border p-2.5">
                  <NodeSchemaJsonBlock
                    value={createNodeSchemaJson({
                      fields: [...group.core, ...group.advanced].filter(
                        (field) => shouldRenderFieldForRole(field, role),
                      ),
                      modelId,
                      modelLabel: model?.label ?? modelId,
                    })}
                  />
                </div>
              ) : null}
            </div>
            {group.core
              .filter((field) => shouldRenderFieldForRole(field, role))
              .map((field) => (
                <FieldRow
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  disabled={running}
                  onChange={(value) => updateValue(id, field.name, value)}
                />
              ))}

            {group.advanced.length > 0 ? (
              <div className="border border-border">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((open) => !open)}
                  className="nodrag flex w-full items-center justify-between px-2.5 py-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
                >
                  <span>Advanced · {group.advanced.length}</span>
                  <FontAwesomeIcon
                    className={cn(
                      'size-3.5 transition-transform',
                      advancedOpen && 'rotate-180',
                    )}
                    icon="chevron-down"
                  />
                </button>
                {advancedOpen ? (
                  <div className="space-y-3 border-t border-border p-2.5">
                    {group.advanced
                      .filter((field) => shouldRenderFieldForRole(field, role))
                      .map((field) => (
                        <FieldRow
                          key={field.name}
                          field={field}
                          value={values[field.name]}
                          disabled={running}
                          onChange={(value) =>
                            updateValue(id, field.name, value)
                          }
                        />
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        {nodeStatus?.output ? (
          <div className="border border-border">
            {/* Key by URL so a new run's output restarts the loading state
                instead of inheriting the previous result's. */}
            <MediaPreview
              key={nodeStatus.output}
              url={nodeStatus.output}
              kind={kind}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Dedicated per-flow runner card, rendered as the last node of every flow.
// It is derived from the flow (never persisted) and carries the run
// controls: "Run only" executes in place; "Run and save" also publishes the
// flow to the Library.
function RunnerNodeComponent({ data }: NodeProps) {
  const { flowId } = data as NodeData;
  const {
    runningFlowIds,
    runFlow,
    stopFlow,
    removeFlow,
    duplicateFlow,
    flowCount,
    isSavedCanvas,
  } = useCanvas();
  const running = runningFlowIds.has(flowId);
  // The last flow on the workspace cannot be removed (Reset canvas is the
  // explicit wipe), and saved canvases are deleted from the Library instead.
  const removeDisabledReason = isSavedCanvas
    ? 'Remove this canvas flow from its card in the Library page.'
    : flowCount <= 1
      ? 'You cannot remove the last canvas flow.'
      : null;

  return (
    <div className="w-[280px] border border-border bg-card shadow-lg">
      <div className="h-1.5 w-full" style={{ backgroundColor: RUNNER_COLOR }} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background"
        style={{ backgroundColor: RUNNER_COLOR }}
      />

      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div
          className="font-mono text-xs font-semibold"
          style={{ color: RUNNER_COLOR }}
        >
          runner
        </div>
        {running ? (
          <span className="border border-primary px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-primary animate-pulse">
            Running
          </span>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <p className="text-[0.65rem] leading-4 text-muted-foreground">
          {isSavedCanvas
            ? 'Run only tests this flow without changing what is saved. Run and save overwrites this canvas with the new results.'
            : 'Run only keeps results here. Run and save publishes this flow to the Library, then updates the same card on later runs.'}
        </p>
        <Button
          className="nodrag w-full"
          size="sm"
          variant="outline"
          disabled={running}
          onClick={() => runFlow(flowId, false)}
        >
          <FontAwesomeIcon icon="play" />
          Run only
        </Button>
        <Button
          className="nodrag w-full"
          size="sm"
          disabled={running}
          onClick={() => runFlow(flowId, true)}
        >
          <FontAwesomeIcon icon="floppy-disk" />
          Run and save
        </Button>
        <span className="group relative block">
          <Button
            className="nodrag w-full"
            size="sm"
            variant="outline"
            disabled={running || isSavedCanvas}
            onClick={() => duplicateFlow(flowId)}
          >
            <FontAwesomeIcon icon="copy" />
            Duplicate
          </Button>
          {isSavedCanvas ? (
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-60 -translate-x-1/2 border border-border bg-card px-2.5 py-1.5 text-center text-[0.65rem] leading-4 text-foreground shadow-xl group-hover:block">
              Duplicate flows from the workspace canvas.
            </span>
          ) : null}
        </span>
        {running ? (
          <Button
            className="nodrag w-full"
            size="sm"
            variant="destructive"
            onClick={() => stopFlow(flowId)}
          >
            <FontAwesomeIcon icon="square" />
            Stop
          </Button>
        ) : null}
        <span className="group relative block">
          <Button
            className="nodrag w-full"
            size="sm"
            variant="ghost"
            disabled={running || removeDisabledReason !== null}
            onClick={() => removeFlow(flowId)}
          >
            <FontAwesomeIcon icon="trash" />
            Remove this flow
          </Button>
          {removeDisabledReason ? (
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-60 -translate-x-1/2 border border-border bg-card px-2.5 py-1.5 text-center text-[0.65rem] leading-4 text-foreground shadow-xl group-hover:block">
              {removeDisabledReason}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// Flow info card: the first card of every flow. It carries the flow's Library
// identity after publish, and the name (pencil to edit) becomes the Library
// title on "Run and save".
function InfoNodeComponent({ id, data }: NodeProps) {
  const node = data as NodeData;
  const { flowId, values } = node;
  const { flowMeta, updateValue, runningFlowIds, renameCanvas } = useCanvas();
  const running = runningFlowIds.has(flowId);
  const nameValue = typeof values.name === 'string' ? values.name : '';
  const autoName = flowMeta[flowId]?.autoName ?? 'Untitled canvas';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nameValue);

  const commit = () => {
    setEditing(false);
    const trimmed = normalizeCanvasTitle(draft);
    const title = trimmed || autoName;
    setDraft(title);
    updateValue(id, 'name', title);
    // Saved canvas pages use the route canvas id. Workspace flows that have
    // already been published carry their Library id on the info card, so a
    // later rename updates the Library card immediately too.
    renameCanvas(flowId, title);
  };

  return (
    <div className="w-[280px] border border-border bg-card shadow-lg">
      <div className="h-1.5 w-full" style={{ backgroundColor: INFO_COLOR }} />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background"
        style={{ backgroundColor: INFO_COLOR }}
      />

      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div
          className="font-mono text-xs font-semibold"
          style={{ color: INFO_COLOR }}
        >
          canvas_flow
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid gap-1">
          <span className="font-mono text-[0.7rem] text-muted-foreground">
            canvas_name
          </span>
          {editing ? (
            <input
              autoFocus
              maxLength={MAX_CANVAS_TITLE_LENGTH}
              className="nodrag h-8 w-full border border-border bg-input px-2.5 text-xs text-foreground outline-none focus-visible:border-ring"
              value={draft}
              placeholder={autoName}
              onChange={(event) =>
                setDraft(event.target.value.slice(0, MAX_CANVAS_TITLE_LENGTH))
              }
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
                if (event.key === 'Escape') {
                  setDraft(nameValue);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <div className="flex items-start justify-between gap-1.5">
              <p className="min-w-0 break-words text-xs leading-5 text-foreground">
                {nameValue || autoName}
              </p>
              <button
                type="button"
                aria-label="Rename canvas"
                disabled={running}
                onClick={() => {
                  setDraft(nameValue || autoName);
                  setEditing(true);
                }}
                className="nodrag flex size-6 shrink-0 cursor-pointer items-center justify-center border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground disabled:opacity-40"
              >
                <FontAwesomeIcon className="size-3" icon="pen-to-square" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ModelNode = memo(ModelNodeComponent);
const RunnerNode = memo(RunnerNodeComponent);
const InfoNode = memo(InfoNodeComponent);
const nodeTypes: NodeTypes = {
  model: ModelNode,
  runner: RunnerNode,
  info: InfoNode,
};

// ----------------------------------------------------------------------------
// Canvas
// ----------------------------------------------------------------------------

function compact(values: Record<string, FieldValue>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) output[key] = trimmed;
    } else if (typeof value === 'boolean') {
      // Booleans pass through as-is (true AND false) so a model's documented
      // default — e.g. moderation flags — reaches the provider unchanged.
      output[key] = value;
    } else {
      output[key] = value;
    }
  }
  return output;
}

function normalizeRunParams(
  params: Record<string, unknown>,
  group: FieldGroup | undefined,
) {
  if (!group) return params;

  const next = { ...params };
  const fields = [...group.core, ...group.advanced];

  for (const field of fields) {
    const value = next[field.name];

    if (value === undefined) {
      continue;
    }

    if (field.valueKind === 'number') {
      if (typeof value === 'number') continue;
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) {
        next[field.name] = numberValue;
      }
      continue;
    }

    if (field.valueKind === 'string-array') {
      next[field.name] = normalizeStringArrayValue(value);
      continue;
    }

    if (field.valueKind === 'json' && typeof value === 'string') {
      try {
        next[field.name] = JSON.parse(value);
      } catch {
        throw new Error(`${field.name} must be valid JSON.`);
      }
    }
  }

  return next;
}

function normalizeStringArrayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const CHAIN_WIRED_DOWNSTREAM_FIELDS = [
  'generation_input_file',
  'generation_input_file_last_content',
  'generation_input_image_file',
  'generation_input_image_file_last_content',
  'generation_input_video_file',
];

function shouldRenderFieldForRole(field: FieldSpec, role: StepRole) {
  return (
    role === 'image' || !CHAIN_WIRED_DOWNSTREAM_FIELDS.includes(field.name)
  );
}

function promptValue(values: Record<string, FieldValue>) {
  const value = values.generation_prompt;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function CanvasInner(props: CanvasProps) {
  const {
    canvasId,
    initialTitle,
    initialNodes,
    initialRunId,
    initialFlowRuns,
    models,
    getModelFieldsAction,
    runChainAction,
    getRunAction,
    cancelRunAction,
    saveCanvasAction,
    saveWorkspaceAction,
    recordFlowRunAction,
    renameCanvasAction,
  } = props;
  const saveToastIdRef = useRef<string | number | null>(null);

  const firstImage = models.find((model) => model.roles.includes('image'));
  const firstVideo = models.find((model) => model.roles.includes('video'));

  const buildDefaultFlow = useCallback(
    (y: number): FlowNode[] => {
      const flowId = genFlowId();
      // The flow's Library identity is stored here after the first
      // "Run and save" so later publishes update the same Library card.
      const infoNode: FlowNode = {
        id: `info_${flowId}`,
        type: 'info',
        position: { x: FLOW_X, y },
        data: {
          role: 'image' as StepRole,
          modelId: '',
          flowId,
          values: { name: createDefaultCanvasName() },
        },
      };
      return [
        infoNode,
        firstImage && {
          id: genId('image'),
          type: 'model',
          position: { x: FLOW_X + INFO_COL_W, y },
          data: {
            role: 'image' as StepRole,
            modelId: firstImage.id,
            flowId,
            values: {},
          },
        },
        firstVideo && {
          id: genId('video'),
          type: 'model',
          position: { x: FLOW_X + INFO_COL_W + FLOW_COL_W, y },
          data: {
            role: 'video' as StepRole,
            modelId: firstVideo.id,
            flowId,
            values: {},
          },
        },
      ].filter(Boolean) as FlowNode[];
    },
    [firstImage, firstVideo],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [hydrated, setHydrated] = useState(false);
  const nodesRef = useRef<FlowNode[]>([]);
  nodesRef.current = nodes;

  useEffect(() => {
    if (!saveToastIdRef.current) return;

    const timeoutId = window.setTimeout(() => {
      if (saveToastIdRef.current) {
        toast.dismiss(saveToastIdRef.current);
        saveToastIdRef.current = null;
      }
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // Hydrate the canvas exactly once per mount. Both the permanent workspace
  // (base page) and saved canvases load their nodes from Aurora via the
  // server component; the default image → video flow only appears on a
  // genuinely empty workspace. The once-guard means later identity changes
  // of `initialNodes` (e.g. a router refresh re-serializing props) can never
  // blow away unsaved client state.
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const restored =
      initialNodes && initialNodes.length > 0
        ? restoreNodes(initialNodes, initialTitle)
        : null;

    setNodes(
      restored && restored.length > 0 ? restored : buildDefaultFlow(120),
    );
    setHydrated(true);
  }, [initialNodes, initialTitle, buildDefaultFlow, setNodes]);

  // Durable autosave. A debounce alone loses work: the timer resets on every
  // keystroke/drag and unmount cancels the pending callback, so the last
  // burst of edits before a refresh/navigation silently died. Instead:
  //   - mark dirty on every change after hydration,
  //   - flush on a steady 1.5s interval whenever dirty (Notion-style),
  //   - flush via sendBeacon on pagehide/visibility-hidden so closing the
  //     tab mid-edit still persists the final state.
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveVersionRef = useRef(Date.now());
  const skipNextAutosaveRef = useRef(true);

  const nextSaveVersion = useCallback(() => {
    saveVersionRef.current += 1;
    return saveVersionRef.current;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    dirtyRef.current = true;
  }, [nodes, hydrated]);

  // Monotonic guard: bumped by Reset. A flush that started before the bump
  // must not write its (stale) snapshot after the reset's save — the
  // interval otherwise races the direct reset save and resurrects old flows.
  const saveGenerationRef = useRef(0);

  const flushWorkspace = useCallback(async () => {
    if (!dirtyRef.current || savingRef.current) return;
    dirtyRef.current = false;
    savingRef.current = true;
    const generation = saveGenerationRef.current;
    try {
      const snapshot = snapshotNodes(nodesRef.current);
      const title = flowName(nodesRef.current);
      if (generation !== saveGenerationRef.current) {
        // Reset happened while preparing; drop this stale snapshot.
        return;
      }
      const result = canvasId
        ? await saveCanvasAction({
            id: canvasId,
            title,
            nodes: snapshot,
            saveVersion: nextSaveVersion(),
          })
        : await saveWorkspaceAction(snapshot, nextSaveVersion());
      if (
        result &&
        'ok' in result &&
        !result.ok &&
        generation === saveGenerationRef.current
      ) {
        // Try again on the next tick rather than dropping the edit.
        dirtyRef.current = true;
      }
    } catch {
      if (generation === saveGenerationRef.current) {
        dirtyRef.current = true;
      }
    } finally {
      savingRef.current = false;
    }
  }, [canvasId, saveCanvasAction, saveWorkspaceAction, nextSaveVersion]);

  useEffect(() => {
    if (!hydrated) return;

    const intervalId = window.setInterval(() => {
      void flushWorkspace();
    }, 1500);

    // Last-chance flush when the page is being hidden or closed. Server
    // actions cannot run during unload, so this posts the snapshot to the
    // owner-authenticated workspace route via sendBeacon (fire-and-forget,
    // survives the page teardown). Only the base workspace needs it — saved
    // canvas pages keep the interval + action path.
    const flushOnExit = () => {
      if (!dirtyRef.current) return;
      // Server actions cannot run during page teardown; sendBeacon survives
      // it. The route saves either the workspace row or the saved canvas.
      try {
        const title = flowName(nodesRef.current);
        const payload = JSON.stringify({
          nodes: snapshotNodes(nodesRef.current),
          saveVersion: nextSaveVersion(),
          ...(canvasId
            ? {
                canvas: {
                  id: canvasId,
                  title,
                },
              }
            : {}),
        });
        const sent = navigator.sendBeacon(
          '/api/workspace',
          new Blob([payload], { type: 'application/json' }),
        );
        if (sent) dirtyRef.current = false;
      } catch {
        // keep dirty; the next interval tick retries if the page survives
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnExit();
    };

    window.addEventListener('pagehide', flushOnExit);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pagehide', flushOnExit);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
      // Component unmount (client-side navigation): synchronous beacon so
      // the final state is not lost with the unmounted tree.
      flushOnExit();
    };
  }, [hydrated, canvasId, flushWorkspace, nextSaveVersion]);

  const [fieldsByModel, setFieldsByModel] = useState<
    Record<string, FieldGroup | undefined>
  >({});
  const [statusByNode, setStatusByNode] = useState<
    Record<string, NodeStatus | undefined>
  >({});
  const [runningFlows, setRunningFlows] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const fieldsRef = useRef<Record<string, FieldGroup>>({});
  // Active run per flow; poll callbacks check it to drop stale responses.
  const flowRunIdRef = useRef(new Map<string, string>());
  const pollTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  // Form controls inside a node (textarea, number input) natively capture
  // wheel events, which blocks canvas zoom when the cursor is over a card.
  // Forward those wheel events to the React Flow zoom pane so zoom stays
  // active at any cursor position.
  useEffect(() => {
    const wrapper = flowWrapperRef.current;
    if (!wrapper) return undefined;

    const handleWheel = (event: globalThis.WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !target.closest('.react-flow__node')) {
        return;
      }
      if (target.closest('.nowheel')) {
        return;
      }
      const pane = wrapper.querySelector('.react-flow__pane');
      if (!pane) {
        return;
      }
      // Stop the textarea/input from scrolling or changing value, then replay
      // the wheel on the pane so React Flow zooms.
      event.preventDefault();
      pane.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          ctrlKey: event.ctrlKey,
          bubbles: false,
          cancelable: true,
        }),
      );
    };

    wrapper.addEventListener('wheel', handleWheel, {
      passive: false,
      capture: true,
    });
    return () => {
      wrapper.removeEventListener('wheel', handleWheel, {
        capture: true,
      } as EventListenerOptions);
    };
  }, []);

  const ensureFields = useCallback(
    async (modelId: string, kind: 'image' | 'video') => {
      if (!modelId || fieldsRef.current[modelId]) return;
      const group = await getModelFieldsAction(modelId, kind).catch(() => null);
      if (!group) return;
      fieldsRef.current[modelId] = group;
      setFieldsByModel((prev) => ({ ...prev, [modelId]: group }));
    },
    [getModelFieldsAction],
  );

  useEffect(() => {
    for (const node of nodes) {
      void ensureFields(node.data.modelId, kindForRole(node.data.role));
    }
  }, [nodes, ensureFields]);

  // Normalize EVERY node against its model's schema whenever nodes or loaded
  // schemas change: drop values the schema does not know, and fill every
  // missing field with the model's documented default. This runs for nodes
  // added after the schema was cached too — previously those never received
  // defaults, which produced empty fields (and broken payloads) for fields
  // whose schema default is required behavior.
  useEffect(() => {
    if (
      !nodes.some((node) =>
        nodeNeedsSchemaNormalization(
          node,
          fieldsRef.current[node.data.modelId],
        ),
      )
    ) {
      return;
    }

    setNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        const group = fieldsRef.current[node.data.modelId];
        if (!group) return node;

        if (!nodeNeedsSchemaNormalization(node, group)) return node;

        changed = true;
        return normalizeNodeValues(node, group);
      });
      return changed ? next : current;
    });
  }, [nodes, fieldsByModel, setNodes]);

  useEffect(
    () => () => {
      for (const timer of pollTimersRef.current.values()) {
        clearTimeout(timer);
      }
      pollTimersRef.current.clear();
    },
    [],
  );

  const flows = useMemo(() => flowsFrom(nodes), [nodes]);

  const flowMeta = useMemo(() => {
    const meta: Record<string, FlowMeta> = {};
    for (const [flowId, flowNodes] of flows) {
      meta[flowId] = {
        roles: new Set(flowNodes.map((node) => node.data.role)),
        autoName: flowName(nodes, flowId),
      };
    }
    return meta;
  }, [flows, nodes]);

  const edges = useMemo(() => {
    // Edges referencing nodes that are not (yet) in the state are dropped by
    // ReactFlow, so info/runner ropes are only emitted once their cards exist.
    const auxIds = new Set(
      nodes.filter((node) => node.type !== 'model').map((node) => node.id),
    );
    const result: Edge[] = [];
    for (const [flowId, flowNodes] of flows) {
      const animated = runningFlows.has(flowId);
      // Flow info card leads into the first model card.
      const first = flowNodes[0];
      if (first && auxIds.has(`info_${flowId}`)) {
        result.push({
          id: `info_${flowId}->${first.id}`,
          source: `info_${flowId}`,
          target: first.id,
          animated,
        });
      }
      for (let index = 1; index < flowNodes.length; index += 1) {
        const source = flowNodes[index - 1];
        const target = flowNodes[index];
        if (source && target) {
          result.push({
            id: `${source.id}->${target.id}`,
            source: source.id,
            target: target.id,
            animated,
          });
        }
      }
      // Last model card connects into the flow's runner card.
      const last = flowNodes[flowNodes.length - 1];
      if (last && auxIds.has(`runner_${flowId}`)) {
        result.push({
          id: `${last.id}->runner_${flowId}`,
          source: last.id,
          target: `runner_${flowId}`,
          animated,
        });
      }
    }
    return result;
  }, [nodes, flows, runningFlows]);

  // Runner cards must be REAL state nodes: ReactFlow v12 delivers measured
  // node dimensions through onNodesChange, and nodes absent from the managed
  // state never receive them — they can stay hidden in production builds.
  // Reconcile one runner per flow into the state. Runners are normal,
  // draggable cards (ReactFlow disables pointer-events on fully
  // non-interactive nodes, which made the run buttons unclickable) — they
  // just cannot be deleted, so every flow always ends in its runner. New
  // runners spawn after the flow's last model card; existing ones keep
  // whatever position the user dragged them to.
  useEffect(() => {
    if (!needsFlowAuxReconcile(nodes)) return;

    setNodes((current) => {
      const modelNodes = current.filter((node) => node.type === 'model');
      const auxById = new Map(
        current
          .filter((node) => node.type !== 'model')
          .map((node) => [node.id, node]),
      );
      const currentFlows = flowsFrom(modelNodes);
      const next: FlowNode[] = [...modelNodes];
      let matched = 0;
      let changed = false;

      for (const [flowId, flowNodes] of currentFlows) {
        const first = flowNodes[0];
        const last = flowNodes[flowNodes.length - 1];
        if (!first || !last) continue;

        // Flow info card: persists the flow's Library identity (canvas id +
        // editable name). If a malformed stored flow is missing one, create it.
        const infoId = `info_${flowId}`;
        const existingInfo = auxById.get(infoId);
        if (existingInfo) {
          matched += 1;
          next.push(existingInfo);
        } else {
          changed = true;
          next.push({
            id: infoId,
            type: 'info',
            position: {
              x: first.position.x - INFO_COL_W,
              y: first.position.y,
            },
            data: {
              role: 'image',
              modelId: '',
              flowId,
              values: {
                name:
                  (typeof initialTitle === 'string' &&
                    normalizeCanvasTitle(initialTitle)) ||
                  createDefaultCanvasName(),
              },
            },
          });
        }

        const runnerId = `runner_${flowId}`;
        const existingRunner = auxById.get(runnerId);
        if (existingRunner) {
          matched += 1;
          next.push(existingRunner);
        } else {
          changed = true;
          next.push({
            id: runnerId,
            type: 'runner',
            position: {
              x: last.position.x + FLOW_COL_W,
              y: last.position.y,
            },
            data: { role: 'image', modelId: '', flowId, values: {} },
          });
        }
      }

      // Orphaned info/runner cards (their flow was removed) are dropped.
      if (matched !== auxById.size) changed = true;

      return changed ? next : current;
    });
  }, [nodes, initialTitle, setNodes]);

  const updateModel = useCallback(
    (id: string, modelId: string) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== id) return node;
          const carried: Record<string, FieldValue> = {};
          for (const key of ['generation_prompt', 'generation_input_file']) {
            const value = node.data.values[key];
            if (typeof value === 'string' && value) {
              carried[key] = value;
            }
          }
          return { ...node, data: { ...node.data, modelId, values: carried } };
        }),
      );
      const kind = modelForId(models, modelId)?.kind ?? 'image';
      void ensureFields(modelId, kind);
    },
    [models, setNodes, ensureFields],
  );

  const updateValue = useCallback(
    (id: string, name: string, value: FieldValue) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  values: { ...node.data.values, [name]: value },
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const removeNode = useCallback(
    (id: string) =>
      setNodes((current) => {
        const removed = current.find((node) => node.id === id);
        const next = current.filter((node) => node.id !== id);
        return removed ? relayoutFlow(next, removed.data.flowId) : next;
      }),
    [setNodes],
  );

  // Remove an entire flow (its model cards + runner). Any in-flight run for
  // the flow stops being tracked here; the run itself stays in Aurora.
  const removeFlow = useCallback(
    (flowId: string) => {
      if (
        !window.confirm(
          'Remove this flow from the canvas? Saved canvases in the Library are not affected.',
        )
      ) {
        return;
      }

      const timer = pollTimersRef.current.get(flowId);
      if (timer) clearTimeout(timer);
      pollTimersRef.current.delete(flowId);
      flowRunIdRef.current.delete(flowId);
      setRunningFlows((prev) => {
        if (!prev.has(flowId)) return prev;
        const next = new Set(prev);
        next.delete(flowId);
        return next;
      });
      // The runner card carries the same flowId, so it is removed with the
      // flow's model cards.
      setNodes((current) =>
        current.filter((node) => node.data.flowId !== flowId),
      );
    },
    [setNodes],
  );

  const addNodeToFlow = useCallback(
    (flowId: string, role: StepRole) => {
      const model = models.find((entry) => entry.roles.includes(role));
      if (!model) return;
      setNodes((current) => {
        const flowNodes = current.filter(
          (node) => node.type === 'model' && node.data.flowId === flowId,
        );
        if (
          flowNodes.length === 0 ||
          flowNodes.some((node) => node.data.role === role)
        ) {
          return current;
        }
        const next: FlowNode[] = [
          ...current,
          {
            id: genId(role),
            type: 'model',
            position: { x: 0, y: flowNodes[0]!.position.y },
            data: { role, modelId: model.id, flowId, values: {} },
          },
        ];
        // Slot the new card into its step position within this flow only.
        return relayoutFlow(next, flowId);
      });
      void ensureFields(model.id, kindForRole(role));
    },
    [models, setNodes, ensureFields],
  );

  const duplicateFlow = useCallback(
    (flowId: string) => {
      if (canvasId) return;

      setNodes((current) => {
        const sourceModels = current
          .filter(
            (node) => node.type === 'model' && node.data.flowId === flowId,
          )
          .sort((a, b) => ROLE_RANK[a.data.role] - ROLE_RANK[b.data.role]);

        if (sourceModels.length === 0) {
          return current;
        }

        const sourceInfo = current.find(
          (node) => node.type === 'info' && node.data.flowId === flowId,
        );
        const newFlowId = genFlowId();
        const rowY = nextFlowY(current);
        const infoValues: Record<string, FieldValue> = {
          ...(sourceInfo?.data.values ?? {}),
          name: duplicateFlowName(flowName(current, flowId)),
        };
        delete infoValues[LIBRARY_CANVAS_ID_VALUE];

        const copiedNodes: FlowNode[] = [
          {
            id: `info_${newFlowId}`,
            type: 'info',
            position: { x: FLOW_X, y: rowY },
            data: {
              role: 'image',
              modelId: '',
              flowId: newFlowId,
              values: infoValues,
            },
          },
          ...sourceModels.map((node, index) => ({
            id: genId(node.data.role),
            type: 'model' as const,
            position: {
              x: FLOW_X + INFO_COL_W + index * FLOW_COL_W,
              y: rowY,
            },
            data: {
              ...node.data,
              flowId: newFlowId,
              values: { ...node.data.values },
            },
          })),
        ];

        return [...current, ...copiedNodes];
      });
    },
    [canvasId, setNodes],
  );

  const addFlow = useCallback(() => {
    setNodes((current) => [
      ...current,
      ...buildDefaultFlow(nextFlowY(current)),
    ]);
  }, [setNodes, buildDefaultFlow]);

  const resetCanvas = useCallback(() => {
    if (
      !window.confirm(
        'Reset the canvas? This removes every flow from your workspace. Saved canvases in the Library are not affected.',
      )
    ) {
      return;
    }

    for (const timer of pollTimersRef.current.values()) {
      clearTimeout(timer);
    }
    pollTimersRef.current.clear();
    flowRunIdRef.current.clear();
    setRunningFlows(new Set());
    setStatusByNode({});

    const fresh = buildDefaultFlow(120);
    setNodes(fresh);
    // Invalidate any in-flight autosave so a stale pre-reset snapshot can
    // never land after this save and resurrect the old flows.
    saveGenerationRef.current += 1;
    dirtyRef.current = false;
    const resetSaveVersion = nextSaveVersion();
    const persistReset = async (attempt = 0): Promise<void> => {
      // Let any in-flight autosave land first: the reset save must be the
      // LAST write, otherwise a slow pre-reset request can overwrite it.
      for (let waited = 0; savingRef.current && waited < 50; waited += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const result = await saveWorkspaceAction(
        snapshotNodes(fresh),
        resetSaveVersion,
      ).catch(() => ({
        ok: false as const,
        error: 'Resetting the canvas failed.',
      }));
      if (!result.ok) {
        if (attempt < 3) {
          window.setTimeout(() => void persistReset(attempt + 1), 1200);
        } else {
          toast.error(
            'Resetting the canvas failed to save. Check the connection and try again.',
          );
        }
      }
    };
    void persistReset();
  }, [buildDefaultFlow, setNodes, saveWorkspaceAction, nextSaveVersion]);

  const applyRunToFlow = useCallback((flowId: string, run: RunJson) => {
    // Map run steps (keyed by role) onto this flow's MODEL nodes. Info and
    // runner cards carry a dummy role and must never receive step status.
    const nodeByRole = new Map<string, string>();
    for (const node of nodesRef.current) {
      if (node.type === 'model' && node.data.flowId === flowId) {
        nodeByRole.set(node.data.role, node.id);
      }
    }
    setStatusByNode((prev) => {
      const next = { ...prev };
      for (const step of run.steps ?? []) {
        const nodeId = nodeByRole.get(step.step_key);
        if (nodeId) {
          next[nodeId] = {
            status: step.status,
            output: step.generation_output_file?.[0],
          };
        }
      }
      return next;
    });
  }, []);

  const finishFlow = useCallback((flowId: string) => {
    flowRunIdRef.current.delete(flowId);
    const timer = pollTimersRef.current.get(flowId);
    if (timer) clearTimeout(timer);
    pollTimersRef.current.delete(flowId);
    setRunningFlows((prev) => {
      const next = new Set(prev);
      next.delete(flowId);
      return next;
    });
  }, []);

  const pollFlow = useCallback(
    async (
      flowId: string,
      runId: string,
      failures = 0,
      notifyFailure = true,
    ) => {
      const run = (await getRunAction(runId).catch(
        () => null,
      )) as RunJson | null;
      if (flowRunIdRef.current.get(flowId) !== runId) return;
      if (!run) {
        // Transient fetch/server hiccup: keep the run alive and retry with
        // backoff instead of silently abandoning an in-flight chain. The run
        // itself is safe in Aurora either way.
        if (failures >= 8) {
          finishFlow(flowId);
          toast.error(
            'Lost connection while tracking the run. Reload to resume — the run keeps processing in the background.',
          );
          return;
        }
        pollTimersRef.current.set(
          flowId,
          setTimeout(
            () => void pollFlow(flowId, runId, failures + 1, notifyFailure),
            Math.min(1500 * 2 ** failures, 15_000),
          ),
        );
        return;
      }
      applyRunToFlow(flowId, run);
      if (TERMINAL.has(run.status)) {
        finishFlow(flowId);
        if (run.status === 'failed' && notifyFailure) {
          toast.error(run.error_message?.trim() || 'The run failed.');
        }
        return;
      }
      pollTimersRef.current.set(
        flowId,
        setTimeout(() => void pollFlow(flowId, runId, 0, notifyFailure), 1500),
      );
    },
    [getRunAction, applyRunToFlow, finishFlow],
  );

  // When a hidden tab becomes visible again, repaint every active flow
  // immediately instead of waiting for the next scheduled tick.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      for (const [flowId, runId] of flowRunIdRef.current) {
        const timer = pollTimersRef.current.get(flowId);
        if (timer) clearTimeout(timer);
        void pollFlow(flowId, runId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pollFlow]);

  // Resume run tracking after a reload or in another tab:
  //   - workspace: every flow's recorded run (in-progress runs continue
  //     live; finished runs repaint their results once).
  //   - saved canvas: its linked last run.
  const resumedRunRef = useRef(false);

  useEffect(() => {
    if (!hydrated || resumedRunRef.current) return;
    resumedRunRef.current = true;

    if (canvasId && initialRunId) {
      const firstFlowId = nodesRef.current[0]?.data.flowId;
      if (!firstFlowId) return;
      flowRunIdRef.current.set(firstFlowId, initialRunId);
      setRunningFlows((prev) => new Set(prev).add(firstFlowId));
      // notifyFailure=false: repainting an old failed run on page load should
      // not re-toast an error the user already saw.
      void pollFlow(firstFlowId, initialRunId, 0, false);
      return;
    }

    if (!canvasId && initialFlowRuns) {
      const liveFlowIds = new Set(
        nodesRef.current.map((node) => node.data.flowId),
      );
      for (const [flowId, runId] of Object.entries(initialFlowRuns)) {
        if (!liveFlowIds.has(flowId)) continue;
        flowRunIdRef.current.set(flowId, runId);
        setRunningFlows((prev) => new Set(prev).add(flowId));
        void pollFlow(flowId, runId, 0, false);
      }
    }
  }, [hydrated, canvasId, initialRunId, initialFlowRuns, pollFlow]);

  const runFlow = useCallback(
    async (flowId: string, save: boolean) => {
      const flowNodes = nodesRef.current
        .filter((node) => node.type === 'model' && node.data.flowId === flowId)
        .sort((a, b) => ROLE_RANK[a.data.role] - ROLE_RANK[b.data.role]);
      const roles = new Set(flowNodes.map((node) => node.data.role));

      if (!roles.has('image') || !roles.has('video')) {
        toast.error('A flow needs an image_model and a video_model to run.');
        return;
      }
      for (const node of flowNodes) {
        if (!promptValue(node.data.values)) {
          toast.error(`Add a prompt to the ${node.data.role}_model node.`);
          return;
        }
      }

      const input: Record<string, unknown> = {};
      for (const node of flowNodes) {
        let params: Record<string, unknown>;
        try {
          params = normalizeRunParams(
            compact(node.data.values),
            fieldsRef.current[node.data.modelId],
          );
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : `Check the ${node.data.role}_model fields.`,
          );
          return;
        }
        // The run API takes generation_input_file as an array of HTTPS URLs,
        // and only on the first (image) step — later steps are chain-wired.
        if (node.data.role === 'image') {
          const inputFile = params.generation_input_file;
          if (typeof inputFile === 'string') {
            params.generation_input_file = [inputFile];
          }
          const inputImageFile = params.generation_input_image_file;
          if (typeof inputImageFile === 'string') {
            params.generation_input_image_file = [inputImageFile];
          }
        } else {
          for (const key of CHAIN_WIRED_DOWNSTREAM_FIELDS) {
            delete params[key];
          }
        }
        input[`${node.data.role}_model`] = node.data.modelId;
        input[`${node.data.role}_model_input`] = params;
      }

      // Mark running and clear this flow's previous statuses only.
      const existingTimer = pollTimersRef.current.get(flowId);
      if (existingTimer) clearTimeout(existingTimer);
      setRunningFlows((prev) => new Set(prev).add(flowId));
      setStatusByNode((prev) => {
        const next = { ...prev };
        for (const node of flowNodes) {
          delete next[node.id];
        }
        return next;
      });

      let savedCanvasId: string | undefined;
      let workingNodes = nodesRef.current;

      if (save) {
        savedCanvasId =
          canvasId ??
          flowLibraryCanvasId(workingNodes, flowId) ??
          createCanvasId();

        if (!canvasId && !flowLibraryCanvasId(workingNodes, flowId)) {
          workingNodes = withFlowLibraryCanvasId(
            workingNodes,
            flowId,
            savedCanvasId,
          );
          nodesRef.current = workingNodes;
          setNodes(workingNodes);
        }
      }

      // A run should never depend on the autosave interval having fired.
      // Persist the workspace row first so `recordWorkspaceFlowRun()` can
      // attach the run and reload/logout can resume it reliably.
      if (!canvasId) {
        for (let waited = 0; savingRef.current && waited < 50; waited += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const workspaceSave = await saveWorkspaceAction(
          snapshotNodes(workingNodes),
          nextSaveVersion(),
        ).catch(() => ({
          ok: false as const,
          error: 'Saving the workspace failed.',
        }));

        if (!workspaceSave.ok) {
          finishFlow(flowId);
          dirtyRef.current = true;
          toast.error(workspaceSave.error);
          return;
        }
      }

      // "Run and save": snapshot THIS flow into the Library first, so the
      // saved canvas exists (and is linked to the run) before anything runs.
      // On the workspace each flow gets one Library canvas id, persisted on
      // the info card; later publishes update that same Library card. On a
      // saved canvas page the page id is reused, so re-running updates in place.
      if (save) {
        if (!savedCanvasId) {
          finishFlow(flowId);
          toast.error('Saving the canvas failed.');
          return;
        }

        const title = flowName(nodesRef.current, flowId);
        const result = await saveCanvasAction({
          id: savedCanvasId,
          title,
          nodes: snapshotNodes([
            ...workingNodes.filter((node) => node.id === `info_${flowId}`),
            ...flowNodes,
          ]),
          saveVersion: nextSaveVersion(),
        }).catch(() => ({
          ok: false as const,
          error: 'Saving the canvas failed.',
        }));

        if (!result.ok) {
          finishFlow(flowId);
          toast.error(result.error);
          return;
        }

        saveToastIdRef.current = toast.info(
          'Flow saved to your Library. Results attach to it automatically.',
          { duration: 2400 },
        );
      }

      const result = await runChainAction(input, savedCanvasId).catch(
        () => null,
      );
      if (!result || !result.ok) {
        finishFlow(flowId);
        toast.error(
          result && !result.ok ? result.error : 'Run failed to start.',
        );
        return;
      }
      const run = result.run as RunJson;
      flowRunIdRef.current.set(flowId, run.id);
      // Record the run on the workspace so a reload resumes tracking it.
      if (!canvasId) {
        const recorded = await recordFlowRunAction(flowId, run.id).catch(
          () => false,
        );

        if (!recorded) {
          toast.error(
            'Run started, but saving its resume pointer failed. Keep this tab open until it finishes.',
          );
        }
      }
      applyRunToFlow(flowId, run);
      if (TERMINAL.has(run.status)) {
        finishFlow(flowId);
        if (run.status === 'failed') {
          toast.error(run.error_message?.trim() || 'The run failed.');
        }
        return;
      }
      pollTimersRef.current.set(
        flowId,
        setTimeout(() => void pollFlow(flowId, run.id), 1200),
      );
    },
    [
      canvasId,
      models,
      runChainAction,
      saveCanvasAction,
      recordFlowRunAction,
      applyRunToFlow,
      pollFlow,
      finishFlow,
    ],
  );

  const stopFlow = useCallback(
    (flowId: string) => {
      // Cancel the run server-side FIRST: without this the chain keeps
      // processing in Aurora (spending provider credits) and a reload would
      // resume tracking the "stopped" run.
      const runId = flowRunIdRef.current.get(flowId);
      finishFlow(flowId);
      if (!runId) return;
      void cancelRunAction(runId)
        .then((run) => {
          if (run) {
            // Paint the canceled/skipped statuses — unless the user already
            // started a NEW run for this flow while the cancel was in flight.
            if (!flowRunIdRef.current.has(flowId)) {
              applyRunToFlow(flowId, run as RunJson);
            }
          } else {
            toast.error(
              'Stopping the run failed — it may finish in the background.',
            );
          }
        })
        .catch(() => undefined);
    },
    [finishFlow, cancelRunAction, applyRunToFlow],
  );

  const contextValue = useMemo<CanvasContextValue>(
    () => ({
      models,
      fieldsByModel,
      statusByNode,
      runningFlowIds: runningFlows,
      flowMeta,
      flowCount: flows.size,
      isSavedCanvas: Boolean(canvasId),
      updateModel,
      updateValue,
      removeNode,
      removeFlow,
      duplicateFlow,
      renameCanvas: (flowId: string, title: string) => {
        const targetCanvasId =
          canvasId ?? flowLibraryCanvasId(nodesRef.current, flowId);
        if (targetCanvasId) {
          void renameCanvasAction(targetCanvasId, title).catch(() => undefined);
        }
      },
      addNodeToFlow,
      runFlow: (flowId: string, save: boolean) => void runFlow(flowId, save),
      stopFlow,
    }),
    [
      models,
      fieldsByModel,
      statusByNode,
      runningFlows,
      flowMeta,
      flows,
      canvasId,
      updateModel,
      updateValue,
      removeNode,
      removeFlow,
      duplicateFlow,
      renameCanvasAction,
      addNodeToFlow,
      runFlow,
      stopFlow,
    ],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4">
        <div className="flex items-center gap-1.5">
          <Button size="sm" disabled={!hydrated} onClick={addFlow}>
            <FontAwesomeIcon icon="diagram-project" />
            Add canvas flow
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!canvasId ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!hydrated || runningFlows.size > 0}
              onClick={resetCanvas}
            >
              <FontAwesomeIcon icon="rotate-left" />
              Reset canvas
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-[#18181b]" ref={flowWrapperRef}>
        <CanvasContext.Provider value={contextValue}>
          <ReactFlow
            className="bg-[#18181b]"
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            colorMode="dark"
            nodesConnectable={false}
            edgesFocusable={false}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            minZoom={0.3}
            maxZoom={1.5}
            zoomOnScroll
            zoomOnPinch
            panOnScroll={false}
            preventScrolling
            defaultEdgeOptions={{
              style: { stroke: '#475067', strokeWidth: 2 },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1}
              color="#2a313d"
            />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              nodeColor={(node) =>
                node.type === 'runner'
                  ? RUNNER_COLOR
                  : node.type === 'info'
                    ? INFO_COLOR
                    : ROLE_COLOR[(node.data as NodeData).role]
              }
              maskColor="rgba(10, 12, 16, 0.7)"
              style={{
                backgroundColor: '#0a0c10',
                border: '1px solid #29303d',
              }}
            />
          </ReactFlow>
        </CanvasContext.Provider>
      </div>
    </div>
  );
}

function modelForId(
  models: CanvasModel[],
  id: string,
): CanvasModel | undefined {
  return models.find((model) => model.id === id);
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
