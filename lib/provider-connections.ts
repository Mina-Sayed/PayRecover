import crypto from 'node:crypto';
import {
  MessagingProviderKind,
  PaymentProviderKind,
  ProviderConnectionMode,
  ProviderConnectionStatus,
  type PrismaClient,
} from '@prisma/client';
import { requireEnv } from '@/lib/env';

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

  return null;
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

  const config = decryptProviderConfig<WatiConnectionConfig>(record.encryptedConfig);

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
    configPreview: {
      apiBaseUrl: config.apiBaseUrl,
    },
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

  const config = decryptProviderConfig<PaymobConnectionConfig>(record.encryptedConfig);

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
    configPreview: {
      publicKeyMasked: maskValue(config.publicKey),
      integrationId: config.integrationId,
      apiBaseUrl: config.apiBaseUrl ?? null,
    },
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
    config: decryptProviderConfig<WatiConnectionConfig>(record.encryptedConfig),
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
    config: decryptProviderConfig<PaymobConnectionConfig>(record.encryptedConfig),
  };
}
