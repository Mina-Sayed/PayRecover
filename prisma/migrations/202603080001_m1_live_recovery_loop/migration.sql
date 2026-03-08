CREATE TYPE "PaymentLinkStatus" AS ENUM ('active', 'expired', 'paid', 'failed');
CREATE TYPE "PaymentEventType" AS ENUM (
  'callback_received',
  'payment_succeeded',
  'payment_failed',
  'callback_rejected',
  'manual_mark_paid'
);
CREATE TYPE "ReminderRunStatus" AS ENUM (
  'scheduled',
  'sending',
  'sent',
  'delivered',
  'failed',
  'suppressed',
  'cancelled'
);
CREATE TYPE "DeliveryAttemptStatus" AS ENUM ('started', 'succeeded', 'failed');

ALTER TABLE "Invoice"
  ALTER COLUMN "amount" TYPE DECIMAL(12, 2)
  USING ROUND("amount"::numeric, 2);

ALTER TABLE "ReminderTemplate"
  ADD COLUMN "providerTemplateName" TEXT;

WITH ranked_clients AS (
  SELECT
    "id",
    "userId",
    "phone",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "phone"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_num,
    FIRST_VALUE("id") OVER (
      PARTITION BY "userId", "phone"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS canonical_id
  FROM "Client"
)
UPDATE "Invoice" AS invoice
SET "clientId" = ranked_clients.canonical_id
FROM ranked_clients
WHERE invoice."clientId" = ranked_clients."id"
  AND ranked_clients.row_num > 1;

WITH ranked_clients AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "phone"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_num
  FROM "Client"
)
DELETE FROM "Client" AS client
USING ranked_clients
WHERE client."id" = ranked_clients."id"
  AND ranked_clients.row_num > 1;

CREATE UNIQUE INDEX "Client_userId_phone_key" ON "Client"("userId", "phone");

CREATE TABLE "PaymentLink" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerRef" TEXT,
  "url" TEXT NOT NULL,
  "status" "PaymentLinkStatus" NOT NULL DEFAULT 'active',
  "expiresAt" TIMESTAMP(3),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "type" "PaymentEventType" NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderRun" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "templateId" TEXT,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "timingLabel" TEXT NOT NULL,
  "templateSnapshot" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "ReminderRunStatus" NOT NULL DEFAULT 'scheduled',
  "providerMessageId" TEXT,
  "deliveryConfirmedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "suppressionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReminderRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryAttempt" (
  "id" TEXT NOT NULL,
  "reminderRunId" TEXT NOT NULL,
  "attemptNo" INTEGER NOT NULL,
  "status" "DeliveryAttemptStatus" NOT NULL,
  "providerResponse" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentLink_invoiceId_provider_idx" ON "PaymentLink"("invoiceId", "provider");
CREATE INDEX "PaymentLink_userId_status_idx" ON "PaymentLink"("userId", "status");
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");
CREATE INDEX "PaymentEvent_invoiceId_createdAt_idx" ON "PaymentEvent"("invoiceId", "createdAt" DESC);
CREATE INDEX "PaymentEvent_userId_createdAt_idx" ON "PaymentEvent"("userId", "createdAt" DESC);
CREATE INDEX "ReminderRun_invoiceId_scheduledFor_idx" ON "ReminderRun"("invoiceId", "scheduledFor");
CREATE INDEX "ReminderRun_userId_status_scheduledFor_idx" ON "ReminderRun"("userId", "status", "scheduledFor");
CREATE UNIQUE INDEX "DeliveryAttempt_reminderRunId_attemptNo_key" ON "DeliveryAttempt"("reminderRunId", "attemptNo");
CREATE INDEX "DeliveryAttempt_reminderRunId_createdAt_idx" ON "DeliveryAttempt"("reminderRunId", "createdAt" DESC);

ALTER TABLE "PaymentLink"
  ADD CONSTRAINT "PaymentLink_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentLink"
  ADD CONSTRAINT "PaymentLink_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderRun"
  ADD CONSTRAINT "ReminderRun_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderRun"
  ADD CONSTRAINT "ReminderRun_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ReminderTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReminderRun"
  ADD CONSTRAINT "ReminderRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAttempt"
  ADD CONSTRAINT "DeliveryAttempt_reminderRunId_fkey"
  FOREIGN KEY ("reminderRunId") REFERENCES "ReminderRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
