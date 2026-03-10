import { ProviderConnectionMode, ProviderConnectionStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import { asTrimmedString, isRecord } from '@/lib/validators';
import {
  decryptProviderConfig,
  encryptProviderConfig,
  mergeWatiConfig,
  toMessagingConnectionSummary,
  validateWatiConnectionInput,
  type WatiConnectionConfig,
} from '@/lib/provider-connections';

interface MessagingConnectionBody {
  accountLabel?: unknown;
  senderIdentifier?: unknown;
  mode?: unknown;
  apiBaseUrl?: unknown;
  accessToken?: unknown;
  webhookSecret?: unknown;
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

    const body = await readJsonBody<MessagingConnectionBody>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.messagingProviderConnection.findFirst({
      where: {
        userId: session.user.id,
        provider: 'wati',
      },
    });

    const mergedConfig = mergeWatiConfig(
      existing ? decryptProviderConfig<WatiConnectionConfig>(existing.encryptedConfig) : null,
      {
        apiBaseUrl: asTrimmedString(body.apiBaseUrl) ?? undefined,
        accessToken: asTrimmedString(body.accessToken) ?? undefined,
        webhookSecret: asTrimmedString(body.webhookSecret) ?? undefined,
      }
    );

    const validationError = validateWatiConnectionInput(mergedConfig);
    if (validationError) {
      return apiError(validationError, 400, 'VALIDATION_ERROR');
    }

    const record = existing
      ? await prisma.messagingProviderConnection.update({
          where: { id: existing.id },
          data: {
            accountLabel: asTrimmedString(body.accountLabel),
            senderIdentifier: asTrimmedString(body.senderIdentifier),
            mode: normalizeMode(body.mode),
            status: ProviderConnectionStatus.configured,
            encryptedConfig: encryptProviderConfig(mergedConfig),
            lastError: null,
          },
        })
      : await prisma.messagingProviderConnection.create({
          data: {
            userId: session.user.id,
            provider: 'wati',
            accountLabel: asTrimmedString(body.accountLabel),
            senderIdentifier: asTrimmedString(body.senderIdentifier),
            mode: normalizeMode(body.mode),
            status: ProviderConnectionStatus.configured,
            encryptedConfig: encryptProviderConfig(mergedConfig),
          },
        });

    return Response.json({
      messagingConnection: toMessagingConnectionSummary(record),
    });
  } catch (error) {
    console.error('Messaging connection save error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
