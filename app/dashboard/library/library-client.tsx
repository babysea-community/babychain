'use client';

import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  MAX_CANVAS_TITLE_LENGTH,
  normalizeCanvasTitle,
} from '@/lib/canvas/names';
import { formatPublicModelName } from '@/lib/models/display';
import { cn } from '@/lib/utils';
import type { StoredCanvas } from '@/lib/canvas/canvas-library';
import type {
  CanvasLibraryItem,
  CanvasResultPreview,
} from '@/lib/canvas/canvas-store';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type ModelIconKey =
  | 'bfl'
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

type BadgeInfo = {
  Icon: IconComponent;
  key: string;
  label: string;
};

const MODEL_ICONS: Record<ModelIconKey, IconComponent> = {
  bfl: InlineModelBlackForestLabsLight,
  bytedance: InlineModelByteDance,
  google: InlineModelGoogle,
  happyhorse: InlineModelHappyHorseLight,
  openai: InlineModelOpenAILight,
  qwen: InlineModelQwen,
  runway: InlineModelRunwayLight,
  wan: InlineModelWan,
  z: InlineModelZImage,
};

const INFERENCE_ICONS: Record<InferenceIconKey, IconComponent> = {
  'alibaba-cloud': InlineInferenceAlibabaCloud,
  'black-forest-labs': InlineInferenceBlackForestLabsLight,
  byteplus: InlineInferenceBytePlus,
  google: InlineInferenceGoogle,
  openai: InlineInferenceOpenAILight,
  runway: InlineInferenceRunwayLight,
};

const INFERENCE_LABELS: Record<InferenceIconKey, string> = {
  'alibaba-cloud': 'Alibaba Cloud',
  'black-forest-labs': 'Black Forest Labs',
  byteplus: 'BytePlus',
  google: 'Google',
  openai: 'OpenAI',
  runway: 'Runway',
};

