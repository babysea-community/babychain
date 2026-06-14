import 'server-only';

import {
  getModel as getSemanticLadyModel,
  listModelNames as listSemanticLadyModelNames,
  type SemanticLadyField,
  type SemanticLadyModel,
} from 'semantic-lady';

import { BabyChainError } from '@/lib/utils/errors';

/**
 * Semantic Lady is the `generation_*` schema core for BYOK mode. BabyChain
 * model identifiers map 1:1 onto Semantic Lady `apiName`s, so the published
 * catalog defines which unified fields each of the 57 models accepts and the
 * value constraints for those fields.
 *
 * BabyChain's chain dialect predates Semantic Lady's split media fields, so
 * two aliases are translated before validation:
 *
 *   - `generation_input_file`              → `generation_input_image_file`
 *     (or `generation_input_video_file` when the model only consumes video)
 *   - `generation_input_file_last_content` → `generation_input_image_file_last_content`
 *
 * Raw provider fields (non-`generation_*` keys) are not validated here; BYOK
 * callers may always speak the raw provider dialect. Only the unified
 * `generation_*` vocabulary is checked so typos and invalid values fail fast
 * at run creation instead of surfacing as opaque provider 4xx errors.
 */

/**
 * Keys consumed by the chain runner or provider adapters rather than the
 * model schema:
 *
 *   - `generation_provider_order` is a BabySea-mode concept that BYOK
 *     adapters skip.
 *   - `generation_config` is the documented raw-config escape consumed by
 *     the Google adapter (merged into Gemini `generationConfig`).
 */
const CHAIN_LEVEL_GENERATION_KEYS = new Set([
  'generation_config',
  'generation_provider_order',
]);

const RATIO_VALUE_PATTERN = /^\d{2,5}[:x*]\d{2,5}$/;
const SIZE_VALUE_PATTERN = /^(?:\d{2,5}[x*]\d{2,5}|\d+(?:\.\d+)?K)$/i;
const UNKNOWN_KEY_DISPLAY_LIMIT = 100;

const SEMANTIC_MODEL_NAMES: ReadonlySet<string> = new Set(
  listSemanticLadyModelNames(),
);

export function hasSemanticModel(modelIdentifier: string): boolean {
  return SEMANTIC_MODEL_NAMES.has(modelIdentifier);
}

export function getSemanticModel(
  modelIdentifier: string,
): SemanticLadyModel | null {
  return getSemanticLadyModel(modelIdentifier) ?? null;
}

export function getSemanticModelSchemaFields(
  modelIdentifier: string,
): readonly SemanticLadyField[] | null {
  return getSemanticModel(modelIdentifier)?.schema ?? null;
}

export type SemanticJsonObject = Record<string, unknown>;

export function createSemanticRequestSchema(
  modelIdentifier: string,
): SemanticJsonObject {
  const fields = getSemanticModelSchemaFields(modelIdentifier) ?? [];
  const required = fields
    .filter((field) => field.required)
    .map((field) => field.name);

  return {
    type: 'object',
    ...(required.length > 0 ? { required } : {}),
    properties: Object.fromEntries(
      fields.map((field) => [field.name, semanticFieldJsonSchema(field)]),
    ),
  };
}

export function semanticFieldJsonSchema(field: {
  default?: unknown;
  enum?: readonly (number | string)[];
  max?: number;
  min?: number;
  type: string;
}): SemanticJsonObject {
  const schema: SemanticJsonObject = {
    type: semanticJsonType(field.type),
  };

  if (field.enum && field.enum.length > 0) {
    schema.enum = [...field.enum];
  }

  if (field.default !== undefined) {
    schema.default = field.default;
  }

  if (typeof field.min === 'number') {
    schema.minimum = field.min;
  }

  if (typeof field.max === 'number') {
    schema.maximum = field.max;
  }

  if (field.type === 'integer') {
    schema.type = 'integer';
  }

  if (field.type === 'url-array' || field.type === 'string-array') {
    schema.items = {
      type: 'string',
      ...(field.type === 'url-array' ? { format: 'uri' } : {}),
    };
  }

  if (field.type === 'url') {
    schema.format = 'uri';
  }

  return schema;
}

