import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { extractPaymobWebhookCore, verifyPaymobWebhookSignature } from '@/lib/paymob';
import { toDecimal } from '@/lib/money';
import { formatInvoiceEventMessage } from '@/lib/invoice-events';

async function findInvoiceFromWebhookReference(reference: string | null) {
  if (!reference) {
    return null;
  }

  const directInvoice = await prisma.invoice.findFirst({
    where: { id: reference },
    select: { id: true, userId: true, invoiceNo: true },
  });

  if (directInvoice) {
    return directInvoice;
  }

  const paymentLink = await prisma.paymentLink.findFirst({
    where: {
      provider: 'paymob',
      providerRef: reference,
    },
    select: {
      invoice: {
        select: {
          id: true,
          userId: true,
          invoiceNo: true,
        },
      },
    },
  });

  return paymentLink?.invoice ?? null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);
    const core = extractPaymobWebhookCore(payload);

    if (!core) {
      return apiError('Invalid Paymob payload', 400, 'VALIDATION_ERROR');
    }

    const invoice = await findInvoiceFromWebhookReference(core.invoiceReference);
    if (!invoice) {
      return apiError('Invoice not found for callback', 404, 'NOT_FOUND');
    }

    if (!verifyPaymobWebhookSignature(payload)) {
      return apiError('Invalid Paymob signature', 401, 'UNAUTHORIZED');
    }

    const existing = await prisma.paymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'paymob',
          providerEventId: core.providerEventId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return Response.json({ message: 'Duplicate callback ignored' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          invoiceId: invoice.id,
          userId: invoice.userId,
          provider: 'paymob',
          providerEventId: core.providerEventId,
          type: core.isSuccess ? 'payment_succeeded' : 'payment_failed',
          amount: toDecimal(core.amountCents / 100),
          currency: core.currency,
          rawPayload: payload,
        },
      });

      if (core.isSuccess) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'paid',
            paidAt: new Date(),
          },
        });

        await tx.paymentLink.updateMany({
          where: {
            invoiceId: invoice.id,
            userId: invoice.userId,
            provider: 'paymob',
            status: 'active',
          },
          data: {
            status: 'paid',
          },
        });

        await tx.reminderRun.updateMany({
          where: {
            invoiceId: invoice.id,
            userId: invoice.userId,
            status: { in: ['scheduled', 'sending', 'failed'] },
          },
          data: {
            status: 'suppressed',
            suppressionReason: `Suppressed after verified Paymob payment for ${invoice.invoiceNo}`,
          },
        });

        await tx.invoiceEvent.create({
          data: {
            invoiceId: invoice.id,
            userId: invoice.userId,
            type: 'payment_confirmed',
            message: formatInvoiceEventMessage(
              'payment_confirmed',
              `Verified Paymob payment received for ${invoice.invoiceNo}`
            ),
          },
        });
      } else {
        await tx.invoiceEvent.create({
          data: {
            invoiceId: invoice.id,
            userId: invoice.userId,
            type: 'payment_link_failed',
            message: `Paymob reported a failed payment for ${invoice.invoiceNo}`,
          },
        });
      }
    });

    return Response.json({ message: 'Paymob callback accepted' });
  } catch (error) {
    console.error('Paymob webhook error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
