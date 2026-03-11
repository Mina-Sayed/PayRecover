import crypto from 'node:crypto';
import net from 'node:net';
import {
  MessagingProviderKind,
  PaymentProviderKind,
  ProviderConnectionMode,
  ProviderConnectionStatus,
  type PrismaClient,
} from '@prisma/client';
import { getEnv, requireEnv } from '@/lib/env';

export interface WatiConnectionConfig {
  apiBaseUrl: string;
  accessToken: string;
  webhookSecret: string;
}

export interface PaymobConnectionConfig {
  publicKey: string;
  secretKey: string;
  integrationId: string;
  hmacSecret: string;
  apiBaseUrl?: string | null;
}

export interface MessagingConnectionSummary {
  id: string | null;
  provider: MessagingProviderKind;
  mode: ProviderConnectionMode;
  status: ProviderConnectionStatus | 'not_connected';
  accountLabel: string | null;
  senderIdentifier: string | null;
  verifiedAt: string | null;
  lastHealthcheckAt: string | null;
  lastError: string | null;
  hasConfig: boolean;
  configPreview: {
    apiBaseUrl: string | null;
  } | null;
}

export interface PaymentConnectionSummary {
  id: string | null;
  provider: PaymentProviderKind;
  mode: ProviderConnectionMode;
  status: ProviderConnectionStatus | 'not_connected';
  accountLabel: string | null;
  verifiedAt: string | null;
  lastHealthcheckAt: string | null;
  lastError: string | null;
  hasConfig: boolean;
  configPreview: {
    publicKeyMasked: string | null;
    integrationId: string | null;
    apiBaseUrl: string | null;
  } | null;
}

type PrismaLike = PrismaClient;

type ProviderBaseUrlKind = 'wati' | 'paymob';

const DEFAULT_ALLOWED_PROVIDER_HOSTS: Record<ProviderBaseUrlKind, string[]> = {
  wati: ['wati.example.com', 'wati.io', 'wati.chat'],
  paymob: ['accept.paymob.com'],
};

interface MessagingConnectionRecord {
  id: string;
  provider: MessagingProviderKind;
  mode: ProviderConnectionMode;
  status: ProviderConnectionStatus;
  accountLabel: string | null;
  senderIdentifier: string | null;
  encryptedConfig: string;
  verifiedAt: Date | null;
  lastHealthcheckAt: Date | null;
  lastError: string | null;
}

interface PaymentConnectionRecord {
  id: string;
  provider: PaymentProviderKind;
  mode: ProviderConnectionMode;
  status: ProviderConnectionStatus;
  accountLabel: string | null;
  encryptedConfig: string;
  verifiedAt: Date | null;
  lastHealthcheckAt: Date | null;
  lastError: string | null;
}

function deriveKey(): Buffer {
  return crypto
    .createHash('sha256')
    .update(requireEnv('PROVIDER_CONFIG_SECRET'))
    .digest();
}

function getAllowedProviderHosts(kind: ProviderBaseUrlKind): string[] {
  const envName = kind === 'wati' ? 'WATI_ALLOWED_HOSTS' : 'PAYMOB_ALLOWED_HOSTS';
  const configured = getEnv(envName);

  if (!configured) {
    return DEFAULT_ALLOWED_PROVIDER_HOSTS[kind];
  }

  const hosts = configured
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return hosts.length > 0 ? hosts : DEFAULT_ALLOWED_PROVIDER_HOSTS[kind];
}

function isAllowedProviderHostname(hostname: string, kind: ProviderBaseUrlKind): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return getAllowedProviderHosts(kind).some(
    (candidate) => normalized === candidate || normalized.endsWith(`.${candidate}`)
  );
}