function semanticJsonType(type: string) {
  switch (type) {
    case 'boolean':
      return 'boolean';
    case 'integer':
      return 'integer';
    case 'number':
      return 'number';
    case 'object':
      return 'object';
    case 'string-array':
    case 'url-array':
      return 'array';
    default:
      return 'string';
  }
}

/**
 * Chain step role gates, derived entirely from the Semantic Lady catalog so
 * BabyChain never hand-maintains per-model role tables:
 *
 *   - `image_model`  : kind `image`.
 *   - `refine_model` : kind `image` with the `image-to-image` workflow (the
 *                      chain wires the previous image output in).
 *   - `video_model`  : kind `video` with the `image-to-video` workflow.
 *   - `modify_model` : kind `video` with the `video-to-video` workflow.
 *
 * Chain steps are prompt-driven (the BabyChain counterpart of a ComfyUI
 * prompt graph), so video roles additionally require the model to accept
 * `generation_prompt`. That requirement excludes performance-transfer models
 * (`runway/act-two`, `wan/2.2-animate-*`): they take no text prompt and need
 * reference media the chain cannot wire from a previous step.
 */
export function isImageChainModel(modelIdentifier: string): boolean {
  return getSemanticModel(modelIdentifier)?.kind === 'image';
}

export function isImageInputCapableModel(modelIdentifier: string): boolean {
  const model = getSemanticModel(modelIdentifier);

  return model?.kind === 'image' && model.workflows.includes('image-to-image');
}

export function isTextToImageCapableModel(modelIdentifier: string): boolean {
  const model = getSemanticModel(modelIdentifier);

  return model?.kind === 'image' && model.workflows.includes('text-to-image');
}

export function isImageToVideoChainModel(modelIdentifier: string): boolean {
  const model = getSemanticModel(modelIdentifier);

  return (
    model?.kind === 'video' &&
    model.workflows.includes('image-to-video') &&
    hasGenerationPromptField(model)
  );
}

export function isVideoToVideoChainModel(modelIdentifier: string): boolean {
  const model = getSemanticModel(modelIdentifier);

  return (
    model?.kind === 'video' &&
    model.workflows.includes('video-to-video') &&
    hasGenerationPromptField(model)
  );
}

function hasGenerationPromptField(model: SemanticLadyModel): boolean {
  return model.schema.some((field) => field.name === 'generation_prompt');
}

export type ByokGenerationFieldIssue = {
  message: string;
  path: string[];
};

/**
 * Validate the `generation_*` fields of one BYOK model input object against
 * the Semantic Lady schema for the model. Returns `null` when the input is
 * valid (or when the model is unknown to Semantic Lady, which the model
 * library rejects separately).
 */
export function findByokGenerationFieldIssue(
  modelIdentifier: string,
  params: unknown,
): ByokGenerationFieldIssue | null {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return null;
  }

  const model = getSemanticModel(modelIdentifier);

  if (!model) {
    return null;
  }

  const fieldByName = new Map<string, SemanticLadyField>(
    model.schema.map((field) => [field.name, field]),
  );

  for (const [key, value] of Object.entries(
    params as Record<string, unknown>,
  )) {
    if (!key.startsWith('generation_') || value === undefined) {
      continue;
    }

    if (CHAIN_LEVEL_GENERATION_KEYS.has(key)) {
      continue;
    }

    const fieldName = resolveSemanticFieldName(key, fieldByName);
    const field = fieldName ? fieldByName.get(fieldName) : undefined;

    if (!field) {
      return {
        message: unknownFieldMessage(key, modelIdentifier, model),
        path: [key],
      };
    }

    const valueIssue = findFieldValueIssue(field, key, value);

    if (valueIssue) {
      return valueIssue;
    }
  }

  return null;
}

export function assertByokGenerationFields(
  modelIdentifier: string,
  params: unknown,
  paramsKey: string,
) {
  const issue = findByokGenerationFieldIssue(modelIdentifier, params);

  if (!issue) {
    return;
  }

  throw new BabyChainError('invalid_chain_input', issue.message, 400, {
    path: [paramsKey, ...issue.path],
  });
}

