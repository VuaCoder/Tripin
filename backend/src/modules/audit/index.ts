// Public surface of the audit module. Other modules call `auditService.record(...)` with an AUDIT_ACTIONS value.
export { auditRouter } from './audit.routes';
export { auditService, AuditService } from './audit.service';
export { AUDIT_ACTIONS, type AuditAction, type AuditEntry } from './audit.types';