function normalizeProviderBaseUrl(
  rawValue: string,
  kind: ProviderBaseUrlKind
): { value: string | null; error: string | null } {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { value: null, error: `${kind === 'wati' ? 'WATI' : 'Paymob'} base URL is required` };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { value: null, error: 'Provider base URL must be a valid absolute URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { value: null, error: 'Provider base URL must use HTTPS' };
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return {
      value: null,
      error: 'Provider base URL must not include credentials, query parameters, or fragments',
    };
  }

  if (net.isIP(parsed.hostname) !== 0) {
    return { value: null, error: 'Provider base URL must use an allowlisted hostname' };
  }

  if (!isAllowedProviderHostname(parsed.hostname, kind)) {
    return {
      value: null,
      error: `${kind === 'wati' ? 'WATI' : 'Paymob'} base URL host is not allowlisted`,
    };
  }

  return { value: parsed.origin, error: null };
}

export function normalizeWatiBaseUrl(rawValue: string): string {
  const normalized = normalizeProviderBaseUrl(rawValue, 'wati');
  if (normalized.error || !normalized.value) {
    throw new Error(normalized.error || 'Invalid WATI base URL');
  }

  return normalized.value;
}

export function normalizePaymobBaseUrl(rawValue: string): string {
  const normalized = normalizeProviderBaseUrl(rawValue, 'paymob');
  if (normalized.error || !normalized.value) {
    throw new Error(normalized.error || 'Invalid Paymob base URL');
  }

  return normalized.value;
}

