process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret';
process.env.AUTH_URL = process.env.AUTH_URL || 'http://localhost:3000';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/payrecover_test';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';
process.env.PAYMOB_PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY || 'pk_test';
process.env.PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY || 'sk_test';
process.env.PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID || '123456';
process.env.PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || 'paymob-hmac-secret';
process.env.WATI_API_BASE_URL = process.env.WATI_API_BASE_URL || 'https://wati.example.com';
process.env.WATI_ACCESS_TOKEN = process.env.WATI_ACCESS_TOKEN || 'wati-token';
process.env.WATI_WEBHOOK_SECRET = process.env.WATI_WEBHOOK_SECRET || 'wati-webhook-secret';
