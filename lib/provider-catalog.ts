export interface ProviderCatalogEntry {
  id: 'paymob' | 'wati';
  category: 'payments' | 'messaging';
  name: string;
  badge: string;
  headline: string;
  description: string;
  capabilities: string[];
  envKeys: string[];
  rolloutStatus: 'selected' | 'deferred';
}

export const providerCatalog: ProviderCatalogEntry[] = [
  {
    id: 'paymob',
    category: 'payments',
    name: 'Paymob',
    badge: 'PM',
    headline: 'Checkout and payment-link provider',
    description:
      'Selected provider for invoice checkout. The next rollout will use Paymob intention creation, hosted checkout, and callback verification.',
    capabilities: [
      'Create Intention / payment flow',
      'Hosted checkout with public key + client secret',
      'Integration IDs and HMAC callback verification',
    ],
    envKeys: [
      'PAYMOB_PUBLIC_KEY',
      'PAYMOB_SECRET_KEY',
      'PAYMOB_INTEGRATION_ID',
      'PAYMOB_HMAC_SECRET',
    ],
    rolloutStatus: 'selected',
  },
  {
    id: 'wati',
    category: 'messaging',
    name: 'WATI',
    badge: 'WA',
    headline: 'WhatsApp template delivery provider',
    description:
      'Selected provider for reminder delivery. The next rollout will use WATI template messaging, checkout-button templates, and message-status webhooks.',
    capabilities: [
      'WhatsApp template messaging',
      'Checkout button templates for Pay Now / Buy Now',
      'Message-status webhooks',
    ],
    envKeys: ['WATI_API_BASE_URL', 'WATI_ACCESS_TOKEN', 'WATI_WEBHOOK_SECRET'],
    rolloutStatus: 'selected',
  },
];
