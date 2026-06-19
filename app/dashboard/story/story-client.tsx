'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import type {
  ShowrunnerBrief,
  ShowrunnerChainMapping,
  ShowrunnerPlan,
} from '@/lib/showrunner';
import { cn } from '@/lib/utils';

export type StoryModelOption = {
  available: boolean;
  id: string;
  label: string;
  providerLabel: string;
  unavailableReason: string | null;
};

export type StoryGenerationActionResult =
  | {
      ok: true;
      result: {
        mapping: ShowrunnerChainMapping;
        plan: ShowrunnerPlan;
        provider: 'local-draft' | 'qwen-cloud';
        providerModel: string;
        warning: string | null;
      };
    }
  | { ok: false; error: string };

export type StoryRunActionResult =
  | { ok: true; run: Record<string, unknown> }
  | { ok: false; error: string };

type StoryClientProps = {
  defaultBrief: ShowrunnerBrief;
  generateStoryAction: (
    input: Record<string, unknown>,
  ) => Promise<StoryGenerationActionResult>;
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
};

type GenerationResult = Extract<
  StoryGenerationActionResult,
  { ok: true }
>['result'];

const FIELD_CLASS =
  'w-full border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary';
const LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground';

export function StoryClient({
  defaultBrief,
  generateStoryAction,
  modelOptions,
  providerMode,
  qwenConfigured,
  qwenModel,
  runStorySceneAction,
}: StoryClientProps) {
  const [brief, setBrief] = useState<ShowrunnerBrief>(defaultBrief);
  const [providerStrategy, setProviderStrategy] = useState<'auto' | 'local'>(
    qwenConfigured ? 'auto' : 'local',
  );
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selectedScene, setSelectedScene] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [runMessages, setRunMessages] = useState<Record<number, string>>({});
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isRunning, startRunTransition] = useTransition();

  const selectedMappedScene = result?.mapping.scenes[selectedScene] ?? null;
  const selectedPlanScene = result?.plan.scenes[selectedScene] ?? null;
  const payloadJson = useMemo(
    () =>
      selectedMappedScene
        ? JSON.stringify(selectedMappedScene.chainInput, null, 2)
        : '',
    [selectedMappedScene],
  );

  function updateBrief<K extends keyof ShowrunnerBrief>(
    key: K,
    value: ShowrunnerBrief[K],
  ) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  function generateStory() {
    setError(null);
    setCopied(false);
    startGenerateTransition(async () => {
      const response = await generateStoryAction({
        ...brief,
        providerStrategy,
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setResult(response.result);
      setSelectedScene(0);
      setRunMessages({});
    });
  }

  function runScene(sceneIndex: number) {
    const scene = result?.mapping.scenes[sceneIndex];

    if (!scene || !result) {
      return;
    }

    setRunMessages((current) => ({
      ...current,
      [scene.sceneNumber]: 'Starting run...',
    }));
    startRunTransition(async () => {
      const response = await runStorySceneAction(scene.chainInput, {
        provider: result.provider,
        provider_model: result.providerModel,
        scene_number: scene.sceneNumber,
        scene_title: scene.title,
        story_title: result.plan.title,
      });

      setRunMessages((current) => ({
        ...current,
        [scene.sceneNumber]: response.ok
          ? `Run started: ${readRunId(response.run)}`
          : response.error,
      }));
    });
  }

  async function copyPayload() {
    if (!payloadJson) {
      return;
    }

    await navigator.clipboard.writeText(payloadJson);
    setCopied(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            BabyChain Showrunner
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Story Builder
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Turn a short drama brief into a structured scene plan and
            BabyChain-compatible image/video chain inputs.
          </p>
        </div>
        <div className="hidden min-w-48 border border-border bg-background p-3 text-xs text-muted-foreground md:block">
          <p className="font-semibold text-foreground">Runtime</p>
          <p className="mt-1">Provider mode: {providerMode}</p>
          <p>Qwen: {qwenConfigured ? qwenModel : 'local draft fallback'}</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)_24rem]">
        <section className="min-h-0 overflow-y-auto border-r border-border p-5">
          <div className="space-y-4">
            <TextAreaField
              label="Story idea"
              rows={6}
              value={brief.idea}
              onChange={(value) => updateBrief('idea', value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Genre"
                value={brief.genre}
                onChange={(value) => updateBrief('genre', value)}
              />
              <TextField
                label="Tone"
                value={brief.tone}
                onChange={(value) => updateBrief('tone', value)}
              />
            </div>

            <TextField
              label="Visual style"
              value={brief.visualStyle}
              onChange={(value) => updateBrief('visualStyle', value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Scenes"
                max={6}
                min={1}
                value={brief.sceneCount}
                onChange={(value) => updateBrief('sceneCount', value)}
              />
              <NumberField
                label="Seconds"
                max={180}
                min={15}
                value={brief.durationSeconds}
                onChange={(value) => updateBrief('durationSeconds', value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Audience"
                value={brief.audience}
                onChange={(value) => updateBrief('audience', value)}
              />
              <TextField
                label="Language"
                value={brief.language}
                onChange={(value) => updateBrief('language', value)}
              />
            </div>

            <TextAreaField
              label="Character notes"
              rows={4}
              value={brief.characterNotes}
              onChange={(value) => updateBrief('characterNotes', value)}
            />

            <ModelSelect
              label="Image model"
              options={modelOptions.imageModels}
              value={brief.imageModel}
              onChange={(value) => updateBrief('imageModel', value)}
            />
            <ModelSelect
              label="Video model"
              options={modelOptions.videoModels}
              value={brief.videoModel}
              onChange={(value) => updateBrief('videoModel', value)}
            />
            <ModelSelect
              allowEmpty
              label="Modify model"
              options={modelOptions.modifyModels}
              value={brief.modifyModel}
              onChange={(value) => updateBrief('modifyModel', value)}
            />

            <div className="space-y-2 border border-border bg-card p-3">
              <p className={LABEL_CLASS}>Planner</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={providerStrategy === 'auto'}
                  disabled={!qwenConfigured}
                  name="providerStrategy"
                  type="radio"
                  onChange={() => setProviderStrategy('auto')}
                />
                Qwen Cloud when configured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={providerStrategy === 'local'}
                  name="providerStrategy"
                  type="radio"
                  onChange={() => setProviderStrategy('local')}
                />
                Local draft
              </label>
            </div>

            {error ? (
              <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              className="w-full"
              disabled={isGenerating}
              type="button"
              onClick={generateStory}
            >
              {isGenerating ? 'Generating...' : 'Generate Story Plan'}
            </Button>
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto p-5">
          {result ? (
            <div className="space-y-5">
              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {result.provider === 'qwen-cloud'
                    ? `Qwen Cloud - ${result.providerModel}`
                    : 'Local Draft'}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {result.plan.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {result.plan.logline}
                </p>
                <p className="mt-4 text-sm leading-6">{result.plan.synopsis}</p>
                {result.warning ? (
                  <p className="mt-4 border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                    {result.warning}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-3">
                  {result.plan.scenes.map((scene, index) => (
                    <button
                      className={cn(
                        'w-full border p-4 text-left transition',
                        selectedScene === index
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/50',
                      )}
                      key={scene.sceneNumber}
                      type="button"
                      onClick={() => setSelectedScene(index)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Scene {scene.sceneNumber}
                          </p>
                          <h3 className="mt-1 font-semibold">{scene.title}</h3>
                        </div>
                        <Button
                          disabled={isRunning}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            runScene(index);
                          }}
                        >
                          Run
                        </Button>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {scene.storyBeat}
                      </p>
                      {runMessages[scene.sceneNumber] ? (
                        <p className="mt-3 border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                          {runMessages[scene.sceneNumber]}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 border border-border bg-card p-4">
                  <p className={LABEL_CLASS}>Characters</p>
                  {result.plan.characters.map((character) => (
                    <div
                      className="border-t border-border pt-3"
                      key={character.name}
                    >
                      <p className="font-semibold">{character.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {character.role}
                      </p>
                      <p className="mt-2 text-sm">{character.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyPreview />
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-border bg-card p-5">
          {selectedPlanScene && selectedMappedScene ? (
            <div className="space-y-4">
              <div>
                <p className={LABEL_CLASS}>Selected scene</p>
                <h2 className="mt-2 text-lg font-semibold">
                  {selectedPlanScene.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedPlanScene.cameraDirection}
                </p>
              </div>

              <ScenePrompt
                label="Image prompt"
                value={selectedPlanScene.imagePrompt}
              />
              <ScenePrompt
                label="Video prompt"
                value={selectedPlanScene.videoPrompt}
              />
              {selectedPlanScene.editInstruction ? (
                <ScenePrompt
                  label="Edit instruction"
                  value={selectedPlanScene.editInstruction}
                />
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={LABEL_CLASS}>BabyChain input</p>
                  <Button
                    disabled={!payloadJson}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={copyPayload}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="max-h-96 overflow-auto border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
                  {payloadJson}
                </pre>
              </div>
            </div>
          ) : (
            <div className="border border-border bg-background p-4 text-sm text-muted-foreground">
              Generate a plan to inspect scene prompts and BabyChain payloads.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className={LABEL_CLASS}>{label}</span>
      <input
        className={FIELD_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  value,
}: {
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
  label,
  onChange,
  rows,
  value,
}: {
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
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ModelSelect({
  allowEmpty = false,
  label,
  onChange,
  options,
  value,
}: {
  allowEmpty?: boolean;
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

function ScenePrompt({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background p-3">
      <p className={LABEL_CLASS}>{label}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex min-h-full items-center justify-center border border-dashed border-border bg-card p-8 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          No plan yet
        </p>
        <h2 className="mt-2 text-xl font-semibold">Generate a story plan</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          The plan will appear as editable narrative structure, scene prompts,
          and BabyChain-ready chain inputs.
        </p>
      </div>
    </div>
  );
}

function readRunId(run: Record<string, unknown>) {
  const id = run.id ?? run.run_id;

  if (typeof id === 'string') {
    return id;
  }

  return 'accepted';
}
