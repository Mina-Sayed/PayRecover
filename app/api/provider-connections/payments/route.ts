import { ProviderConnectionMode, ProviderConnectionStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import { asOptionalTrimmedString, asTrimmedString, isRecord } from '@/lib/validators';
import {
  decryptProviderConfig,
  encryptProviderConfig,
  mergePaymobConfig,
  toPaymentConnectionSummary,
  validatePaymobConnectionInput,
  type PaymobConnectionConfig,
} from '@/lib/provider-connections';

interface PaymentConnectionBody {
  accountLabel?: unknown;
  mode?: unknown;
  publicKey?: unknown;
  secretKey?: unknown;
  integrationId?: unknown;
  hmacSecret?: unknown;
  apiBaseUrl?: unknown;
}

function normalizeMode(value: unknown): ProviderConnectionMode {
  return value === ProviderConnectionMode.live ? ProviderConnectionMode.live : ProviderConnectionMode.sandbox;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await readJsonBody<PaymentConnectionBody>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.paymentProviderConnection.findFirst({
      where: {
        userId: session.user.id,
        provider: 'paymob',
      },
    });

    const mergedConfig = mergePaymobConfig(
      existing ? decryptProviderConfig<PaymobConnectionConfig>(existing.encryptedConfig) : null,
      {
        publicKey: asTrimmedString(body.publicKey) ?? undefined,
        secretKey: asTrimmedString(body.secretKey) ?? undefined,
        integrationId: asTrimmedString(body.integrationId) ?? undefined,
        hmacSecret: asTrimmedString(body.hmacSecret) ?? undefined,
        apiBaseUrl: asOptionalTrimmedString(body.apiBaseUrl) ?? undefined,
      }
    );

    const validationError = validatePaymobConnectionInput(mergedConfig);
    if (validationError) {
      return apiError(validationError, 400, 'VALIDATION_ERROR');
    }

    const record = existing
      ? await prisma.paymentProviderConnection.update({
          where: { id: existing.id },
          data: {
            accountLabel: asTrimmedString(body.accountLabel),
            mode: normalizeMode(body.mode),
            status: ProviderConnectionStatus.configured,
            encryptedConfig: encryptProviderConfig(mergedConfig),
            lastError: null,
          },
        })
      : await prisma.paymentProviderConnection.create({
          data: {
            userId: session.user.id,
            provider: 'paymob',
            accountLabel: asTrimmedString(body.accountLabel),
            mode: normalizeMode(body.mode),
            status: ProviderConnectionStatus.configured,
            encryptedConfig: encryptProviderConfig(mergedConfig),
          },
        });

    return Response.json({
      paymentConnection: toPaymentConnectionSummary(record),
    });
  } catch (error) {
    console.error('Payment connection save error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
