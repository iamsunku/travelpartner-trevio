ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "operationsType" TEXT NOT NULL DEFAULT 'general_inquiry';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "deliveryType" TEXT NOT NULL DEFAULT 'remote';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT 'General Support';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SupportTicket_operationsType_idx" ON "SupportTicket"("operationsType");
CREATE INDEX IF NOT EXISTS "SupportTicket_deliveryType_idx" ON "SupportTicket"("deliveryType");
CREATE INDEX IF NOT EXISTS "SupportTicket_department_idx" ON "SupportTicket"("department");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");
