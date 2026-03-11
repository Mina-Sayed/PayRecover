import { ReminderRunStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { mapWatiDeliveryStatus, verifyWatiWebhookSignature } from '@/lib/wati';
import { formatInvoiceEventMessage } from '@/lib/invoice-events';
import { decryptProviderConfig, type WatiConnectionConfig } from '@/lib/provider-connections';

function getReminderStatusOrder(status: ReminderRunStatus): number {
  switch (status) {
    case ReminderRunStatus.scheduled:
      return 0;
    case ReminderRunStatus.sending:
      return 1;
    case ReminderRunStatus.sent:
      return 2;
    case ReminderRunStatus.failed:
      return 3;
    case ReminderRunStatus.delivered:
      return 4;
    case ReminderRunStatus.suppressed:
      return 5;
    case ReminderRunStatus.cancelled:
      return 6;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return apiError('Invalid WATI payload', 400, 'VALIDATION_ERROR');
    }

    const { providerMessageId, nextStatus } = mapWatiDeliveryStatus(payload);
    if (!providerMessageId || !nextStatus) {
      return apiError('Unsupported WATI payload', 400, 'VALIDATION_ERROR');
    }

    const reminderRun = await prisma.reminderRun.findUnique({
      where: { providerMessageId },
      select: {
        id: true,
        invoiceId: true,
        userId: true,
        status: true,
        deliveryConfirmedAt: true,
        messagingConnection: {
          select: {
            encryptedConfig: true,
          },
        },
      },
    });

    if (!reminderRun) {
      return apiError('Reminder run not found', 404, 'NOT_FOUND');
    }

    if (!reminderRun.messagingConnection?.encryptedConfig) {
      return apiError('No WATI connection found for reminder run', 400, 'VALIDATION_ERROR');
    }

    const connection = decryptProviderConfig<WatiConnectionConfig>(
      reminderRun.messagingConnection.encryptedConfig
    );

    if (!verifyWatiWebhookSignature(request, rawBody, connection.webhookSecret)) {
      return apiError('Invalid WATI signature', 401, 'UNAUTHORIZED');
    }

    if (getReminderStatusOrder(reminderRun.status) >= getReminderStatusOrder(nextStatus)) {
      return Response.json({ message: 'Duplicate or stale WATI callback ignored' });
    }

    await prisma.reminderRun.update({
      where: { id: reminderRun.id },
      data: {
        status: nextStatus,
        deliveryConfirmedAt:
          nextStatus === 'delivered' ? reminderRun.deliveryConfirmedAt ?? new Date() : null,
        lastError: nextStatus === 'failed' ? 'WATI delivery failed' : null,
      },
    });

    await prisma.invoiceEvent.create({
      data: {
        invoiceId: reminderRun.invoiceId,
        userId: reminderRun.userId,
        type: nextStatus === 'delivered' ? 'reminder_delivered' : 'reminder_failed',
        message: formatInvoiceEventMessage(
          nextStatus === 'delivered' ? 'reminder_delivered' : 'reminder_failed'
        ),
      },
    });

    return Response.json({ message: 'WATI callback accepted' });
  } catch (error) {
    console.error('WATI webhook error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
