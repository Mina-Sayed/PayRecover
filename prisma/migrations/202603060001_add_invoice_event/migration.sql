CREATE TABLE "InvoiceEvent" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceEvent_invoiceId_createdAt_idx"
  ON "InvoiceEvent"("invoiceId", "createdAt" DESC);

CREATE INDEX "InvoiceEvent_userId_createdAt_idx"
  ON "InvoiceEvent"("userId", "createdAt" DESC);

ALTER TABLE "InvoiceEvent"
  ADD CONSTRAINT "InvoiceEvent_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
