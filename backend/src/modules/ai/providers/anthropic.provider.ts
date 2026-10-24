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

  async generate(input: AiGenerateInput): Promise<{ text: string; incomplete?: boolean }> {
    if (!this.config) throw new AppError(503, 'AI_NOT_CONFIGURED', 'The AI assistant is not configured');
    const started = Date.now();
    let httpStatus: number | undefined;
    let vendorCode: string | undefined;
    let finishReason: string | undefined;
    let errorCode: string | undefined;
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': API_VERSION },
        body: JSON.stringify({ model: this.config.model, max_tokens: input.maxTokens, system: input.system, messages: input.messages }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      httpStatus = response.status;
      const body = (response.ok ? await response.json() : await response.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; stop_reason?: string; error?: { type?: string } };
      vendorCode = typeof body.error?.type === 'string' && /^[a-z_]{1,64}$/.test(body.error.type) ? body.error.type : undefined;
      finishReason = body.stop_reason;
      if (!response.ok) {
        const code = response.status === 429 ? 'AI_QUOTA_EXCEEDED'
          : [400, 401, 403, 404].includes(response.status) ? 'AI_NOT_CONFIGURED' : 'AI_TEMPORARILY_UNAVAILABLE';
        throw new AppError(503, code, 'The AI provider could not process the request');
      }
      const incomplete = finishReason === 'max_tokens';
      if (incomplete && (!input.allowPartial || input.responseFormat === 'json')) {
        throw new AppError(503, 'AI_INCOMPLETE_RESPONSE', 'The AI assistant could not return a complete answer');
      }
      if (finishReason === 'refusal') throw new AppError(503, 'AI_CONTENT_BLOCKED', 'The AI provider blocked this response');
      const text = (body.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('')
        .trim();
      if (!text) throw new AppError(503, 'AI_EMPTY_RESPONSE', 'The AI assistant returned an empty answer');
      return { text, ...(incomplete ? { incomplete: true } : {}) };
    } catch (error) {
      if (error instanceof AppError) { errorCode = error.code; throw error; }
      errorCode = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'AI_TIMEOUT' : 'AI_UNREACHABLE';
      throw new AppError(503, errorCode, 'The AI assistant is not reachable');
    } finally {
      logger.info('Anthropic request completed', { status: httpStatus, vendorCode, finishReason: typeof finishReason === 'string' && /^[a-z_]{1,64}$/.test(finishReason) ? finishReason : undefined, errorCode, durationMs: Date.now() - started });
    }
  }
}

export function createAnthropicProviderFromEnv(): AnthropicProvider {
  if (!env.AI_API_KEY || !env.AI_MODEL) return new AnthropicProvider(undefined);
  return new AnthropicProvider({ apiKey: env.AI_API_KEY, model: env.AI_MODEL });
}
