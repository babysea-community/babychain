import 'server-only';

import type { ChainAgentPromptContext, ChainAgentResult } from './types';
import type { JsonObject, JsonValue } from '@/lib/chains/types';

export type ChainAgentValidationResult =
  | { ok: true; checkedParams: string[] }
  | { ok: false; checkedParams: string[]; error: string };

export function validateChainAgentResult(
  result: Pick<
    ChainAgentResult,
    'selectedParams' | 'selectedPrompt' | 'suggestions'
  >,
  context: ChainAgentPromptContext,
): ChainAgentValidationResult {
  const schema = context.nextStep.schema;
  const params = result.selectedParams;
  const checkedParams = Object.keys(params).sort();

  if (!schema || typeof schema !== 'object') {
    return validatePromptEnhancement(result, context, checkedParams);
  }

  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];
  const properties =
    schema.properties &&
    typeof schema.properties === 'object' &&
    !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, JsonObject>)
      : {};

  for (const fieldName of required) {
    if (!hasProvidedAgentValue(params[fieldName])) {
      return {
        ok: false,
        checkedParams,
        error: `${fieldName} is required by the downstream schema.`,
      };
    }
  }

  for (const [key, value] of Object.entries(params)) {
    const field = properties[key];

    if (!field) {
      return {
        ok: false,
        checkedParams,
        error: `${key} is not supported by the downstream schema.`,
      };
    }

    const error = validateAgentFieldValue(key, value, field);
    if (error) {
      return { ok: false, checkedParams, error };
    }
  }

  return validatePromptEnhancement(result, context, checkedParams);
}

function validatePromptEnhancement(
  result: Pick<ChainAgentResult, 'selectedPrompt' | 'suggestions'>,
  context: ChainAgentPromptContext,
  checkedParams: string[],
): ChainAgentValidationResult {
  const selected = normalizeComparablePrompt(result.selectedPrompt);
  const existing = normalizeComparablePrompt(
    stringValue(
      isRecord(context.nextStep.requestParams)
        ? context.nextStep.requestParams.generation_prompt
        : undefined,
    ) ?? '',
  );
  const previous = normalizeComparablePrompt(
    stringValue(
      isRecord(context.previousStep.requestParams)
        ? context.previousStep.requestParams.generation_prompt
        : undefined,
    ) ?? '',
  );
  const prompts = result.suggestions.map((suggestion) =>
    normalizeComparablePrompt(suggestion.prompt),
  );
  const uniquePrompts = new Set(prompts.filter(Boolean));

  if (existing && selected === existing) {
    return {
      ok: false,
      checkedParams,
      error:
        'selected_prompt is the same as the existing downstream prompt. Rewrite it with clearly improved motion, camera, pacing, and continuity details.',
    };
  }

  if (previous && selected === previous) {
    return {
      ok: false,
      checkedParams,
      error:
        'selected_prompt is the same as the previous step prompt. Rewrite it for the next step instead of copying the source prompt.',
    };
  }

  if (uniquePrompts.size < Math.min(3, result.suggestions.length)) {
    return {
      ok: false,
      checkedParams,
      error: 'suggestions must be meaningfully distinct from each other.',
    };
  }

  return { ok: true, checkedParams };
}

function validateAgentFieldValue(
  key: string,
  value: JsonValue,
  field: JsonObject,
) {
  const enumValues = Array.isArray(field.enum) ? field.enum : [];
  if (enumValues.length > 0 && !enumValues.includes(value)) {
    return `${key} must be one of: ${enumValues.join(', ')}.`;
  }

  if (field.type === 'number' || field.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${key} must be a finite number.`;
    }

    if (field.type === 'integer' && !Number.isInteger(value)) {
      return `${key} must be an integer.`;
    }

    if (typeof field.minimum === 'number' && value < field.minimum) {
      return `${key} must be >= ${field.minimum}.`;
    }

    if (typeof field.maximum === 'number' && value > field.maximum) {
      return `${key} must be <= ${field.maximum}.`;
    }
  }

  if (field.type === 'boolean' && typeof value !== 'boolean') {
    return `${key} must be a boolean.`;
  }

  if (field.type === 'string' && typeof value !== 'string') {
    return `${key} must be a string.`;
  }

  if (field.type === 'array' && !Array.isArray(value)) {
    return `${key} must be an array.`;
  }

  if (
    field.type === 'object' &&
    (!value || typeof value !== 'object' || Array.isArray(value))
  ) {
    return `${key} must be an object.`;
  }

  return null;
}

function hasProvidedAgentValue(value: JsonValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizeComparablePrompt(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
