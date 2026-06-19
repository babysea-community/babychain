import 'server-only';

import type { JsonObject } from '@/lib/chains/types';

import type { ChainAgentPromptContext } from '../types';

export type ChainAgentToolName =
  | 'read_downstream_schema'
  | 'read_previous_step_summary'
  | 'select_schema_defaults'
  | 'retrieve_brand_context';

export type ChainAgentToolResult = {
  name: ChainAgentToolName;
  output: JsonObject;
};

export const CHAIN_AGENT_TOOL_STRATEGY = {
  current: 'prompt_planning_context_only',
  tools: [],
  note: 'BabyChain currently passes previous-step context and downstream Semantic Lady schema as read-only planning context. Bedrock tool calling is not required until the agent needs external retrieval or multi-step API actions.',
} satisfies JsonObject;

export const CHAIN_AGENT_RESERVED_TOOL_FIELDS = [
  'generation_callback_url',
  'generation_input_audio_file',
  'generation_input_file',
  'generation_input_image_file',
  'generation_input_video_file',
  'generation_last_frame',
  'generation_output_file',
  'generation_provider_order',
  'generation_provider_used',
];

export function runChainAgentTools(
  context: ChainAgentPromptContext,
): ChainAgentToolResult[] {
  return [
    readDownstreamSchema(context),
    readPreviousStepSummary(context),
    selectSchemaDefaults(context),
    retrieveBrandContext(),
  ];
}

function readDownstreamSchema(
  context: ChainAgentPromptContext,
): ChainAgentToolResult {
  return {
    name: 'read_downstream_schema',
    output: {
      model_identifier: context.nextStep.modelIdentifier,
      schema: context.nextStep.schema ?? {},
      step_key: context.nextStep.stepKey,
      step_kind: context.nextStep.stepKind,
    },
  };
}

function readPreviousStepSummary(
  context: ChainAgentPromptContext,
): ChainAgentToolResult {
  return {
    name: 'read_previous_step_summary',
    output: {
      model_identifier: context.previousStep.modelIdentifier,
      output_count: context.previousStep.outputFiles.length,
      request_params: context.previousStep.requestParams ?? {},
      step_key: context.previousStep.stepKey,
      step_kind: context.previousStep.stepKind,
    },
  };
}

function selectSchemaDefaults(
  context: ChainAgentPromptContext,
): ChainAgentToolResult {
  const schema = context.nextStep.schema;
  const properties =
    schema &&
    typeof schema.properties === 'object' &&
    !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, JsonObject>)
      : {};
  const defaults: JsonObject = {};

  for (const [key, value] of Object.entries(properties)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'default' in value
    ) {
      defaults[key] = value.default;
    }
  }

  return {
    name: 'select_schema_defaults',
    output: {
      defaults,
      note: 'Defaults are read-only context. The agent must return generation_prompt plus every required downstream schema field that is not BabyChain-owned media handoff, and may return supported optional generation_* fields when they improve the result.',
      required: Array.isArray(schema?.required) ? schema.required : [],
    },
  };
}

function retrieveBrandContext(): ChainAgentToolResult {
  return {
    name: 'retrieve_brand_context',
    output: {
      available: false,
      reason:
        'No Bedrock Knowledge Base is configured yet. Use current run context, media, and downstream schema only.',
    },
  };
}
