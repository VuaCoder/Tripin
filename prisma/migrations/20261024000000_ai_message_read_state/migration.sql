ALTER TABLE "AiMessage" ADD COLUMN "readAt" TIMESTAMP(3);
-- Existing history must not become a backlog of unread notifications.
UPDATE "AiMessage" SET "readAt" = CURRENT_TIMESTAMP WHERE "role" = 'assistant';
CREATE INDEX "AiMessage_conversationId_role_readAt_idx" ON "AiMessage"("conversationId", "role", "readAt");
