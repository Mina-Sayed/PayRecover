import { describe, expect, it } from 'vitest';
import { providerCatalog } from '@/lib/provider-catalog';

describe('provider catalog', () => {
  it('locks the selected providers to Paymob and WATI', () => {
    expect(providerCatalog.map((provider) => provider.id)).toEqual(['paymob', 'wati']);
    expect(providerCatalog.every((provider) => provider.rolloutStatus === 'selected')).toBe(true);
  });

  it('documents the required planned environment keys for each provider', () => {
    const paymob = providerCatalog.find((provider) => provider.id === 'paymob');
    const wati = providerCatalog.find((provider) => provider.id === 'wati');

    expect(paymob?.envKeys).toEqual([
      'PAYMOB_PUBLIC_KEY',
      'PAYMOB_SECRET_KEY',
      'PAYMOB_INTEGRATION_ID',
      'PAYMOB_HMAC_SECRET',
    ]);
    expect(wati?.envKeys).toEqual([
      'WATI_API_BASE_URL',
      'WATI_ACCESS_TOKEN',
      'WATI_WEBHOOK_SECRET',
    ]);
  });
});
