import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import { isDatabaseConnectivityError } from '@/lib/database-errors';
import { requireEnv } from '@/lib/env';
import { callSupabaseRpc, ensureFallbackUserProfile } from '@/lib/supabase-rpc';
import { isRecord } from '@/lib/validators';
import {
  toMessagingConnectionSummary,
  toPaymentConnectionSummary,
} from '@/lib/provider-connections';

interface SettingsBody {
  businessName?: unknown;
  whatsappNumber?: unknown;
  name?: unknown;
  notificationPrefs?: unknown;
}

async function loadSettingsPayload(userId: string) {
  const [user, messagingConnection, paymentConnection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
        notifyPaymentReceived: true,
        notifyDailySummary: true,
        notifyOverdueAlerts: true,
      },
    }),
    prisma.messagingProviderConnection.findFirst({
      where: { userId },
    }),
    prisma.paymentProviderConnection.findFirst({
      where: { userId },
    }),
  ]);

  if (!user) {
    return null;
  }

  return {
    ...user,
    notificationPrefs: {
      paymentReceived: user.notifyPaymentReceived,
      dailySummary: user.notifyDailySummary,
      overdueAlerts: user.notifyOverdueAlerts,
    },
    messagingConnection: toMessagingConnectionSummary(messagingConnection),
    paymentConnection: toPaymentConnectionSummary(paymentConnection),
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    try {
      const payload = await loadSettingsPayload(session.user.id);
      if (!payload) {
        return apiError('User not found', 404, 'NOT_FOUND');
      }

      return Response.json(payload);
    } catch (error) {
      if (isDatabaseConnectivityError(error)) {
        const secret = requireEnv('PROVIDER_CONFIG_SECRET');
        const payload = await callSupabaseRpc<{
          user: {
            id: string;
            name: string | null;
            email: string;
            businessName: string | null;
            whatsappNumber: string | null;
            plan: string;
            notifyPaymentReceived: boolean;
            notifyDailySummary: boolean;
            notifyOverdueAlerts: boolean;
          } | null;
          messagingConnectionRecord: Parameters<typeof toMessagingConnectionSummary>[0];
          paymentConnectionRecord: Parameters<typeof toPaymentConnectionSummary>[0];
        }>('app_get_settings', {
          p_user_id: session.user.id,
          p_secret: secret,
        });

        if (!payload?.user) {
          const user = await ensureFallbackUserProfile(
            {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
            },
            secret
          );

          return Response.json({
            ...user,
            notificationPrefs: {
              paymentReceived: user.notifyPaymentReceived,
              dailySummary: user.notifyDailySummary,
              overdueAlerts: user.notifyOverdueAlerts,
            },
            messagingConnection: toMessagingConnectionSummary(null),
            paymentConnection: toPaymentConnectionSummary(null),
          });
        }

        return Response.json({
          ...payload.user,
          notificationPrefs: {
            paymentReceived: payload.user.notifyPaymentReceived,
            dailySummary: payload.user.notifyDailySummary,
            overdueAlerts: payload.user.notifyOverdueAlerts,
          },
          messagingConnection: toMessagingConnectionSummary(payload.messagingConnectionRecord),
          paymentConnection: toPaymentConnectionSummary(payload.paymentConnectionRecord),
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Settings read error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await readJsonBody<SettingsBody>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const normalizeNullableField = (value: unknown) => {
      if (value === undefined) return { provided: false as const, valid: true as const };
      if (typeof value !== 'string') return { provided: true as const, valid: false as const };
      const trimmed = value.trim();
      return {
        provided: true as const,
        valid: true as const,
        value: trimmed.length > 0 ? trimmed : null,
      };
    };

    const nameField = normalizeNullableField(body.name);
    const businessNameField = normalizeNullableField(body.businessName);
    const whatsappNumberField = normalizeNullableField(body.whatsappNumber);
    const notificationPrefs = (() => {
      if (body.notificationPrefs === undefined) {
        return { provided: false as const, valid: true as const };
      }

      if (!isRecord(body.notificationPrefs)) {
        return { provided: true as const, valid: false as const };
      }

      const paymentReceived = body.notificationPrefs.paymentReceived;
      const dailySummary = body.notificationPrefs.dailySummary;
      const overdueAlerts = body.notificationPrefs.overdueAlerts;

      if (
        typeof paymentReceived !== 'boolean' ||
        typeof dailySummary !== 'boolean' ||
        typeof overdueAlerts !== 'boolean'
      ) {
        return { provided: true as const, valid: false as const };
      }

      return {
        provided: true as const,
        valid: true as const,
        value: {
          notifyPaymentReceived: paymentReceived,
          notifyDailySummary: dailySummary,
          notifyOverdueAlerts: overdueAlerts,
        },
      };
    })();

    if (!nameField.valid || !businessNameField.valid || !whatsappNumberField.valid || !notificationPrefs.valid) {
      return apiError('Invalid settings payload', 400, 'VALIDATION_ERROR');
    }

    if (!nameField.provided && !businessNameField.provided && !whatsappNumberField.provided && !notificationPrefs.provided) {
      return apiError('No update fields provided', 400, 'VALIDATION_ERROR');
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(nameField.provided && { name: nameField.value }),
        ...(businessNameField.provided && { businessName: businessNameField.value }),
        ...(whatsappNumberField.provided && { whatsappNumber: whatsappNumberField.value }),
        ...(notificationPrefs.provided && notificationPrefs.value),
      },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
        notifyPaymentReceived: true,
        notifyDailySummary: true,
        notifyOverdueAlerts: true,
      },
    });

    const payload = await loadSettingsPayload(session.user.id);
    if (!payload) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return Response.json(payload);
  } catch (error) {
    console.error('Settings update error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
