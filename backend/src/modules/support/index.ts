// Public surface of support. `moderation` calls listForModeration / getForModeration / replyAsStaff / setStatus.
export { supportRouter } from './support.routes';
export { supportService, SupportService } from './support.service';
export { TICKET_CATEGORY, TICKET_STATUS, type ModerationTicketDto, type TicketCategory, type TicketStatus, type TicketSummaryDto } from './support.types';
