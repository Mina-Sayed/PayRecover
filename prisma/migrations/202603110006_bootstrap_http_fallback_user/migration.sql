CREATE OR REPLACE FUNCTION public.app_ensure_user_profile(
  p_user_id TEXT,
  p_email TEXT,
  p_name TEXT,
  p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  fallback_email TEXT;
BEGIN
  PERFORM public.app_assert_http_rpc_secret(p_secret);

  fallback_email := COALESCE(NULLIF(trim(p_email), ''), p_user_id || '@payrecover.local');

  IF NOT EXISTS (
    SELECT 1
    FROM "User" AS account
    WHERE account.id = p_user_id
  ) THEN
    INSERT INTO "User" (
      id,
      email,
      name,
      "businessName",
      plan,
      "notifyPaymentReceived",
      "notifyDailySummary",
      "notifyOverdueAlerts"
    )
    VALUES (
      p_user_id,
      fallback_email,
      NULLIF(trim(p_name), ''),
      NULLIF(trim(COALESCE(p_name, '')), ''),
      'free',
      true,
      true,
      true
    );
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', account.id,
      'name', account.name,
      'email', account.email,
      'businessName', account."businessName",
      'whatsappNumber', account."whatsappNumber",
      'plan', account.plan,
      'notifyPaymentReceived', account."notifyPaymentReceived",
      'notifyDailySummary', account."notifyDailySummary",
      'notifyOverdueAlerts', account."notifyOverdueAlerts"
    )
    FROM "User" AS account
    WHERE account.id = p_user_id
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_ensure_user_profile(TEXT, TEXT, TEXT, TEXT) TO anon;
