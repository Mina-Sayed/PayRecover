import crypto from 'node:crypto';
import { getEnv, requireEnv } from '@/lib/env';

const PAYMOB_DEFAULT_BASE_URL = 'https://accept.paymob.com';

const PAYMOB_HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

export interface CreatePaymobPaymentLinkInput {
  invoiceId: string;
  invoiceNo: string;
  amountCents: number;
  currency: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string;
  businessName: string;
  callbackUrl: string;
  redirectUrl: string;
}

export interface PaymobPaymentLinkResult {
  providerRef: string | null;
  url: string;
  expiresAt: Date | null;
  rawPayload: unknown;
}

interface PaymobWebhookCore {
  amountCents: number;
  currency: string;
  isSuccess: boolean;
  providerEventId: string;
  signatureSource: Record<string, unknown>;
  receivedSignature: string | null;
  invoiceReference: string | null;
}

function getPaymobBaseUrl(): string {
  return getEnv('PAYMOB_API_BASE_URL') ?? PAYMOB_DEFAULT_BASE_URL;
}

function getNestedValue(payload: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return null;
    }

    return (current as Record<string, unknown>)[segment];
  }, payload);
}

function stringifyPaymobValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

export function isPaymobConfigured(): boolean {
  return Boolean(
    getEnv('PAYMOB_PUBLIC_KEY') &&
      getEnv('PAYMOB_SECRET_KEY') &&
      getEnv('PAYMOB_INTEGRATION_ID') &&
      getEnv('PAYMOB_HMAC_SECRET')
  );
}

export function buildPaymobCheckoutUrl(clientSecret: string): string {
  const baseUrl = getPaymobBaseUrl();
  const publicKey = requireEnv('PAYMOB_PUBLIC_KEY');
  const url = new URL('/unifiedcheckout/', baseUrl);
  url.searchParams.set('publicKey', publicKey);
  url.searchParams.set('clientSecret', clientSecret);
  return url.toString();
}

function readPaymobClientSecret(payload: Record<string, unknown>): string | null {
  const direct = payload.client_secret;
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  const nested = payload.intention_detail;
  if (nested && typeof nested === 'object') {
    const nestedValue = (nested as Record<string, unknown>).client_secret;
    if (typeof nestedValue === 'string' && nestedValue.length > 0) {
      return nestedValue;
    }
  }

  return null;
}

function readPaymobProviderRef(payload: Record<string, unknown>): string | null {
  const directCandidates = [
    payload.id,
    payload.intention_order_id,
    payload.order_id,
  ];

  for (const candidate of directCandidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim().length > 0) {
      return String(candidate);
    }
  }

  return null;
}

export async function createPaymobPaymentLink(
  input: CreatePaymobPaymentLinkInput
): Promise<PaymobPaymentLinkResult> {
  const secretKey = requireEnv('PAYMOB_SECRET_KEY');
  const integrationId = Number(requireEnv('PAYMOB_INTEGRATION_ID'));
  const endpoint = new URL('/v1/intention/', getPaymobBaseUrl());

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Token ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: input.currency,
      payment_methods: [integrationId],
      items: [
        {
          name: input.invoiceNo,
          amount: input.amountCents,
          description: `Invoice ${input.invoiceNo}`,
          quantity: 1,
        },
      ],
      billing_data: {
        first_name: input.clientName,
        last_name: input.businessName,
        email: input.clientEmail ?? 'no-reply@payrecover.local',
        phone_number: input.clientPhone,
      },
      notification_url: input.callbackUrl,
      redirection_url: input.redirectUrl,
      special_reference: input.invoiceId,
      merchant_order_id: input.invoiceId,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.message === 'string' ? payload.message : 'Failed to create Paymob payment link'
    );
  }

  const clientSecret = readPaymobClientSecret(payload);
  if (!clientSecret) {
    throw new Error('Paymob response did not include a client secret');
  }

  const expiresAtRaw = payload.expires_at ?? payload.expiration;
  const expiresAt =
    typeof expiresAtRaw === 'string' || expiresAtRaw instanceof Date
      ? new Date(expiresAtRaw)
      : null;

  return {
    providerRef: readPaymobProviderRef(payload),
    url: buildPaymobCheckoutUrl(clientSecret),
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    rawPayload: payload,
  };
}

export function extractPaymobWebhookCore(payload: unknown): PaymobWebhookCore | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const root = payload as Record<string, unknown>;
  const candidate = (root.obj && typeof root.obj === 'object'
    ? (root.obj as Record<string, unknown>)
    : root) as Record<string, unknown>;

  const amountRaw = candidate.amount_cents ?? candidate.amount;
  const providerEventId = candidate.id;
  if (providerEventId === undefined || providerEventId === null) {
    return null;
  }

  const invoiceReferenceCandidates = [
    getNestedValue(candidate, 'order.merchant_order_id'),
    candidate.merchant_order_id,
    candidate.special_reference,
    getNestedValue(candidate, 'order.id'),
  ];

  const invoiceReference =
    invoiceReferenceCandidates.find(
      (value) => value !== undefined && value !== null && String(value).trim().length > 0
    ) ?? null;

  return {
    amountCents: Number(amountRaw ?? 0),
    currency: stringifyPaymobValue(candidate.currency || 'EGP'),
    isSuccess:
      stringifyPaymobValue(candidate.success) === 'true' &&
      stringifyPaymobValue(candidate.pending) !== 'true' &&
      stringifyPaymobValue(candidate.error_occured) !== 'true',
    providerEventId: String(providerEventId),
    signatureSource: candidate,
    receivedSignature:
      (typeof root.hmac === 'string' && root.hmac) ||
      (typeof candidate.hmac === 'string' && candidate.hmac) ||
      null,
    invoiceReference: invoiceReference ? String(invoiceReference) : null,
  };
}

export function verifyPaymobWebhookSignature(payload: unknown): boolean {
  const core = extractPaymobWebhookCore(payload);
  if (!core?.receivedSignature) {
    return false;
  }

  const secret = requireEnv('PAYMOB_HMAC_SECRET');
  const concatenated = PAYMOB_HMAC_FIELDS.map((field) =>
    stringifyPaymobValue(getNestedValue(core.signatureSource, field))
  ).join('');

  const expected = crypto.createHmac('sha512', secret).update(concatenated).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(core.receivedSignature));
}
