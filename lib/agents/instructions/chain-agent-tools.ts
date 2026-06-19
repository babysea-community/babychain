import 'server-only';

import type { JsonObject } from '@/lib/chains/types';

export const CHAIN_AGENT_TOOL_STRATEGY = {
  current: 'schema_context_only',
  tools: [],
  note: 'BabyChain currently passes the downstream Semantic Lady schema directly in the prompt. Bedrock tool calling is not required until the agent needs external retrieval or multi-step API actions.',
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
