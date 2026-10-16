import { env } from '../../../config/env';
import { AppError } from '../../../utils/app-error';
import { logger } from '../../../utils/logger';
import type { AiGenerateInput, AiProvider } from './ai.provider';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 30_000;

interface GeminiResponse {
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

  async generate(input: AiGenerateInput): Promise<{ text: string }> {
    if (!this.enabled || !this.config) throw AppError.unavailable('The AI assistant is not configured');
    // Accept either a model ID or the models/<id> resource name from AI Studio.
    const model = this.config.model.replace(/^models\//, '');
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
      if (!response.ok) {
        logger.error('Gemini request failed', { status: response.status });
        throw AppError.unavailable('The AI assistant is temporarily unavailable');
      }
      const body = (await response.json()) as GeminiResponse;
      const candidate = body.candidates?.[0];
      // Do not accept truncated, blocked or otherwise incomplete output as successful extraction.
      if (!candidate || candidate.finishReason !== 'STOP') {
        throw AppError.unavailable('The AI assistant could not return a complete answer; try again or use a smaller document');
      }
      const text = (candidate.content?.parts ?? [])
        .filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text)
        .join('')
        .trim();
      if (!text) throw AppError.unavailable('The AI assistant returned an empty answer');
      return { text };
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Never log vendor responses, source text, credentials or raw fetch errors.
      logger.error('Gemini request error');
      throw AppError.unavailable('The AI assistant is not reachable');
    }
  }
}

export function createGeminiProviderFromEnv(): GeminiProvider {
  if (!env.AI_API_KEY || !env.AI_MODEL) return new GeminiProvider();
  return new GeminiProvider({ apiKey: env.AI_API_KEY, model: env.AI_MODEL });
}
