import 'server-only';

import type { ChainStepRecord, JsonObject } from '@/lib/chains/types';

export type ChainAgentMode = 'review' | 'autopilot';
export type ChainAgentProvider = 'bedrock';

export type ChainAgentConfig = {
  mode: ChainAgentMode;
  provider: ChainAgentProvider;
  modelIdentifier: string;
};

export type ChainAgentMediaReference = {
  contentType: string | null;
  kind: 'image' | 'video';
  url: string;
};

export type ChainAgentPromptContext = {
  flow: {
    currentStepKey: string;
    nextStepKey: string;
    mode: ChainAgentMode;
  };
  previousStep: Pick<
    ChainStepRecord,
    'modelIdentifier' | 'outputFiles' | 'requestParams' | 'stepKey' | 'stepKind'
  >;
  nextStep: Pick<
    ChainStepRecord,
    'modelIdentifier' | 'requestParams' | 'stepKey' | 'stepKind'
  > & { schema?: JsonObject | null };
  currentInput: JsonObject;
};

export type ChainAgentSuggestion = {
  title: string;
  prompt: string;
  params?: JsonObject;
  rationale?: string | null;
};

export type ChainAgentResult = {
  observations: JsonObject;
  suggestions: ChainAgentSuggestion[];
  selectedPrompt: string;
  selectedParams: JsonObject;
  rawText: string;
};

export interface ChainAgent {
  suggestNextStep(input: ChainAgentPromptContext): Promise<ChainAgentResult>;
}
