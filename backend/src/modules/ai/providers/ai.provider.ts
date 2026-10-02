export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiGenerateInput {
  system: string;
  /** Conversation so far, ending with the user's new message. */
  messages: AiMessage[];
  maxTokens: number;
}

/**
 * Abstraction over the language-model vendor. The `ai` module (and later Custom Tour) depends on this interface only,
 * never on a specific vendor SDK or HTTP shape (AI rules §13–14).
 */
export interface AiProvider {
  readonly name: string;
  /** True when the provider is configured and may be called. */
  readonly enabled: boolean;
  /** Returns plain text. Throws `AppError` 503 when the provider is unavailable. */
  generate(input: AiGenerateInput): Promise<{ text: string }>;
}
