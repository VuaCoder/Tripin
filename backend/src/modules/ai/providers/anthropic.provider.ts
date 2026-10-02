import { env } from '../../../config/env';
import { AppError } from '../../../utils/app-error';
import { logger } from '../../../utils/logger';
import type { AiGenerateInput, AiProvider } from './ai.provider';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Anthropic Messages API over plain `fetch` (no SDK dependency, DECISIONS D-20). The API key stays server-side; only
 * the conversation text assembled by `AiService` is sent.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(private readonly config?: { apiKey: string; model: string }) {}

  get enabled(): boolean {
    return Boolean(this.config);
  }

  async generate(input: AiGenerateInput): Promise<{ text: string }> {
    if (!this.config) throw AppError.unavailable('The AI assistant is not configured');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': API_VERSION },
        body: JSON.stringify({ model: this.config.model, max_tokens: input.maxTokens, system: input.system, messages: input.messages }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = (await response.json()) as { content?: { type: string; text?: string }[]; error?: { type?: string; message?: string } };
      if (!response.ok) {
        logger.error('Anthropic request failed', { status: response.status, type: body.error?.type });
        throw AppError.unavailable('The AI assistant is temporarily unavailable');
      }
      const text = (body.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('')
        .trim();
      if (!text) throw AppError.unavailable('The AI assistant returned an empty answer');
      return { text };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Anthropic request error', { message: (error as Error).message });
      throw AppError.unavailable('The AI assistant is not reachable');
    }
  }
}

export function createAnthropicProviderFromEnv(): AnthropicProvider {
  if (!env.AI_API_KEY || !env.AI_MODEL) return new AnthropicProvider(undefined);
  return new AnthropicProvider({ apiKey: env.AI_API_KEY, model: env.AI_MODEL });
}
