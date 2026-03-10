ALTER TABLE "User"
  ADD COLUMN "notifyPaymentReceived" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyDailySummary" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyOverdueAlerts" BOOLEAN NOT NULL DEFAULT true;
