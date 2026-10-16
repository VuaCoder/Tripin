import { env } from '../../../config/env';
import type { AiProvider } from './ai.provider';
import { createAnthropicProviderFromEnv } from './anthropic.provider';
import { DisabledAiProvider } from './disabled.provider';
import { createGeminiProviderFromEnv } from './gemini.provider';

export type { AiGenerateInput, AiMessage, AiProvider } from './ai.provider';

/** Picks the provider from `AI_PROVIDER`. */
export function createAiProvider(): AiProvider {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropicProviderFromEnv();
    case 'gemini':
      return createGeminiProviderFromEnv();
    default:
      return new DisabledAiProvider();
  }
}
