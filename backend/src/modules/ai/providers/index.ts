import { env } from '../../../config/env';
import type { AiProvider } from './ai.provider';
import { createAnthropicProviderFromEnv } from './anthropic.provider';
import { DisabledAiProvider } from './disabled.provider';

export type { AiGenerateInput, AiMessage, AiProvider } from './ai.provider';

/** Picks the provider from `AI_PROVIDER` (`disabled` | `anthropic`). Add a vendor = one file + one case here. */
export function createAiProvider(): AiProvider {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropicProviderFromEnv();
    default:
      return new DisabledAiProvider();
  }
}
