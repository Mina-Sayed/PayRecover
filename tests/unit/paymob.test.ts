import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  extractPaymobWebhookCore,
  verifyPaymobWebhookSignature,
} from '@/lib/paymob';

function signPayload(payload: Record<string, unknown>) {
  const signatureSource = payload.obj as Record<string, unknown>;
  const fields = [
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
  ];

  const read = (source: Record<string, unknown>, path: string) =>
    path.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') {
        return null;
      }

      return (current as Record<string, unknown>)[part];
    }, source);

  const value = fields
    .map((field) => {
      const candidate = read(signatureSource, field);
      if (candidate === undefined || candidate === null) {
        return '';
      }
      if (typeof candidate === 'boolean') {
        return candidate ? 'true' : 'false';
      }
      return String(candidate);
    })
    .join('');

  return crypto
    .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET!)
    .update(value)
    .digest('hex');
}

describe('paymob helpers', () => {
  it('extracts invoice reference and payment result from the webhook payload', () => {
    const payload = {
      obj: {
        id: 9001,
        amount_cents: 12000,
        currency: 'EGP',
        success: true,
        pending: false,
        error_occured: false,
        order: {
          id: 77,
          merchant_order_id: 'inv-1',
        },
      },
    };

    expect(extractPaymobWebhookCore(payload)).toMatchObject({
      providerEventId: '9001',
      amountCents: 12000,
      invoiceReference: 'inv-1',
      isSuccess: true,
    });
  });

  it('verifies the HMAC signature against the expected field concatenation', () => {
    const payload = {
      obj: {
        amount_cents: 12000,
        created_at: '2026-03-08T00:00:00Z',
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        id: 9001,
        integration_id: 123456,
        is_3d_secure: false,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 77, merchant_order_id: 'inv-1' },
        owner: 42,
        pending: false,
        source_data: {
          pan: '2345',
          sub_type: 'MasterCard',
          type: 'card',
        },
        success: true,
      },
    } as Record<string, unknown>;

    payload.hmac = signPayload(payload);

    expect(verifyPaymobWebhookSignature(payload, process.env.PAYMOB_HMAC_SECRET!)).toBe(true);
  });
});
