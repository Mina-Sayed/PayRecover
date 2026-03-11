import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { extractPaymobWebhookCore, verifyPaymobWebhookSignature } from '@/lib/paymob';
import { amountToMinorUnits, toDecimal } from '@/lib/money';
import { formatInvoiceEventMessage } from '@/lib/invoice-events';
import { decryptProviderConfig, type PaymobConnectionConfig } from '@/lib/provider-connections';

interface PaymobCallbackInvoiceTarget {
  id: string;
  userId: string;
  invoiceNo: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  providerConnection: {
    id: string;
    encryptedConfig: string;
  } | null;
}

function isPaymobEventConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: string }).code === 'P2002';
}

async function findInvoiceByDirectReference(
  reference: string | null
): Promise<PaymobCallbackInvoiceTarget | null> {
  if (!reference) {
    return null;
  }

  const directInvoice = await prisma.invoice.findFirst({
    where: { id: reference },
    select: { id: true, userId: true, invoiceNo: true, amount: true, currency: true },
  });

  if (!directInvoice) {
    return null;
  }

  const paymentConnection = await prisma.paymentProviderConnection.findFirst({
    where: {
      userId: directInvoice.userId,
      provider: 'paymob',
    },
    select: {
      id: true,
      encryptedConfig: true,
    },
  });

  return {
    ...directInvoice,
    providerConnection: paymentConnection,
  };
}

async function findInvoiceFromProviderReference(
  reference: string | null,
  payload: unknown
): Promise<PaymobCallbackInvoiceTarget | null> {
  if (!reference) {
    return null;
  }

  const paymentLinks = await prisma.paymentLink.findMany({
    where: { providerRef: reference },
    select: {
      providerConnection: {
        select: {
          id: true,
          encryptedConfig: true,
        },
      },
      invoice: {
        select: {
          id: true,
          userId: true,
          invoiceNo: true,
          amount: true,
          currency: true,
        },
      },
    },
  });

  const verifiedMatches = paymentLinks
    .filter((paymentLink) => paymentLink.invoice && paymentLink.providerConnection)
    .filter((paymentLink) => {
      try {
        return verifyPaymobWebhookSignature(
          payload,
          decryptProviderConfig<PaymobConnectionConfig>(
            paymentLink.providerConnection!.encryptedConfig
          ).hmacSecret
        );
      } catch {
        return false;
      }
    });

  if (verifiedMatches.length > 1) {
    throw new Error('Ambiguous Paymob callback reference');
  }

  const match = verifiedMatches[0];
  return match?.invoice && match.providerConnection
    ? {
        ...match.invoice,
        providerConnection: match.providerConnection,
      }
    : null;
}

function hasMatchingSettlement(invoice: PaymobCallbackInvoiceTarget, amountCents: number, currency: string) {
  return (
    amountToMinorUnits(invoice.amount) === amountCents &&
    invoice.currency.trim().toUpperCase() === currency.trim().toUpperCase()
  );
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return apiError('Invalid Paymob payload', 400, 'VALIDATION_ERROR');
    }

    const core = extractPaymobWebhookCore(payload);

    if (!core) {
      return apiError('Invalid Paymob payload', 400, 'VALIDATION_ERROR');
    }

    const directInvoice = await findInvoiceByDirectReference(core.invoiceReference);
    let invoice: PaymobCallbackInvoiceTarget | null = null;

    if (directInvoice?.providerConnection?.encryptedConfig) {
      const directConnection = decryptProviderConfig<PaymobConnectionConfig>(
        directInvoice.providerConnection.encryptedConfig
      );
      if (verifyPaymobWebhookSignature(payload, directConnection.hmacSecret)) {
        invoice = directInvoice;
      } else {
        return apiError('Invalid Paymob signature', 401, 'UNAUTHORIZED');
      }
    }

    if (!invoice) {
      invoice = await findInvoiceFromProviderReference(core.invoiceReference, payload);
    }

    if (!invoice) {
      return apiError('Invoice not found for callback', 404, 'NOT_FOUND');
    }

    if (!invoice.providerConnection?.encryptedConfig) {
      return apiError('No Paymob connection found for callback', 400, 'VALIDATION_ERROR');
    }

    const connectionConfig = decryptProviderConfig<PaymobConnectionConfig>(
      invoice.providerConnection.encryptedConfig
    );
    const providerConnectionId = invoice.providerConnection.id;

    if (!verifyPaymobWebhookSignature(payload, connectionConfig.hmacSecret)) {
      return apiError('Invalid Paymob signature', 401, 'UNAUTHORIZED');
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (!core.isSuccess || !hasMatchingSettlement(invoice, core.amountCents, core.currency)) {
          await tx.paymentEvent.create({
            data: {
              invoiceId: invoice.id,
              userId: invoice.userId,
              provider: 'paymob',
              providerEventId: core.providerEventId,
              providerConnectionId,
              type: core.isSuccess ? 'callback_rejected' : 'payment_failed',
              amount: toDecimal(core.amountCents / 100),
              currency: core.currency,
              rawPayload: payload as Prisma.InputJsonValue,
            },
          });

          await tx.invoiceEvent.create({
            data: {
              invoiceId: invoice.id,
              userId: invoice.userId,
              type: core.isSuccess ? 'payment_callback_rejected' : 'payment_link_failed',
              message: core.isSuccess
                ? `Paymob callback rejected for ${invoice.invoiceNo} due to amount or currency mismatch`
                : `Paymob reported a failed payment for ${invoice.invoiceNo}`,
            },
          });

          return;
        }

        await tx.paymentEvent.create({
          data: {
            invoiceId: invoice.id,
            userId: invoice.userId,
            provider: 'paymob',
            providerEventId: core.providerEventId,
            providerConnectionId,
            type: 'payment_succeeded',
            amount: toDecimal(core.amountCents / 100),
            currency: core.currency,
            rawPayload: payload as Prisma.InputJsonValue,
          },
        });

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
            providerConnectionId,
            isPrimary: true,
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
      });
    } catch (error) {
      if (isPaymobEventConflict(error)) {
        return Response.json({ message: 'Duplicate callback ignored' });
      }

      throw error;
    }

    if (core.isSuccess && !hasMatchingSettlement(invoice, core.amountCents, core.currency)) {
      return apiError('Paymob payment does not match invoice amount or currency', 409, 'CONFLICT');
    }

    return Response.json({
      message: core.isSuccess ? 'Paymob callback accepted' : 'Paymob failure callback accepted',
    });
  } catch (error) {
    console.error('Paymob webhook error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
