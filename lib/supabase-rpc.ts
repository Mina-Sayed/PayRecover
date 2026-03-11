import { getEnv, requireEnv } from '@/lib/env';

const DB_HOST_PATTERN = /^db\.([^.]+)\.supabase\.co$/i;

function deriveSupabaseUrlFromDatabaseUrl(): string {
  const databaseUrl = new URL(requireEnv('DATABASE_URL'));
  const match = DB_HOST_PATTERN.exec(databaseUrl.hostname);

  if (!match) {
    throw new Error('Unable to derive SUPABASE_URL from DATABASE_URL');
  }

  return `https://${match[1]}.supabase.co`;
}

export function getSupabaseUrl(): string {
  return getEnv('SUPABASE_URL') || deriveSupabaseUrlFromDatabaseUrl();
}

export function getSupabaseAnonKey(): string {
  return requireEnv('SUPABASE_ANON_KEY');
}

export async function callSupabaseRpc<T>(
  functionName: string,
  payload: Record<string, unknown>
): Promise<T> {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  const body = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `Supabase RPC ${functionName} failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export interface FallbackSessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

export async function ensureFallbackUserProfile(
  user: FallbackSessionUser,
  secret: string
): Promise<{
  id: string;
  email: string;
  name: string | null;
  businessName: string | null;
  whatsappNumber: string | null;
  plan: string;
  notifyPaymentReceived: boolean;
  notifyDailySummary: boolean;
  notifyOverdueAlerts: boolean;
}> {
  return callSupabaseRpc('app_ensure_user_profile', {
    p_user_id: user.id,
    p_email: typeof user.email === 'string' ? user.email : null,
    p_name: typeof user.name === 'string' ? user.name : null,
    p_secret: secret,
  });
}
