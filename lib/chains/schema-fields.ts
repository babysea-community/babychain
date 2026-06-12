import type { z } from 'zod';

import type { ChainInputField } from './types';

type ZodDef = Record<string, unknown>;

export function deriveChainInputFields(
  schema: z.ZodType,
  overrides: ChainInputField[] = [],
): ChainInputField[] {
  const shape = getObjectShape(schema);
  const overrideByName = new Map(
    overrides.map((field): [string, ChainInputField] => [field.name, field]),
  );

  if (!shape) {
    return overrides;
  }

  return Object.entries(shape).map(([name, fieldSchema]) => {
    const override = overrideByName.get(name);
    const { core, defaultValue, isOptional } = unwrap(fieldSchema);
    const required = override?.required ?? !isOptional;
    const field: ChainInputField = {
      name,
      type: getFieldType(core),
      required,
      description:
        fieldSchema.description ?? override?.description ?? humanizeName(name),
    };
    const enumValues = getEnumValues(core);
    const bounds = getNumberBounds(core);

    if (override?.default !== undefined) {
      field.default = override.default;
    } else if (!required && defaultValue !== undefined) {
      field.default = defaultValue as ChainInputField['default'];
    }

    if (enumValues) {
      field.enum = enumValues;
    } else if (override?.enum) {
      field.enum = override.enum;
    }

    if (bounds.min !== undefined) {
      field.min = bounds.min;
    }

    if (bounds.max !== undefined) {
      field.max = bounds.max;
    }

    return field;
  });
}

function getObjectShape(schema: z.ZodType) {
  const objectSchema = unwrapToObject(schema as z.ZodTypeAny);

  return objectSchema
    ? (objectSchema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape
    : null;
}

function unwrapToObject(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  let current = schema;

  for (;;) {
    const name = typeName(current);

    if (name === 'ZodObject') {
      return current;
    }

    const next = unwrapOne(current);

    if (!next || next === current) {
      return null;
    }

    current = next;
  }
}

function unwrap(schema: z.ZodTypeAny) {
  let current = schema;
  let defaultValue: unknown;
  let isOptional = false;

  for (;;) {
    const name = typeName(current);

    if (name === 'ZodDefault') {
      const value = (current._def as { defaultValue: unknown }).defaultValue;
      defaultValue = typeof value === 'function' ? value() : value;
      isOptional = true;
      current = (current._def as { innerType: z.ZodTypeAny }).innerType;
      continue;
    }

    if (name === 'ZodOptional' || name === 'ZodNullable') {
      isOptional = true;
      current = (current._def as { innerType: z.ZodTypeAny }).innerType;
      continue;
    }

    const next = unwrapOne(current);

    if (!next || next === current) {
      break;
    }

    current = next;
  }

  return { core: current, defaultValue, isOptional };
}

function unwrapOne(schema: z.ZodTypeAny) {
  const name = typeName(schema);

  if (name === 'ZodEffects') {
    return (schema._def as { schema: z.ZodTypeAny }).schema;
  }

  if (name === 'ZodPipeline') {
    return (schema._def as { out: z.ZodTypeAny }).out;
  }

  if (name === 'ZodOptional' || name === 'ZodNullable') {
    return (schema._def as { innerType: z.ZodTypeAny }).innerType;
  }

  if (name === 'ZodDefault') {
    return (schema._def as { innerType: z.ZodTypeAny }).innerType;
  }

  return null;
}

function getFieldType(core: z.ZodTypeAny): ChainInputField['type'] {
  const name = typeName(core);

  switch (name) {
    case 'ZodArray':
      return 'array';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodNumber':
      return 'number';
    case 'ZodObject':
    case 'ZodRecord':
      return 'object';
    default:
      return 'string';
  }
}

function getEnumValues(core: z.ZodTypeAny) {
  if (typeName(core) === 'ZodEnum') {
    return (core._def as { values: string[] }).values;
  }

  if (typeName(core) !== 'ZodUnion') {
    return undefined;
  }

  const values = (core._def as { options: z.ZodTypeAny[] }).options
    .map((option) =>
      typeName(option) === 'ZodLiteral'
        ? (option._def as { value: unknown }).value
        : undefined,
    )
    .filter((value): value is string | number | boolean => value !== undefined);

  return values.length > 0 ? values.map(String) : undefined;
}

function getNumberBounds(core: z.ZodTypeAny) {
  if (typeName(core) !== 'ZodNumber') {
    return {};
  }

  const checks =
    (core._def as { checks?: Array<{ kind: string; value: number }> }).checks ??
    [];
  const bounds: { min?: number; max?: number } = {};

  for (const check of checks) {
    if (check.kind === 'min') {
      bounds.min = check.value;
    }

    if (check.kind === 'max') {
      bounds.max = check.value;
    }
  }

  return bounds;
}

function typeName(schema: z.ZodTypeAny) {
  return (schema._def as ZodDef).typeName as string;
}

function humanizeName(name: string) {
  return name.replaceAll('_', ' ');
}
