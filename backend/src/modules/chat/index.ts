// Public surface of chat.
export { chatRouter } from './chat.routes';
export { chatService, ChatService } from './chat.service';
export { attachChatGateway } from './chat.gateway';
export { canConverse } from './chat.policy';
export type { ConversationDto, MessageDto } from './chat.types';
