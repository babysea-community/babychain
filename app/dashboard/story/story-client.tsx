'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { STORY_MAX_SCENES } from '@/lib/showrunner/schemas';
import type {
  NextPromptSuggestionResult,
  StorySceneRunDraft,
} from '@/lib/showrunner';
import { cn } from '@/lib/utils';

export type StoryModelOption = {
  available: boolean;
  id: string;
  label: string;
  providerLabel: string;
  unavailableReason: string | null;
};

export type StoryRunActionResult =
  | { ok: true; run: Record<string, unknown> }
  | { ok: false; error: string };

export type StorySuggestActionResult =
  | { ok: true; result: NextPromptSuggestionResult }
  | { ok: false; error: string };

type StoryClientProps = {
  defaultDraft: StorySceneRunDraft;
  getStoryRunAction: (runId: string) => Promise<StoryRunActionResult>;
  modelOptions: {
    imageModels: StoryModelOption[];
    modifyModels: StoryModelOption[];
    videoModels: StoryModelOption[];
  };
  providerMode: 'babysea' | 'byok';
  qwenConfigured: boolean;
  qwenModel: string;
  runStorySceneAction: (
    input: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ) => Promise<StoryRunActionResult>;
  suggestNextPromptsAction: (
    input: Record<string, unknown>,
  ) => Promise<StorySuggestActionResult>;
};

type StoryScene = {
  draft: StorySceneRunDraft;
  error: string | null;
  outputFiles: string[];
  run: Record<string, unknown> | null;
  runId: string | null;
  sceneNumber: number;
  status: string;
  suggestions: NextPromptSuggestionResult | null;
};

const FIELD_CLASS =
  'w-full border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary';
const LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground';

