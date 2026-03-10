import { describe, expect, it } from 'vitest';
import {
  decryptProviderConfig,
  encryptProviderConfig,
  mergePaymobConfig,
  mergeWatiConfig,
  validatePaymobConnectionInput,
  validateWatiConnectionInput,
} from '@/lib/provider-connections';

describe('provider connection helpers', () => {
  it('round-trips encrypted provider config payloads', () => {
    const encrypted = encryptProviderConfig({
      apiBaseUrl: 'https://wati.example.com',
      accessToken: 'token-123',
      webhookSecret: 'secret-456',
    });

    expect(
      decryptProviderConfig<{
        apiBaseUrl: string;
        accessToken: string;
        webhookSecret: string;
      }>(encrypted)
    ).toEqual({
      apiBaseUrl: 'https://wati.example.com',
      accessToken: 'token-123',
      webhookSecret: 'secret-456',
    });
  });

  it('preserves existing provider secrets when merge patches omit them', () => {
    expect(
      mergePaymobConfig(
        {
          publicKey: 'pk_live_existing',
          secretKey: 'sk_live_existing',
          integrationId: '111111',
          hmacSecret: 'hmac-existing',
          apiBaseUrl: 'https://accept.paymob.com',
        },
        {
          integrationId: '222222',
        }
      )
    ).toEqual({
      publicKey: 'pk_live_existing',
      secretKey: 'sk_live_existing',
      integrationId: '222222',
      hmacSecret: 'hmac-existing',
      apiBaseUrl: 'https://accept.paymob.com',
    });
  });

  it('validates required WATI and Paymob fields', () => {
    expect(validateWatiConnectionInput(mergeWatiConfig(null, {}))).toBe('WATI base URL is required');
    expect(validatePaymobConnectionInput(mergePaymobConfig(null, {}))).toBe(
      'Paymob public key is required'
    );
  });
});
