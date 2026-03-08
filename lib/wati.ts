import crypto from 'node:crypto';
import { getEnv, requireEnv } from '@/lib/env';

export interface WatiTemplateSendInput {
  phone: string;
  templateName: string;
  broadcastName: string;
  parameters: string[];
}

export interface WatiTemplateSendResult {
  providerMessageId: string | null;
  rawPayload: unknown;
}

function getWatiBaseUrl(): string {
  const configured = requireEnv('WATI_API_BASE_URL');
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function isWatiConfigured(): boolean {
  return Boolean(getEnv('WATI_API_BASE_URL') && getEnv('WATI_ACCESS_TOKEN') && getEnv('WATI_WEBHOOK_SECRET'));
}

export async function sendWatiTemplateMessage(
  input: WatiTemplateSendInput
): Promise<WatiTemplateSendResult> {
  const endpoint = `${getWatiBaseUrl()}/api/v1/sendTemplateMessages`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('WATI_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_name: input.templateName,
      broadcast_name: input.broadcastName,
      receivers: [
        {
          whatsappNumber: normalizePhone(input.phone),
          customParams: input.parameters.map((value) => ({ name: value, value })),
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.message === 'string' ? payload.message : 'Failed to send WATI template message'
    );
  }

  const providerMessageId =
    (typeof payload.id === 'string' && payload.id) ||
    (typeof payload.messageId === 'string' && payload.messageId) ||
    (typeof payload.localMessageId === 'string' && payload.localMessageId) ||
    null;

  return {
    providerMessageId,
    rawPayload: payload,
  };
}

function collectCandidateSignatures(request: Request): string[] {
  const candidates = [
    request.headers.get('x-wati-signature'),
    request.headers.get('x-webhook-signature'),
    request.headers.get('x-hub-signature-256'),
  ];

  return candidates.filter((value): value is string => Boolean(value && value.trim().length > 0));
}

export function verifyWatiWebhookSignature(request: Request, rawBody: string): boolean {
  const secret = requireEnv('WATI_WEBHOOK_SECRET');
  const candidates = collectCandidateSignatures(request);
  if (candidates.length === 0) {
    return false;
  }

  const sha256 = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sha512 = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const prefixedSha256 = `sha256=${sha256}`;

  return candidates.some((candidate) => {
    const normalized = candidate.trim();
    return [sha256, sha512, prefixedSha256].some((expected) => {
      return normalized.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
    });
  });
}

export function mapWatiDeliveryStatus(payload: Record<string, unknown>): {
  providerMessageId: string | null;
  nextStatus: 'delivered' | 'failed' | null;
} {
  const providerMessageId =
    (typeof payload.localMessageId === 'string' && payload.localMessageId) ||
    (typeof payload.id === 'string' && payload.id) ||
    null;
  const eventType = typeof payload.eventType === 'string' ? payload.eventType : '';
  const statusString = typeof payload.statusString === 'string' ? payload.statusString.toUpperCase() : '';

  if (eventType.includes('DELIVERED') || statusString === 'DELIVERED') {
    return { providerMessageId, nextStatus: 'delivered' };
  }

  if (eventType.includes('FAILED') || statusString === 'FAILED') {
    return { providerMessageId, nextStatus: 'failed' };
  }

  return { providerMessageId, nextStatus: null };
}