export function StoryClient({
  defaultDraft,
  getStoryRunAction,
  modelOptions,
  providerMode,
  qwenConfigured,
  qwenModel,
  runStorySceneAction,
  suggestNextPromptsAction,
}: StoryClientProps) {
  const [storyTitle, setStoryTitle] = useState('Untitled interactive story');
  const [language, setLanguage] = useState('English');
  const [scenes, setScenes] = useState<StoryScene[]>([
    createScene(1, defaultDraft),
  ]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [isRunning, startRunTransition] = useTransition();
  const [isSuggesting, startSuggestTransition] = useTransition();
  const selectedScene = scenes[selectedSceneIndex] ?? scenes[0]!;
  const storyProgress = useMemo(
    () =>
      scenes
        .filter((scene) => scene.runId || scene.outputFiles.length > 0)
        .map((scene) => ({
          sceneNumber: scene.sceneNumber,
          prompt: scene.draft.prompt,
          outputFiles: scene.outputFiles,
          runId: scene.runId ?? '',
          status: scene.status,
        })),
    [scenes],
  );

  function updateSceneDraft(
    sceneIndex: number,
    update: (draft: StorySceneRunDraft) => StorySceneRunDraft,
  ) {
    setScenes((current) =>
      current.map((scene, index) =>
        index === sceneIndex
          ? resetSceneDraft(scene, update(scene.draft))
          : scene,
      ),
    );
  }

  function runScene(sceneIndex: number) {
    const scene = scenes[sceneIndex];

    if (!scene) return;

    setScenes((current) =>
      current.map((candidate, index) =>
        index === sceneIndex
          ? {
              ...candidate,
              error: null,
              outputFiles: [],
              run: null,
              runId: null,
              status: 'starting',
              suggestions: null,
            }
          : candidate,
      ),
    );

    startRunTransition(async () => {
      const response = await runStorySceneAction(scene.draft, {
        scene_number: scene.sceneNumber,
        story_title: storyTitle,
      });

      setScenes((current) =>
        current.map((candidate, index) => {
          if (index !== sceneIndex) return candidate;

          if (!response.ok) {
            return {
              ...candidate,
              error: response.error,
              status: 'failed_to_start',
            };
          }

          return patchSceneFromRun(candidate, response.run);
        }),
      );
    });
  }

  function refreshScene(sceneIndex: number) {
    const scene = scenes[sceneIndex];

    if (!scene?.runId) return;

    const refreshingRunId = scene.runId;

    startRunTransition(async () => {
      const response = await getStoryRunAction(refreshingRunId);

      setScenes((current) =>
        current.map((candidate, index) => {
          if (index !== sceneIndex) return candidate;
          if (candidate.runId !== refreshingRunId) return candidate;

          if (!response.ok) {
            return { ...candidate, error: response.error };
          }

          return patchSceneFromRun(candidate, response.run);
        }),
      );
    });
  }

  function suggestNext(sceneIndex: number) {
    const scene = scenes[sceneIndex];

    if (!scene) return;

    if (!canSuggestNext(scene)) {
      setScenes((current) =>
        current.map((candidate, index) =>
          index === sceneIndex
            ? {
                ...candidate,
                error:
                  scene.sceneNumber >= STORY_MAX_SCENES
                    ? `A story can have up to ${STORY_MAX_SCENES} scenes.`
                    : 'Refresh the scene until it succeeds and has output before asking for next prompts.',
              }
            : candidate,
        ),
      );
      return;
    }

    startSuggestTransition(async () => {
      const response = await suggestNextPromptsAction({
        language,
        lastScene: {
          sceneNumber: scene.sceneNumber,
          prompt: scene.draft.prompt,
          outputFiles: scene.outputFiles,
          runId: scene.runId ?? '',
          status: scene.status,
        },
        scenes:
          storyProgress.length > 0
            ? storyProgress
            : [
                {
                  sceneNumber: scene.sceneNumber,
                  prompt: scene.draft.prompt,
                  outputFiles: scene.outputFiles,
                  runId: scene.runId ?? '',
                  status: scene.status,
                },
              ],
        storyTitle,
        visualStyle: scene.draft.settings.visualFormat,
      });

      setScenes((current) =>
        current.map((candidate, index) => {
          if (index !== sceneIndex) return candidate;

          if (!response.ok) {
            return { ...candidate, error: response.error };
          }

          return { ...candidate, error: null, suggestions: response.result };
        }),
      );
    });
  }

  function chooseSuggestion(sceneIndex: number, suggestionIndex: number) {
    const scene = scenes[sceneIndex];
    const suggestion = scene?.suggestions?.suggestions[suggestionIndex];

    if (!scene || !suggestion) return;

    if (scene.sceneNumber >= STORY_MAX_SCENES) {
      setScenes((current) =>
        current.map((candidate, index) =>
          index === sceneIndex
            ? {
                ...candidate,
                error: `A story can have up to ${STORY_MAX_SCENES} scenes.`,
              }
            : candidate,
        ),
      );
      return;
    }

    const nextScene = createScene(scene.sceneNumber + 1, {
      editInstruction: suggestion.editInstruction,
      imagePrompt: suggestion.imagePrompt,
      prompt: suggestion.imagePrompt,
      settings: scene.draft.settings,
      videoPrompt: suggestion.videoPrompt,
    });

    setScenes((current) => [...current.slice(0, sceneIndex + 1), nextScene]);
    setSelectedSceneIndex(sceneIndex + 1);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Interactive Showrunner
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Story</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Run one scene, inspect the result, let Qwen suggest four next
            directions, then choose or edit the next prompt before spending the
            next run.
          </p>
        </div>
        <div className="hidden min-w-56 border border-border bg-background p-3 text-xs text-muted-foreground md:block">
          <p className="font-semibold text-foreground">Runtime</p>
          <p className="mt-1">Provider mode: {providerMode}</p>
          <p>Showrunner: {qwenConfigured ? qwenModel : 'local fallback'}</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <aside className="min-h-0 overflow-y-auto border-r border-border p-5">
          <div className="space-y-4">
            <TextField
              label="Story title"
              value={storyTitle}
              onChange={setStoryTitle}
            />
            <TextField
              label="Language"
              value={language}
              onChange={setLanguage}
            />
            <TextAreaField
              disabled={isSceneLocked(selectedScene)}
              label="Selected visual style"
              rows={4}
              value={selectedScene.draft.settings.visualFormat}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  settings: { ...draft.settings, visualFormat: value },
                }))
              }
            />
            <ModelSelect
              disabled={isSceneLocked(selectedScene)}
              label="Image model"
              options={modelOptions.imageModels}
              value={selectedScene.draft.settings.imageModel}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  settings: { ...draft.settings, imageModel: value },
                }))
              }
            />
            <ModelSelect
              disabled={isSceneLocked(selectedScene)}
              label="Video model"
              options={modelOptions.videoModels}
              value={selectedScene.draft.settings.videoModel}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  settings: { ...draft.settings, videoModel: value },
                }))
              }
            />
            <ModelSelect
              allowEmpty
              disabled={isSceneLocked(selectedScene)}
              label="Modify model"
              options={modelOptions.modifyModels}
              value={selectedScene.draft.settings.modifyModel}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  settings: { ...draft.settings, modifyModel: value },
                }))
              }
            />
            <NumberField
              disabled={isSceneLocked(selectedScene)}
              label="Seconds"
              max={10}
              min={3}
              value={selectedScene.draft.settings.durationSeconds}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  settings: { ...draft.settings, durationSeconds: value },
                }))
              }
            />
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto p-5">
          <div className="space-y-4">
            {scenes.map((scene, index) => (
              <SceneCard
                isRunning={isRunning}
                isSelected={selectedSceneIndex === index}
                isSuggesting={isSuggesting}
                key={scene.sceneNumber}
                scene={scene}
                onChooseSuggestion={(suggestionIndex) =>
                  chooseSuggestion(index, suggestionIndex)
                }
                onDraftChange={(update) => updateSceneDraft(index, update)}
                onRefresh={() => refreshScene(index)}
                onRun={() => runScene(index)}
                onSelect={() => setSelectedSceneIndex(index)}
                onSuggest={() => suggestNext(index)}
              />
            ))}
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-border bg-card p-5">
          <div className="space-y-4">
            <div>
              <p className={LABEL_CLASS}>Selected scene</p>
              <h2 className="mt-2 text-lg font-semibold">
                Scene {selectedScene.sceneNumber}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Edit settings here, then run the selected card in the timeline.
              </p>
            </div>
            <TextAreaField
              disabled={isSceneLocked(selectedScene)}
              label="Scene prompt"
              rows={6}
              value={selectedScene.draft.prompt}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  prompt: value,
                }))
              }
            />
            <TextAreaField
              disabled={isSceneLocked(selectedScene)}
              label="Image prompt override"
              rows={5}
              value={selectedScene.draft.imagePrompt}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  imagePrompt: value,
                }))
              }
            />
            <TextAreaField
              disabled={isSceneLocked(selectedScene)}
              label="Video prompt override"
              rows={5}
              value={selectedScene.draft.videoPrompt}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  videoPrompt: value,
                }))
              }
            />
            <TextAreaField
              disabled={isSceneLocked(selectedScene)}
              label="Edit instruction"
              rows={4}
              value={selectedScene.draft.editInstruction}
              onChange={(value) =>
                updateSceneDraft(selectedSceneIndex, (draft) => ({
                  ...draft,
                  editInstruction: value,
                }))
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SceneCard({
  isRunning,
  isSelected,
  isSuggesting,
  onChooseSuggestion,
  onDraftChange,
  onRefresh,
  onRun,
  onSelect,
  onSuggest,
  scene,
}: {
  isRunning: boolean;
  isSelected: boolean;
  isSuggesting: boolean;
  onChooseSuggestion: (index: number) => void;
  onDraftChange: (
    update: (draft: StorySceneRunDraft) => StorySceneRunDraft,
  ) => void;
  onRefresh: () => void;
  onRun: () => void;
  onSelect: () => void;
  onSuggest: () => void;
  scene: StoryScene;
}) {
  return (
    <article
      className={cn(
        'border bg-card p-4 transition',
        isSelected ? 'border-primary' : 'border-border',
      )}
    >
      <button
        className="block w-full text-left"
        type="button"
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Scene {scene.sceneNumber}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {scene.draft.prompt.slice(0, 90)}
              {scene.draft.prompt.length > 90 ? '...' : ''}
            </h2>
          </div>
          <span className="border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
            {scene.status}
          </span>
        </div>
      </button>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
        <textarea
          className={cn(FIELD_CLASS, 'min-h-28 resize-none leading-5')}
          disabled={isSceneLocked(scene)}
          value={scene.draft.prompt}
          onChange={(event) =>
            onDraftChange((draft) => ({ ...draft, prompt: event.target.value }))
          }
        />
        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={isRunning || isSceneLocked(scene)}
            type="button"
            onClick={onRun}
          >
            {scene.runId ? 'Run Again' : 'Run Scene'}
          </Button>
          <Button
            className="w-full"
            disabled={!scene.runId || isRunning}
            type="button"
            variant="outline"
            onClick={onRefresh}
          >
            Refresh Result
          </Button>
          <Button
            className="w-full"
            disabled={!canSuggestNext(scene) || isSuggesting}
            type="button"
            variant="outline"
            onClick={onSuggest}
          >
            Suggest Next
          </Button>
        </div>
      </div>

      {scene.error ? (
        <p className="mt-3 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {scene.error}
        </p>
      ) : null}

      {scene.outputFiles.length > 0 ? (
        <div className="mt-4 border border-border bg-background p-3">
          <p className={LABEL_CLASS}>Latest outputs</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {scene.outputFiles.map((file) => (
              <p className="truncate" key={file} title={file}>
                {file}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {scene.suggestions ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={LABEL_CLASS}>
                {scene.suggestions.provider === 'qwen-cloud'
                  ? `Qwen ${scene.suggestions.providerModel}`
                  : 'Local suggestions'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {scene.suggestions.storySummary}
              </p>
            </div>
          </div>
          {scene.suggestions.warning ? (
            <p className="border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              {scene.suggestions.warning}
            </p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {scene.suggestions.suggestions.map((suggestion, index) => (
              <button
                className="border border-border bg-background p-3 text-left transition hover:border-primary"
                key={suggestion.id}
                type="button"
                onClick={() => onChooseSuggestion(index)}
              >
                <p className="font-semibold">{suggestion.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {suggestion.narrativeIntent}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {suggestion.continuityNotes}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function TextField({
  disabled = false,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className={LABEL_CLASS}>{label}</span>
      <input
        className={FIELD_CLASS}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  disabled = false,
  label,
  max,
  min,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="block space-y-2">
      <span className={LABEL_CLASS}>{label}</span>
      <input
        className={FIELD_CLASS}
        disabled={disabled}
        max={max}
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TextAreaField({
  disabled = false,
  label,
  onChange,
  rows,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className={LABEL_CLASS}>{label}</span>
      <textarea
        className={cn(FIELD_CLASS, 'resize-none leading-5')}
        disabled={disabled}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ModelSelect({
  allowEmpty = false,
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  allowEmpty?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: StoryModelOption[];
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className={LABEL_CLASS}>{label}</span>
      <select
        className={FIELD_CLASS}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty ? <option value="">No modify step</option> : null}
        {options.map((option) => (
          <option
            disabled={!option.available}
            key={option.id}
            title={option.unavailableReason ?? undefined}
            value={option.id}
          >
            {option.label} - {option.providerLabel}
            {option.available ? '' : ' (unavailable)'}
          </option>
        ))}
      </select>
    </label>
  );
}

function createScene(
  sceneNumber: number,
  draft: StorySceneRunDraft,
): StoryScene {
  return {
    draft,
    error: null,
    outputFiles: [],
    run: null,
    runId: null,
    sceneNumber,
    status: 'draft',
    suggestions: null,
  };
}

function resetSceneDraft(
  scene: StoryScene,
  draft: StorySceneRunDraft,
): StoryScene {
  if (isSceneLocked(scene)) {
    return scene;
  }

  return {
    ...scene,
    draft,
    error: null,
    outputFiles: [],
    run: null,
    runId: null,
    status: 'draft',
    suggestions: null,
  };
}

function patchSceneFromRun(scene: StoryScene, run: Record<string, unknown>) {
  return {
    ...scene,
    error: null,
    outputFiles: readOutputFiles(run),
    run,
    runId: readRunId(run) ?? scene.runId,
    status: readRunStatus(run),
  };
}

function readRunId(run: Record<string, unknown>) {
  const id = run.id ?? run.run_id;

  return typeof id === 'string' ? id : null;
}

function readRunStatus(run: Record<string, unknown>) {
  const status = run.status;

  return typeof status === 'string' ? status : 'accepted';
}

function readOutputFiles(run: Record<string, unknown>) {
  const outputFiles = new Set<string>();

  for (const step of readSteps(run)) {
    const files = step.generation_output_file;

    if (!Array.isArray(files)) continue;

    for (const file of files) {
      if (typeof file === 'string') {
        outputFiles.add(file);
      }
    }
  }

  return [...outputFiles];
}

function readSteps(run: Record<string, unknown>) {
  const steps = run.steps;

  if (!Array.isArray(steps)) return [];

  return steps.filter(
    (step): step is Record<string, unknown> =>
      Boolean(step) && typeof step === 'object' && !Array.isArray(step),
  );
}

function isSceneLocked(scene: StoryScene) {
  return (
    scene.status === 'starting' ||
    scene.status === 'queued' ||
    scene.status === 'running'
  );
}

function canSuggestNext(scene: StoryScene) {
  return (
    scene.sceneNumber < STORY_MAX_SCENES &&
    scene.status === 'succeeded' &&
    scene.outputFiles.length > 0
  );
}