type LibraryClientProps = {
  canvases: CanvasLibraryItem[];
  loadFailed: boolean;
  deleteCanvasAction: (
    canvasId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  renameCanvasAction: (
    canvasId: string,
    title: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function LibraryClient({
  canvases: initialCanvases,
  loadFailed,
  deleteCanvasAction,
  renameCanvasAction,
}: LibraryClientProps) {
  const [canvases, setCanvases] = useState(initialCanvases);

  useEffect(() => {
    if (loadFailed) {
      toast.error(
        'Loading saved canvases failed. Check the Aurora connection and refresh.',
      );
    }
  }, [loadFailed]);

  const handleError = (message: string | null) => {
    if (message) toast.error(message);
  };

  const handleDeleted = (canvasId: string) => {
    setCanvases((current) =>
      current.filter((canvas) => canvas.id !== canvasId),
    );
  };

  const handleRenamed = (canvasId: string, title: string) => {
    setCanvases((current) =>
      current.map((canvas) =>
        canvas.id === canvasId ? { ...canvas, title } : canvas,
      ),
    );
  };

  return (
    <main className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-sidebar px-4">
        <Button asChild size="sm">
          <Link href="/dashboard/canvas">
            <FontAwesomeIcon icon="diagram-project" />
            New canvas
          </Link>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {canvases.length === 0 ? (
          <Card>
            <CardContent className="p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                Save a canvas to make it available here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {canvases.map((canvas) => (
              <CanvasCard
                canvas={canvas}
                deleteCanvasAction={deleteCanvasAction}
                renameCanvasAction={renameCanvasAction}
                key={canvas.id}
                onDeleted={handleDeleted}
                onRenamed={handleRenamed}
                onError={handleError}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CanvasCard({
  canvas,
  deleteCanvasAction,
  renameCanvasAction,
  onDeleted,
  onRenamed,
  onError,
}: {
  canvas: CanvasLibraryItem;
  deleteCanvasAction: LibraryClientProps['deleteCanvasAction'];
  renameCanvasAction: LibraryClientProps['renameCanvasAction'];
  onDeleted: (canvasId: string) => void;
  onRenamed: (canvasId: string, title: string) => void;
  onError: (message: string | null) => void;
}) {
  const modelBadges = useMemo(() => modelBadgeInfo(canvas), [canvas]);
  const inferenceBadges = useMemo(() => inferenceBadgeInfo(canvas), [canvas]);
  const [deleting, startDelete] = useTransition();
  const [renaming, startRename] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(canvas.title);

  const commitRename = () => {
    setEditing(false);
    const title = normalizeCanvasTitle(draft);
    if (!title || title === canvas.title) {
      setDraft(canvas.title);
      return;
    }

    startRename(async () => {
      onError(null);
      const result = await renameCanvasAction(canvas.id, title).catch(() => ({
        ok: false as const,
        error: 'Renaming the canvas failed. Try again.',
      }));

      if (!result.ok) {
        setDraft(canvas.title);
        onError(result.error);
        return;
      }

      onRenamed(canvas.id, title);
    });
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        'Delete this canvas? This permanently removes it from your library.',
      )
    ) {
      return;
    }

    startDelete(async () => {
      onError(null);
      const result = await deleteCanvasAction(canvas.id).catch(() => ({
        ok: false as const,
        error: 'Deleting the canvas failed. Try again.',
      }));

      if (!result.ok) {
        onError(result.error);
        return;
      }

      onDeleted(canvas.id);
    });
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        {/* 1. Title — truncated to 40 characters, pencil to rename */}
        {editing ? (
          <input
            autoFocus
            maxLength={MAX_CANVAS_TITLE_LENGTH}
            className="h-8 w-full border border-border bg-input px-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
            value={draft}
            onChange={(event) =>
              setDraft(event.target.value.slice(0, MAX_CANVAS_TITLE_LENGTH))
            }
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') {
                setDraft(canvas.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div className="flex items-start justify-between gap-1.5">
            <p
              className="min-w-0 text-sm font-medium leading-5 text-foreground"
              title={canvas.title}
            >
              {truncateTitle(canvas.title)}
            </p>
            <button
              type="button"
              aria-label="Rename canvas"
              disabled={renaming}
              onClick={() => {
                setDraft(canvas.title);
                setEditing(true);
              }}
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground disabled:opacity-40"
            >
              {renaming ? (
                <FontAwesomeIcon
                  className="size-3.5 animate-spin"
                  icon="spinner"
                />
              ) : (
                <FontAwesomeIcon className="size-3.5" icon="pen-to-square" />
              )}
            </button>
          </div>
        )}

        {/* 2. Single meta badge: Run ID / Canvas ID / Created */}
        <div className="space-y-1 border border-border bg-muted/30 px-2.5 py-2">
          <MetaRow label="Run ID">
            {canvas.lastRunId ? (
              <span className="break-all font-mono">{canvas.lastRunId}</span>
            ) : (
              <span className="text-muted-foreground">No run yet</span>
            )}
          </MetaRow>
          <MetaRow label="Canvas ID">
            <span className="break-all font-mono">{canvas.id}</span>
          </MetaRow>
          <MetaRow label="Created">
            {new Date(canvas.createdAt).toLocaleString()}
          </MetaRow>
        </div>

        {/* 3. Inference — fixed two-line height so cards align */}
        <div className="space-y-1.5">
          <p className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Inference
          </p>
          <div className="flex h-[3.75rem] flex-wrap content-start gap-1.5 overflow-hidden">
            {inferenceBadges.map(({ Icon, key, label }) => (
              <Badge
                className="gap-1.5 px-2 py-1 text-xs normal-case tracking-normal"
                key={key}
                variant="muted"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Badge>
            ))}
          </div>
        </div>

        {/* 4. Models — fixed two-line height so cards align */}
        <div className="space-y-1.5">
          <p className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Models
          </p>
          <div className="flex h-[3.75rem] flex-wrap content-start gap-1.5 overflow-hidden">
            {modelBadges.map(({ Icon, key, label }) => (
              <Badge
                className="gap-1.5 px-2 py-1 text-xs normal-case tracking-normal"
                key={key}
                variant="outline"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Badge>
            ))}
          </div>
        </div>

        {/* 5. Results — fixed two-row grid; spans depend on result count */}
        <div className="space-y-1.5">
          <p className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Results
          </p>
          <div className="grid h-56 grid-cols-2 grid-rows-2 gap-1.5">
            {canvas.resultPreviews.length === 0 ? (
              <div className="col-span-2 row-span-2 flex items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
                No results yet
              </div>
            ) : (
              canvas.resultPreviews.map((preview, index) => (
                <ResultPreview
                  className={resultCellClass(
                    canvas.resultPreviews.length,
                    index,
                  )}
                  key={`${preview.url}-${index}`}
                  preview={preview}
                  title={canvas.title}
                />
              ))
            )}
          </div>
        </div>

        <Button asChild className="w-full" size="sm">
          <Link
            href={`/dashboard/canvas/${canvas.id}`}
            rel="noreferrer"
            target="_blank"
          >
            Open canvas
            <FontAwesomeIcon icon="arrow-up-right-from-square" />
          </Link>
        </Button>
        <Button
          className="w-full hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
          disabled={deleting}
          onClick={handleDelete}
          size="sm"
          variant="outline"
        >
          {deleting ? (
            <FontAwesomeIcon className="animate-spin" icon="spinner" />
          ) : (
            <FontAwesomeIcon icon="trash" />
          )}
          {deleting ? 'Deleting…' : 'Delete canvas'}
        </Button>
      </CardContent>
    </Card>
  );
}

function truncateTitle(title: string) {
  return title.length > MAX_CANVAS_TITLE_LENGTH
    ? `${title.slice(0, MAX_CANVAS_TITLE_LENGTH)}…`
    : title;
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="text-[0.65rem] leading-4 text-foreground">
      <span className="font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}:{' '}
      </span>
      {children}
    </p>
  );
}

// Two-row results grid. Cell spans by result count:
//   1 result : full-width, both rows
//   2 results: one per row (full width each)
//   3 results: first two side by side, third full-width on row 2
//   4 results: 2×2
function resultCellClass(count: number, index: number) {
  if (count === 1) return 'col-span-2 row-span-2';
  if (count === 2) return 'col-span-2';
  if (count === 3 && index === 2) return 'col-span-2';
  return '';
}

function ResultPreview({
  preview,
  title,
  className,
}: {
  preview: CanvasResultPreview;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    const icon = preview.kind === 'video' ? 'video' : 'image';
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-1.5 border border-border bg-black text-muted-foreground',
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

  // object-contain (not cover): portrait results (9:16) letterbox inside the
  // landscape cell instead of being cropped to a landscape crop.
  return (
    <div className={cn('relative h-full w-full', className)}>
      {preview.kind === 'video' ? (
        <video
          src={preview.url}
          controls
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          onLoadedMetadata={() => setLoaded(true)}
          className="h-full w-full border border-border bg-black object-contain"
        />
      ) : (
        <img
          src={preview.url}
          alt={`${title} — image result`}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          className="h-full w-full border border-border bg-black object-contain"
        />
      )}
      {/* Until the media loads, cover the slot (and the browser's alt text)
          with an explicit loading state. */}
      {!loaded ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 border border-border bg-black text-muted-foreground">
          <FontAwesomeIcon className="size-5 animate-spin" icon="spinner" />
          <span className="text-[0.65rem] leading-4">Loading…</span>
        </div>
      ) : null}
    </div>
  );
}

function modelBadgeInfo(canvas: StoredCanvas): BadgeInfo[] {
  return uniqueBadges(
    canvas.nodes.map((node) => {
      const key = modelIconKey(node.modelId);
      if (!key) return null;
      return {
        Icon: MODEL_ICONS[key],
        key,
        label: modelLabel(node.modelId),
      };
    }),
  );
}

function inferenceBadgeInfo(canvas: StoredCanvas): BadgeInfo[] {
  return uniqueBadges(
    canvas.nodes.map((node) => {
      if (!node.modelId) return null;
      const key = inferenceKey(node.modelId);
      return {
        Icon: INFERENCE_ICONS[key],
        key,
        label: INFERENCE_LABELS[key],
      };
    }),
  );
}

function uniqueBadges(items: Array<BadgeInfo | null>) {
  return Array.from(
    new Map(
      items
        .filter((item): item is BadgeInfo => item !== null)
        .map((item) => [item.key, item]),
    ).values(),
  );
}

function namespace(modelId: string) {
  return modelId.split('/')[0] ?? '';
}

function modelIconKey(modelId: string): ModelIconKey | null {
  const key = namespace(modelId);

  if (key === 'bfl' || key === 'black-forest-labs') return 'bfl';
  if (key === 'bytedance' || key === 'byteplus') return 'bytedance';
  if (key === 'google') return 'google';
  if (key === 'happyhorse') return 'happyhorse';
  if (key === 'gpt' || key === 'openai') return 'openai';
  if (key === 'qwen') return 'qwen';
  if (key === 'runway') return 'runway';
  if (key === 'wan') return 'wan';
  if (key === 'z') return 'z';

  return null;
}

function modelLabel(modelId: string) {
  const key = modelIconKey(modelId);

  if (!key) return formatPublicModelName(modelId);

  const labels: Record<ModelIconKey, string> = {
    bfl: 'Black Forest Labs',
    bytedance: 'ByteDance',
    google: 'Google',
    happyhorse: 'HappyHorse',
    openai: 'GPT',
    qwen: 'Qwen',
    runway: 'Runway',
    wan: 'Wan',
    z: 'Z-Image',
  };

  return labels[key];
}

function inferenceKey(modelId: string): InferenceIconKey {
  const key = namespace(modelId);

  if (key === 'bfl' || key === 'black-forest-labs') return 'black-forest-labs';
  if (key === 'bytedance' || key === 'byteplus') return 'byteplus';
  if (key === 'google') return 'google';
  if (key === 'gpt' || key === 'openai') return 'openai';
  if (key === 'runway') return 'runway';

  return 'alibaba-cloud';
}
