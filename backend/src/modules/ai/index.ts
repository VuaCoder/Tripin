// Public surface of the AI module. Custom Tour (future) reuses `AiProvider`, never a vendor directly.
export { aiRouter } from './ai.routes';
export { aiService, AiService } from './ai.service';
export { createAiProvider } from './providers';
export type { AiProvider, AiGenerateInput, AiMessage } from './providers';
