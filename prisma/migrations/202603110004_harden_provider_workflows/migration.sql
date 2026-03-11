DROP INDEX "PaymentEvent_provider_providerEventId_key";

CREATE UNIQUE INDEX "PaymentEvent_provider_providerConnectionId_providerEventId_key"
ON "PaymentEvent"("provider", "providerConnectionId", "providerEventId");

CREATE UNIQUE INDEX "ReminderRun_providerMessageId_key"
ON "ReminderRun"("providerMessageId");

CREATE INDEX "ReminderRun_status_channel_scheduledFor_idx"
ON "ReminderRun"("status", "channel", "scheduledFor");

CREATE UNIQUE INDEX "ReminderRun_invoiceId_channel_timingLabel_scheduledFor_key"
ON "ReminderRun"("invoiceId", "channel", "timingLabel", "scheduledFor");
