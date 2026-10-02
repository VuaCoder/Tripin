import { AppError } from '../../../utils/app-error';
import type { AiGenerateInput, AiProvider } from './ai.provider';

/** Default provider (`AI_PROVIDER=disabled`): every call answers 503 so nothing is sent to any vendor by accident. */
export class DisabledAiProvider implements AiProvider {
  readonly name = 'disabled';
  readonly enabled = false;

  async generate(_input: AiGenerateInput): Promise<{ text: string }> {
    throw AppError.unavailable('The AI assistant is not enabled');
  }
}
