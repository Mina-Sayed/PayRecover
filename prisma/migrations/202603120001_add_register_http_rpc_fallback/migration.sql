CREATE OR REPLACE FUNCTION public.app_register_user(
  p_name TEXT,
  p_email TEXT,
  p_hashed_password TEXT,
  p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  created_user_id TEXT := 'usr_' || md5(random()::text || clock_timestamp()::text || COALESCE(p_email, ''));
  reminder_one_id TEXT := 'rt_' || md5(random()::text || clock_timestamp()::text || COALESCE(p_email, '') || '1');
  reminder_two_id TEXT := 'rt_' || md5(random()::text || clock_timestamp()::text || COALESCE(p_email, '') || '2');
  normalized_name TEXT := NULLIF(trim(p_name), '');
  normalized_email TEXT := lower(NULLIF(trim(p_email), ''));
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  IF normalized_name IS NULL OR normalized_email IS NULL OR NULLIF(trim(p_hashed_password), '') IS NULL THEN
    RAISE EXCEPTION 'invalid registration payload';
  END IF;

  INSERT INTO "User" (
    id,
    email,
    name,
    "hashedPassword",
    "businessName",
    plan,
    "notifyPaymentReceived",
    "notifyDailySummary",
    "notifyOverdueAlerts",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    created_user_id,
    normalized_email,
    normalized_name,
    p_hashed_password,
    normalized_name,
    'free',
    true,
    true,
    true,
    now(),
    now()
  );

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
  VALUES
    (
      reminder_one_id,
      created_user_id,
      'whatsapp',
      '3 Days Before Due',
      'Hi {{client_name}}, this is a gentle reminder that your invoice for {{amount}} is due on {{due_date}}. You can pay securely here: {{payment_link}}',
      NULL,
      true,
      0
    ),
    (
      reminder_two_id,
      created_user_id,
      'whatsapp',
      'On Due Date',
      'Hi {{client_name}}, your invoice for {{amount}} is due today. Please complete your payment here: {{payment_link}}',
      NULL,
      true,
      1
    );

  RETURN jsonb_build_object('userId', created_user_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'email already in use';
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_register_user(TEXT, TEXT, TEXT, TEXT) TO anon;

CREATE OR REPLACE FUNCTION public.app_get_auth_user(
  p_email TEXT,
  p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  normalized_email TEXT := lower(NULLIF(trim(p_email), ''));
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  IF normalized_email IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', account.id,
      'email', account.email,
      'name', account.name,
      'image', account.image,
      'hashedPassword', account."hashedPassword"
    )
    FROM "User" AS account
    WHERE lower(account.email) = normalized_email
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_get_auth_user(TEXT, TEXT) TO anon;
