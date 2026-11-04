import { env } from '../../../config/env';
import { AppError } from '../../../utils/app-error';
import { logger } from '../../../utils/logger';
import type { AiGenerateInput, AiProvider } from './ai.provider';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 30_000;

interface GeminiResponse {
  error?: { status?: string };
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
}

/** Gemini Developer API via fetch. The server sends document text to Google; the key is never exposed to the browser. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(private readonly config?: { apiKey: string; model: string }) {}

  get enabled(): boolean {
    return Boolean(this.config?.apiKey && this.config.model);
  }

  async generate(input: AiGenerateInput): Promise<{ text: string; incomplete?: boolean }> {
    if (!this.enabled || !this.config) throw new AppError(503, 'AI_NOT_CONFIGURED', 'The AI assistant is not configured');
    // Accept either a model ID or the models/<id> resource name from AI Studio.
    const model = this.config.model.replace(/^models\//, '');
    const started = Date.now();
    let httpStatus: number | undefined;
    let finishReason: string | undefined;
    let vendorCode: string | undefined;
    let errorCode: string | undefined;
    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.config.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: input.messages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: input.maxTokens,
            ...(input.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      httpStatus = response.status;
      const body = (response.ok ? await response.json() : await response.json().catch(() => ({}))) as GeminiResponse;
      vendorCode = typeof body.error?.status === 'string' && /^[A-Z_]{1,64}$/.test(body.error.status) ? body.error.status : undefined;
      if (!response.ok) {
        const code = response.status === 429 ? 'AI_QUOTA_EXCEEDED'
          : [400, 401, 403, 404].includes(response.status) ? 'AI_NOT_CONFIGURED' : 'AI_TEMPORARILY_UNAVAILABLE';
        throw new AppError(503, code, 'The AI provider could not process the request');
      }
      const candidate = body.candidates?.[0];
      finishReason = candidate?.finishReason;
      if (body.promptFeedback?.blockReason || ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(finishReason ?? '')) {
        throw new AppError(503, 'AI_CONTENT_BLOCKED', 'The AI provider blocked this response');
      }
      const incomplete = finishReason === 'MAX_TOKENS';
      if (candidate && finishReason !== 'STOP' && !(incomplete && input.allowPartial && input.responseFormat !== 'json')) {
        throw new AppError(503, 'AI_INCOMPLETE_RESPONSE', 'The AI assistant could not return a complete answer');
      }
      const text = (candidate?.content?.parts ?? [])
        .filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text)
        .join('')
        .trim();
      if (!text) throw new AppError(503, 'AI_EMPTY_RESPONSE', 'The AI assistant returned an empty answer');
      return { text, ...(incomplete ? { incomplete: true } : {}) };
    } catch (error) {
      if (error instanceof AppError) { errorCode = error.code; throw error; }
      const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
      errorCode = timeout ? 'AI_TIMEOUT' : 'AI_UNREACHABLE';
      throw new AppError(503, errorCode, 'The AI assistant is not reachable');
    } finally {
      logger.info('Gemini request completed', { status: httpStatus, vendorCode, finishReason: typeof finishReason === 'string' && /^[A-Z_]{1,64}$/.test(finishReason) ? finishReason : undefined, errorCode, durationMs: Date.now() - started });
    }
  }
}

export function createGeminiProviderFromEnv(): GeminiProvider {
  if (!env.AI_API_KEY || !env.AI_MODEL) return new GeminiProvider();
  return new GeminiProvider({ apiKey: env.AI_API_KEY, model: env.AI_MODEL });
}
