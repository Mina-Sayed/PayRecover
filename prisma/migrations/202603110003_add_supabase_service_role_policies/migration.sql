CREATE POLICY "Service role full access on User"
  ON "User"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on Account"
  ON "Account"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on Session"
  ON "Session"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on VerificationToken"
  ON "VerificationToken"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on Client"
  ON "Client"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on Invoice"
  ON "Invoice"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on InvoiceEvent"
  ON "InvoiceEvent"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ReminderTemplate"
  ON "ReminderTemplate"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on MessagingProviderConnection"
  ON "MessagingProviderConnection"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on PaymentProviderConnection"
  ON "PaymentProviderConnection"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on PaymentLink"
  ON "PaymentLink"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on PaymentEvent"
  ON "PaymentEvent"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on ReminderRun"
  ON "ReminderRun"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on DeliveryAttempt"
  ON "DeliveryAttempt"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