function resolveSemanticFieldName(
  key: string,
  fieldByName: ReadonlyMap<string, SemanticLadyField>,
): string | null {
  if (fieldByName.has(key)) {
    return key;
  }

  if (key === 'generation_input_file') {
    if (fieldByName.has('generation_input_image_file')) {
      return 'generation_input_image_file';
    }

    return fieldByName.has('generation_input_video_file')
      ? 'generation_input_video_file'
      : null;
  }

  if (key === 'generation_input_file_last_content') {
    return fieldByName.has('generation_input_image_file_last_content')
      ? 'generation_input_image_file_last_content'
      : null;
  }

  return null;
}

function findFieldValueIssue(
  field: SemanticLadyField,
  key: string,
  value: unknown,
): ByokGenerationFieldIssue | null {
  switch (field.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        return issue(key, 'must be a boolean.');
      }
      return null;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return issue(key, 'must be an integer.');
      }
      return (
        numberEnumIssue(field, key, value) ??
        numberBoundsIssue(field, key, value)
      );
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return issue(key, 'must be a finite number.');
      }
      return (
        numberEnumIssue(field, key, value) ??
        numberBoundsIssue(field, key, value)
      );
    case 'enum':
      return enumIssue(field, key, value);
    case 'string':
    case 'url':
      if (typeof value !== 'string') {
        return issue(key, 'must be a string.');
      }
      return null;
    case 'string-array':
    case 'url-array':
      if (typeof value === 'string') {
        return null;
      }
      if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === 'string' && item.length > 0)
      ) {
        return issue(key, 'must be an array of non-empty strings.');
      }
      return null;
    case 'object':
      if (!value || typeof value !== 'object') {
        return issue(key, 'must be an object or array.');
      }
      return null;
    default:
      return null;
  }
}

function enumIssue(
  field: SemanticLadyField,
  key: string,
  value: unknown,
): ByokGenerationFieldIssue | null {
  if (typeof value !== 'string') {
    return issue(key, 'must be a string.');
  }

  const allowed = field.enum ?? [];
  const normalized = value.toLowerCase();

  if (
    allowed.some((candidate) => String(candidate).toLowerCase() === normalized)
  ) {
    return null;
  }

  // Aspect ratios and resolutions accept provider-native pixel values as an
  // escape hatch (e.g. Runway `1280:720`, DashScope `1024*1024`).
  if (key === 'generation_ratio' && RATIO_VALUE_PATTERN.test(value)) {
    return null;
  }

  if (key === 'generation_resolution' && SIZE_VALUE_PATTERN.test(value)) {
    return null;
  }

  return issue(key, `must be one of: ${allowed.join(', ')}.`);
}

function numberEnumIssue(
  field: SemanticLadyField,
  key: string,
  value: number,
): ByokGenerationFieldIssue | null {
  const enumValues = (field.enum ?? []) as readonly unknown[];
  const allowed = enumValues.filter(
    (candidate): candidate is number => typeof candidate === 'number',
  );

  if (allowed.length === 0 || allowed.includes(value)) {
    return null;
  }

  return issue(key, `must be one of: ${allowed.join(', ')}.`);
}

function numberBoundsIssue(
  field: SemanticLadyField,
  key: string,
  value: number,
): ByokGenerationFieldIssue | null {
  if (field.min !== undefined && value < field.min) {
    return issue(key, `must be >= ${field.min}.`);
  }

  if (field.max !== undefined && value > field.max) {
    return issue(key, `must be <= ${field.max}.`);
  }

  return null;
}

function unknownFieldMessage(
  key: string,
  modelIdentifier: string,
  model: SemanticLadyModel,
) {
  const supported = model.schema
    .map((field) => field.name)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
  const displayKey =
    key.length > UNKNOWN_KEY_DISPLAY_LIMIT
      ? `${key.slice(0, UNKNOWN_KEY_DISPLAY_LIMIT)}…`
      : key;

  return (
    `Unknown generation field "${displayKey}" for model "${modelIdentifier}". ` +
    `Supported generation fields: ${supported}. ` +
    'Use raw provider field names (without the generation_ prefix) to pass provider-specific parameters.'
  );
}

function issue(key: string, message: string): ByokGenerationFieldIssue {
  return { message: `${key} ${message}`, path: [key] };
}
