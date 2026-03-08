import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { mapWatiDeliveryStatus, verifyWatiWebhookSignature } from '@/lib/wati';
import { formatInvoiceEventMessage } from '@/lib/invoice-events';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody) as Record<string, unknown>;

    if (!verifyWatiWebhookSignature(request, rawBody)) {
      return apiError('Invalid WATI signature', 401, 'UNAUTHORIZED');
    }

    const { providerMessageId, nextStatus } = mapWatiDeliveryStatus(payload);
    if (!providerMessageId || !nextStatus) {
      return apiError('Unsupported WATI payload', 400, 'VALIDATION_ERROR');
    }

    const reminderRun = await prisma.reminderRun.findFirst({
      where: { providerMessageId },
      select: {
        id: true,
        invoiceId: true,
        userId: true,
      },
    });

    if (!reminderRun) {
      return apiError('Reminder run not found', 404, 'NOT_FOUND');
    }

    await prisma.reminderRun.update({
      where: { id: reminderRun.id },
      data: {
        status: nextStatus,
        deliveryConfirmedAt: nextStatus === 'delivered' ? new Date() : null,
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
