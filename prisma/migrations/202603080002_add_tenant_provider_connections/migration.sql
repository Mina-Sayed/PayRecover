CREATE TYPE "ProviderConnectionStatus" AS ENUM ('draft', 'configured', 'verified', 'errored', 'disabled');
CREATE TYPE "ProviderConnectionMode" AS ENUM ('sandbox', 'live');
CREATE TYPE "MessagingProviderKind" AS ENUM ('wati');
CREATE TYPE "PaymentProviderKind" AS ENUM ('paymob');

CREATE TABLE "MessagingProviderConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "MessagingProviderKind" NOT NULL,
  "mode" "ProviderConnectionMode" NOT NULL DEFAULT 'sandbox',
  "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'draft',
  "accountLabel" TEXT,
  "senderIdentifier" TEXT,
  "encryptedConfig" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastHealthcheckAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessagingProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProviderConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "PaymentProviderKind" NOT NULL,
  "mode" "ProviderConnectionMode" NOT NULL DEFAULT 'sandbox',
  "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'draft',
  "accountLabel" TEXT,
  "encryptedConfig" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastHealthcheckAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentProviderConnection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentLink"
  ADD COLUMN "providerConnectionId" TEXT,
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PaymentEvent"
  ADD COLUMN "providerConnectionId" TEXT;

ALTER TABLE "ReminderRun"
  ADD COLUMN "messagingConnectionId" TEXT;

CREATE UNIQUE INDEX "MessagingProviderConnection_userId_provider_key"
  ON "MessagingProviderConnection"("userId", "provider");
CREATE INDEX "MessagingProviderConnection_userId_status_idx"
  ON "MessagingProviderConnection"("userId", "status");
CREATE UNIQUE INDEX "PaymentProviderConnection_userId_provider_key"
  ON "PaymentProviderConnection"("userId", "provider");
CREATE INDEX "PaymentProviderConnection_userId_status_idx"
  ON "PaymentProviderConnection"("userId", "status");
CREATE INDEX "PaymentLink_providerConnectionId_status_idx"
  ON "PaymentLink"("providerConnectionId", "status");

ALTER TABLE "MessagingProviderConnection"
  ADD CONSTRAINT "MessagingProviderConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentProviderConnection"
  ADD CONSTRAINT "PaymentProviderConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentLink"
  ADD CONSTRAINT "PaymentLink_providerConnectionId_fkey"
  FOREIGN KEY ("providerConnectionId") REFERENCES "PaymentProviderConnection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_providerConnectionId_fkey"
  FOREIGN KEY ("providerConnectionId") REFERENCES "PaymentProviderConnection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReminderRun"
  ADD CONSTRAINT "ReminderRun_messagingConnectionId_fkey"
  FOREIGN KEY ("messagingConnectionId") REFERENCES "MessagingProviderConnection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
