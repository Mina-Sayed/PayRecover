import { describe, expect, it } from 'vitest';
import {
  decryptProviderConfig,
  encryptProviderConfig,
  mergePaymobConfig,
  mergeWatiConfig,
  normalizePaymobConnectionConfig,
  normalizeWatiConnectionConfig,
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

  it('rejects unsafe provider base URLs and normalizes safe ones', () => {
    expect(
      validateWatiConnectionInput({
        apiBaseUrl: 'http://169.254.169.254',
        accessToken: 'token',
        webhookSecret: 'secret',
      })
    ).toBe('Provider base URL must use HTTPS');

    expect(
      normalizeWatiConnectionConfig({
        apiBaseUrl: 'https://wati.example.com/path',
        accessToken: ' token ',
        webhookSecret: ' secret ',
      })
    ).toEqual({
      apiBaseUrl: 'https://wati.example.com',
      accessToken: 'token',
      webhookSecret: 'secret',
    });

    expect(
      normalizePaymobConnectionConfig({
        publicKey: ' pk ',
        secretKey: ' sk ',
        integrationId: ' 123 ',
        hmacSecret: ' hmac ',
        apiBaseUrl: 'https://accept.paymob.com/tenant',
      })
    ).toEqual({
      publicKey: 'pk',
      secretKey: 'sk',
      integrationId: '123',
      hmacSecret: 'hmac',
      apiBaseUrl: 'https://accept.paymob.com',
    });
  });
});
