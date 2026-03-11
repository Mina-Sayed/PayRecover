import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { ensureInvoiceOperationalArtifacts } from '@/lib/recovery-loop';
import { toPaymentLinkSummary } from '@/lib/invoice-serialization';
import { getVerifiedPaymentConnection } from '@/lib/provider-connections';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const paymentConnection = await getVerifiedPaymentConnection(prisma, session.user.id);
    if (!paymentConnection) {
      return apiError('No verified Paymob connection found', 400, 'VALIDATION_ERROR');
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!invoice) {
      return apiError('Invoice not found', 404, 'NOT_FOUND');
    }

    if (invoice.status === 'paid') {
      return apiError('Cannot create a payment link for a paid invoice', 409, 'CONFLICT');
    }

    await ensureInvoiceOperationalArtifacts(prisma, id);

    const paymentLinks = await prisma.paymentLink.findMany({
      where: {
        invoiceId: id,
        userId: session.user.id,
        providerConnectionId: paymentConnection.record.id,
        isPrimary: true,
        status: { in: ['active', 'paid'] },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 1,
    });

    if (paymentLinks.length === 0) {
      return apiError('No active payment link is available for this invoice', 502, 'INTERNAL_ERROR');
    }

    return Response.json({
      paymentLink: toPaymentLinkSummary(paymentLinks),
    });
  } catch (error) {
    console.error('Create payment link error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