export function encryptProviderConfig(config: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const plaintext = JSON.stringify(config);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptProviderConfig<T>(payload: string): T {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = payload.split('.');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted provider config payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(),
    Buffer.from(ivEncoded, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(decrypted) as T;
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function maskValue(value: string): string {
  if (value.length <= 6) {
    return '***';
  }

  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function validateWatiConnectionInput(config: Partial<WatiConnectionConfig>): string | null {
  if (!config.apiBaseUrl || !config.apiBaseUrl.trim()) {
    return 'WATI base URL is required';
  }

  const normalizedBaseUrl = normalizeProviderBaseUrl(config.apiBaseUrl, 'wati');
  if (normalizedBaseUrl.error) {
    return normalizedBaseUrl.error;
  }

  if (!config.accessToken || !config.accessToken.trim()) {
    return 'WATI access token is required';
  }

  if (!config.webhookSecret || !config.webhookSecret.trim()) {
    return 'WATI webhook secret is required';
  }

  return null;
}

export function validatePaymobConnectionInput(config: Partial<PaymobConnectionConfig>): string | null {
  if (!config.publicKey || !config.publicKey.trim()) {
    return 'Paymob public key is required';
  }

  if (!config.secretKey || !config.secretKey.trim()) {
    return 'Paymob secret key is required';
  }

  if (!config.integrationId || !config.integrationId.trim()) {
    return 'Paymob integration ID is required';
  }

  if (!config.hmacSecret || !config.hmacSecret.trim()) {
    return 'Paymob HMAC secret is required';
  }

  if (config.apiBaseUrl) {
    const normalizedBaseUrl = normalizeProviderBaseUrl(config.apiBaseUrl, 'paymob');
    if (normalizedBaseUrl.error) {
      return normalizedBaseUrl.error;
    }
  }

  return null;
}

export function normalizeWatiConnectionConfig(config: WatiConnectionConfig): WatiConnectionConfig {
  return {
    apiBaseUrl: normalizeWatiBaseUrl(config.apiBaseUrl),
    accessToken: config.accessToken.trim(),
    webhookSecret: config.webhookSecret.trim(),
  };
}

export function normalizePaymobConnectionConfig(
  config: PaymobConnectionConfig
): PaymobConnectionConfig {
  return {
    publicKey: config.publicKey.trim(),
    secretKey: config.secretKey.trim(),
    integrationId: config.integrationId.trim(),
    hmacSecret: config.hmacSecret.trim(),
    apiBaseUrl: config.apiBaseUrl?.trim() ? normalizePaymobBaseUrl(config.apiBaseUrl) : null,
  };
}

export function mergeWatiConfig(
  existing: WatiConnectionConfig | null,
  patch: Partial<WatiConnectionConfig>
): WatiConnectionConfig {
  return {
    apiBaseUrl: patch.apiBaseUrl?.trim() || existing?.apiBaseUrl || '',
    accessToken: patch.accessToken?.trim() || existing?.accessToken || '',
    webhookSecret: patch.webhookSecret?.trim() || existing?.webhookSecret || '',
  };
}

export function mergePaymobConfig(
  existing: PaymobConnectionConfig | null,
  patch: Partial<PaymobConnectionConfig>
): PaymobConnectionConfig {
  return {
    publicKey: patch.publicKey?.trim() || existing?.publicKey || '',
    secretKey: patch.secretKey?.trim() || existing?.secretKey || '',
    integrationId: patch.integrationId?.trim() || existing?.integrationId || '',
    hmacSecret: patch.hmacSecret?.trim() || existing?.hmacSecret || '',
    apiBaseUrl: patch.apiBaseUrl?.trim() || existing?.apiBaseUrl || null,
  };
}

export function toMessagingConnectionSummary(
  record: MessagingConnectionRecord | null
): MessagingConnectionSummary {
  if (!record) {
    return {
      id: null,
      provider: 'wati',
      mode: ProviderConnectionMode.sandbox,
      status: 'not_connected',
      accountLabel: null,
      senderIdentifier: null,
      verifiedAt: null,
      lastHealthcheckAt: null,
      lastError: null,
      hasConfig: false,
      configPreview: null,
    };
  }

  let configPreview: MessagingConnectionSummary['configPreview'] = null;

  try {
    const config = normalizeWatiConnectionConfig(
      decryptProviderConfig<WatiConnectionConfig>(record.encryptedConfig)
    );
    configPreview = {
      apiBaseUrl: config.apiBaseUrl,
    };
  } catch {
    configPreview = null;
  }

  return {
    id: record.id,
    provider: record.provider,
    mode: record.mode,
    status: record.status,
    accountLabel: record.accountLabel,
    senderIdentifier: record.senderIdentifier,
    verifiedAt: isoOrNull(record.verifiedAt),
    lastHealthcheckAt: isoOrNull(record.lastHealthcheckAt),
    lastError: record.lastError,
    hasConfig: true,
    configPreview,
  };
}

export function toPaymentConnectionSummary(
  record: PaymentConnectionRecord | null
): PaymentConnectionSummary {
  if (!record) {
    return {
      id: null,
      provider: 'paymob',
      mode: ProviderConnectionMode.sandbox,
      status: 'not_connected',
      accountLabel: null,
      verifiedAt: null,
      lastHealthcheckAt: null,
      lastError: null,
      hasConfig: false,
      configPreview: null,
    };
  }

  let configPreview: PaymentConnectionSummary['configPreview'] = null;

  try {
    const config = normalizePaymobConnectionConfig(
      decryptProviderConfig<PaymobConnectionConfig>(record.encryptedConfig)
    );
    configPreview = {
      publicKeyMasked: maskValue(config.publicKey),
      integrationId: config.integrationId,
      apiBaseUrl: config.apiBaseUrl ?? null,
    };
  } catch {
    configPreview = null;
  }

  return {
    id: record.id,
    provider: record.provider,
    mode: record.mode,
    status: record.status,
    accountLabel: record.accountLabel,
    verifiedAt: isoOrNull(record.verifiedAt),
    lastHealthcheckAt: isoOrNull(record.lastHealthcheckAt),
    lastError: record.lastError,
    hasConfig: true,
    configPreview,
  };
}

export async function getVerifiedMessagingConnection(prisma: PrismaLike, userId: string) {
  const record = await prisma.messagingProviderConnection.findFirst({
    where: {
      userId,
      provider: 'wati',
      status: ProviderConnectionStatus.verified,
    },
  });

  if (!record) {
    return null;
  }

  return {
    record,
    config: normalizeWatiConnectionConfig(
      decryptProviderConfig<WatiConnectionConfig>(record.encryptedConfig)
    ),
  };
}

export async function getVerifiedPaymentConnection(prisma: PrismaLike, userId: string) {
  const record = await prisma.paymentProviderConnection.findFirst({
    where: {
      userId,
      provider: 'paymob',
      status: ProviderConnectionStatus.verified,
    },
  });

  if (!record) {
    return null;
  }

  return {
    record,
    config: normalizePaymobConnectionConfig(
      decryptProviderConfig<PaymobConnectionConfig>(record.encryptedConfig)
    ),
  };
}
