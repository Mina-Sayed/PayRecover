CREATE SCHEMA IF NOT EXISTS app_private;

CREATE TABLE IF NOT EXISTS app_private.runtime_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION public.app_assert_http_rpc_secret(p_secret TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  expected_secret TEXT;
BEGIN
  SELECT value
  INTO expected_secret
  FROM app_private.runtime_config
  WHERE key = 'http_rpc_secret';

  IF expected_secret IS NULL OR p_secret IS DISTINCT FROM expected_secret THEN
    RAISE EXCEPTION 'invalid app secret';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.app_assert_http_rpc_secret(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.app_get_reminders(p_user_id TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', reminder.id,
          'channel', reminder.channel,
          'timing', reminder.timing,
          'template', reminder.template,
          'providerTemplateName', reminder."providerTemplateName",
          'active', reminder.active,
          'order', reminder."order"
        )
        ORDER BY reminder.channel ASC, reminder."order" ASC
      )
      FROM "ReminderTemplate" AS reminder
      WHERE reminder."userId" = p_user_id
        AND reminder.channel = 'whatsapp'
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_create_reminder(
  p_user_id TEXT,
  p_timing TEXT,
  p_template TEXT,
  p_provider_template_name TEXT,
  p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  next_order INTEGER;
  reminder_id TEXT;
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  SELECT COALESCE(MAX(reminder."order"), -1) + 1
  INTO next_order
  FROM "ReminderTemplate" AS reminder
  WHERE reminder."userId" = p_user_id
    AND reminder.channel = 'whatsapp';

  reminder_id := 'rt_' || md5(random()::text || clock_timestamp()::text || p_user_id);

  INSERT INTO "ReminderTemplate" (
    id,
    "userId",
    channel,
    timing,
    template,
    "providerTemplateName",
    active,
    "order"
  )
  VALUES (
    reminder_id,
    p_user_id,
    'whatsapp',
    p_timing,
    p_template,
    NULLIF(p_provider_template_name, ''),
    true,
    next_order
  );

  RETURN (
    SELECT jsonb_build_object(
      'id', reminder.id,
      'channel', reminder.channel,
      'timing', reminder.timing,
      'template', reminder.template,
      'providerTemplateName', reminder."providerTemplateName",
      'active', reminder.active,
      'order', reminder."order"
    )
    FROM "ReminderTemplate" AS reminder
    WHERE reminder.id = reminder_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_get_settings(p_user_id TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  RETURN (
    SELECT jsonb_build_object(
      'user', jsonb_build_object(
        'name', account.name,
        'email', account.email,
        'businessName', account."businessName",
        'whatsappNumber', account."whatsappNumber",
        'plan', account.plan,
        'notifyPaymentReceived', account."notifyPaymentReceived",
        'notifyDailySummary', account."notifyDailySummary",
        'notifyOverdueAlerts', account."notifyOverdueAlerts"
      ),
      'messagingConnectionRecord',
      COALESCE(
        (
          SELECT jsonb_build_object(
            'id', connection.id,
            'provider', connection.provider,
            'mode', connection.mode,
            'status', connection.status,
            'accountLabel', connection."accountLabel",
            'senderIdentifier', connection."senderIdentifier",
            'encryptedConfig', connection."encryptedConfig",
            'verifiedAt', connection."verifiedAt",
            'lastHealthcheckAt', connection."lastHealthcheckAt",
            'lastError', connection."lastError"
          )
          FROM "MessagingProviderConnection" AS connection
          WHERE connection."userId" = account.id
          LIMIT 1
        ),
        'null'::jsonb
      ),
      'paymentConnectionRecord',
      COALESCE(
        (
          SELECT jsonb_build_object(
            'id', connection.id,
            'provider', connection.provider,
            'mode', connection.mode,
            'status', connection.status,
            'accountLabel', connection."accountLabel",
            'encryptedConfig', connection."encryptedConfig",
            'verifiedAt', connection."verifiedAt",
            'lastHealthcheckAt', connection."lastHealthcheckAt",
            'lastError', connection."lastError"
          )
          FROM "PaymentProviderConnection" AS connection
          WHERE connection."userId" = account.id
          LIMIT 1
        ),
        'null'::jsonb
      )
    )
    FROM "User" AS account
    WHERE account.id = p_user_id
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_get_dashboard_stats(p_user_id TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  month_start TIMESTAMP := date_trunc('month', now());
  seven_days_ago TIMESTAMP := now() - interval '7 days';
  cutoff TIMESTAMP := date_trunc('day', now());
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  UPDATE "Invoice"
  SET status = 'overdue'
  WHERE "userId" = p_user_id
    AND status = 'pending'
    AND "dueDate" < cutoff;

  UPDATE "Invoice"
  SET status = 'pending'
  WHERE "userId" = p_user_id
    AND status = 'overdue'
    AND "dueDate" >= cutoff;

  RETURN jsonb_build_object(
    'totalOutstanding',
    COALESCE(
      (
        SELECT SUM(invoice.amount)::float8
        FROM "Invoice" AS invoice
        WHERE invoice."userId" = p_user_id
          AND invoice.status IN ('overdue', 'pending')
      ),
      0
    ),
    'overdueCount',
    (
      SELECT COUNT(*)
      FROM "Invoice" AS invoice
      WHERE invoice."userId" = p_user_id
        AND invoice.status IN ('overdue', 'pending')
    ),
    'recoveredThisMonth',
    COALESCE(
      (
        SELECT SUM(invoice.amount)::float8
        FROM "Invoice" AS invoice
        WHERE invoice."userId" = p_user_id
          AND invoice.status = 'paid'
          AND invoice."paidAt" >= month_start
      ),
      0
    ),
    'dueReminderRuns',
    (
      SELECT COUNT(*)
      FROM "ReminderRun" AS run
      JOIN "Invoice" AS invoice ON invoice.id = run."invoiceId"
      WHERE run."userId" = p_user_id
        AND run.status = 'scheduled'
        AND run."scheduledFor" <= now()
        AND invoice.status <> 'paid'
    ),
    'totalInvoices',
    (
      SELECT COUNT(*)
      FROM "Invoice" AS invoice
      WHERE invoice."userId" = p_user_id
    ),
    'remindersSentLast7Days',
    (
      SELECT COUNT(*)
      FROM "ReminderRun" AS run
      WHERE run."userId" = p_user_id
        AND run."sentAt" >= seven_days_ago
    ),
    'remindersDeliveredLast7Days',
    (
      SELECT COUNT(*)
      FROM "ReminderRun" AS run
      WHERE run."userId" = p_user_id
        AND run.status = 'delivered'
        AND run."deliveryConfirmedAt" >= seven_days_ago
    ),
    'remindersFailedLast7Days',
    (
      SELECT COUNT(*)
      FROM "ReminderRun" AS run
      WHERE run."userId" = p_user_id
        AND run.status = 'failed'
        AND run."updatedAt" >= seven_days_ago
    ),
    'confirmedPaymentsThisMonth',
    (
      SELECT COUNT(*)
      FROM "PaymentEvent" AS event
      WHERE event."userId" = p_user_id
        AND event.type IN ('payment_succeeded', 'manual_mark_paid')
        AND event."createdAt" >= month_start
    ),
    'recentInvoices',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', invoice.id,
            'invoiceNo', invoice."invoiceNo",
            'amount', invoice.amount::float8,
            'dueDate', to_jsonb(invoice."dueDate"),
            'status', invoice.status,
            'client', jsonb_build_object(
              'id', client.id,
              'name', client.name,
              'phone', client.phone
            )
          )
          ORDER BY invoice."dueDate" ASC
        )
        FROM (
          SELECT *
          FROM "Invoice"
          WHERE "userId" = p_user_id
            AND status IN ('overdue', 'pending')
          ORDER BY "dueDate" ASC
          LIMIT 5
        ) AS invoice
        JOIN "Client" AS client ON client.id = invoice."clientId"
      ),
      '[]'::jsonb
    ),
    'recentActivity',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', event.id,
            'type', event.type,
            'message', event.message,
            'createdAt', to_jsonb(event."createdAt"),
            'invoice',
            CASE
              WHEN invoice.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', invoice.id,
                'invoiceNo', invoice."invoiceNo"
              )
            END
          )
          ORDER BY event."createdAt" DESC
        )
        FROM (
          SELECT *
          FROM "InvoiceEvent"
          WHERE "userId" = p_user_id
          ORDER BY "createdAt" DESC
          LIMIT 6
        ) AS event
        LEFT JOIN "Invoice" AS invoice ON invoice.id = event."invoiceId"
      ),
      '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_list_invoices(
  p_user_id TEXT,
  p_status TEXT,
  p_search TEXT,
  p_page INTEGER,
  p_limit INTEGER,
  p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  cutoff TIMESTAMP := date_trunc('day', now());
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  requested_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  total_count INTEGER;
  total_pages INTEGER;
  effective_page INTEGER;
  offset_value INTEGER;
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  UPDATE "Invoice"
  SET status = 'overdue'
  WHERE "userId" = p_user_id
    AND status = 'pending'
    AND "dueDate" < cutoff;

  UPDATE "Invoice"
  SET status = 'pending'
  WHERE "userId" = p_user_id
    AND status = 'overdue'
    AND "dueDate" >= cutoff;

  SELECT COUNT(*)
  INTO total_count
  FROM "Invoice" AS invoice
  JOIN "Client" AS client ON client.id = invoice."clientId"
  WHERE invoice."userId" = p_user_id
    AND (p_status = 'all' OR invoice.status = p_status)
    AND (
      COALESCE(p_search, '') = ''
      OR client.name ILIKE '%' || p_search || '%'
      OR invoice."invoiceNo" ILIKE '%' || p_search || '%'
      OR COALESCE(client.email, '') ILIKE '%' || p_search || '%'
    );

  total_pages := GREATEST(1, CEIL(GREATEST(total_count, 1)::numeric / safe_limit)::int);
  effective_page := LEAST(requested_page, total_pages);
  offset_value := (effective_page - 1) * safe_limit;

  RETURN jsonb_build_object(
    'invoices',
    COALESCE(
      (
        SELECT jsonb_agg(serialized_invoice ORDER BY created_at DESC)
        FROM (
          SELECT
            invoice."createdAt" AS created_at,
            jsonb_build_object(
              'id', invoice.id,
              'invoiceNo', invoice."invoiceNo",
              'amount', invoice.amount::float8,
              'dueDate', to_jsonb(invoice."dueDate"),
              'status', invoice.status,
              'notes', invoice.notes,
              'paidAt', to_jsonb(invoice."paidAt"),
              'currency', invoice.currency,
              'createdAt', to_jsonb(invoice."createdAt"),
              'updatedAt', to_jsonb(invoice."updatedAt"),
              'client', jsonb_build_object(
                'id', client.id,
                'name', client.name,
                'phone', client.phone,
                'email', client.email,
                'address', client.address
              ),
              'events',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', event.id,
                      'type', event.type,
                      'message', event.message,
                      'createdAt', to_jsonb(event."createdAt")
                    )
                    ORDER BY event."createdAt" DESC
                  )
                  FROM (
                    SELECT *
                    FROM "InvoiceEvent"
                    WHERE "invoiceId" = invoice.id
                    ORDER BY "createdAt" DESC
                    LIMIT 5
                  ) AS event
                ),
                '[]'::jsonb
              ),
              'paymentLink',
              (
                SELECT
                  CASE
                    WHEN payment_link.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                      'provider', payment_link.provider,
                      'status', payment_link.status::text,
                      'url', payment_link.url,
                      'expiresAt', to_jsonb(payment_link."expiresAt")
                    )
                  END
                FROM (
                  SELECT *
                  FROM "PaymentLink"
                  WHERE "invoiceId" = invoice.id
                    AND provider = 'paymob'
                    AND "isPrimary" = true
                    AND status IN ('active', 'paid')
                  ORDER BY
                    CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC,
                    "createdAt" DESC
                  LIMIT 1
                ) AS payment_link
              )
            ) AS serialized_invoice
          FROM "Invoice" AS invoice
          JOIN "Client" AS client ON client.id = invoice."clientId"
          WHERE invoice."userId" = p_user_id
            AND (p_status = 'all' OR invoice.status = p_status)
            AND (
              COALESCE(p_search, '') = ''
              OR client.name ILIKE '%' || p_search || '%'
              OR invoice."invoiceNo" ILIKE '%' || p_search || '%'
              OR COALESCE(client.email, '') ILIKE '%' || p_search || '%'
            )
          ORDER BY invoice."createdAt" DESC
          OFFSET offset_value
          LIMIT safe_limit
        ) AS paged_invoices
      ),
      '[]'::jsonb
    ),
    'total', total_count,
    'page', effective_page,
    'totalPages', total_pages
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_get_reminders(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.app_create_reminder(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.app_get_settings(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.app_get_dashboard_stats(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.app_list_invoices(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) TO anon;
