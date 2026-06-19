import { describe, expect, it } from 'vitest';

import { validateChainAgentResult } from '@/lib/agents/validation';
import type {
  ChainAgentPromptContext,
  ChainAgentResult,
} from '@/lib/agents/types';

describe('validateChainAgentResult', () => {
  it('rejects unsupported scene drift hidden in selected params prompt', () => {
    const result = validateChainAgentResult(
      resultWithPrompt({
        selectedPrompt:
          'The portrait stays in place as she blinks and the film grain breathes.',
        generationPrompt:
          'A young Japanese woman walks through a park with flowers and greenery.',
      }),
      contextWithCurrentInput({}),
    );

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('unsupported new environment'),
    });
  });

  it('allows an explicitly requested scene relocation', () => {
    const result = validateChainAgentResult(
      resultWithPrompt({
        selectedPrompt:
          'Move her into a quiet garden while preserving her face, color-film texture, and shallow portrait focus.',
        generationPrompt:
          'Move her into a quiet garden while preserving her face, color-film texture, and shallow portrait focus.',
      }),
      contextWithCurrentInput({
        generation_prompt:
          'Move her into a quiet garden while preserving the portrait subject identity.',
      }),
    );

    expect(result).toMatchObject({ ok: true });
  });

  it('does not treat words like sparkling as park scene drift', () => {
    const result = validateChainAgentResult(
      resultWithPrompt({
        selectedPrompt:
          'The color-film portrait gently animates with sparkling catchlights in her eyes, soft focus breathing, and subtle hair movement.',
        generationPrompt:
          'The color-film portrait gently animates with sparkling catchlights in her eyes, soft focus breathing, and subtle hair movement.',
      }),
      contextWithCurrentInput({}),
    );

    expect(result).toMatchObject({ ok: true });
  });
});

function contextWithCurrentInput(
  currentInput: ChainAgentPromptContext['currentInput'],
): ChainAgentPromptContext {
  return {
    currentInput,
    flow: {
      currentStepKey: 'image',
      mode: 'autopilot',
      nextStepKey: 'video',
    },
    nextStep: {
      modelIdentifier: 'google/veo-3.1-lite',
      requestParams: null,
      schema: {
        type: 'object',
        required: ['generation_prompt', 'generation_duration'],
        properties: {
          generation_prompt: { type: 'string' },
          generation_duration: { type: 'number', minimum: 1, maximum: 8 },
        },
      },
      stepKey: 'video',
      stepKind: 'video',
    },
    previousStep: {
      modelIdentifier: 'bfl/flux-1.1-pro',
      outputFiles: [],
      requestParams: {
        generation_prompt:
          'A color film-inspired portrait of a young Japanese woman looking to the camera with a shallow depth of field that blurs the surrounding elements, drawing attention to her eyes.',
      },
      stepKey: 'image',
      stepKind: 'image',
    },
  };
}

function resultWithPrompt({
  generationPrompt,
  selectedPrompt,
}: {
  generationPrompt: string;
  selectedPrompt: string;
}): Pick<
  ChainAgentResult,
  'selectedParams' | 'selectedPrompt' | 'suggestions'
> {
  return {
    selectedParams: {
      generation_duration: 4,
      generation_prompt: generationPrompt,
    },
    selectedPrompt,
    suggestions: [
      { title: 'A', prompt: selectedPrompt, params: {} },
      {
        title: 'B',
        prompt: `${selectedPrompt} Camera drifts closer.`,
        params: {},
      },
      {
        title: 'C',
        prompt: `${selectedPrompt} Background bokeh shifts.`,
        params: {},
      },
    ],
  };
}
