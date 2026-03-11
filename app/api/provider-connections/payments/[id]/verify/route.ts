import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { ProviderConnectionStatus } from '@/lib/domain-enums';
import { decryptProviderConfig, toPaymentConnectionSummary, type PaymobConnectionConfig } from '@/lib/provider-connections';
import { syncOperationalArtifactsForUser } from '@/lib/recovery-loop';
import { verifyPaymobConnection } from '@/lib/paymob';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const record = await prisma.paymentProviderConnection.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!record) {
      return apiError('Payment connection not found', 404, 'NOT_FOUND');
    }

    const config = decryptProviderConfig<PaymobConnectionConfig>(record.encryptedConfig);
    const verification = await verifyPaymobConnection(config);

    const updated = await prisma.paymentProviderConnection.update({
      where: { id: record.id },
      data: {
        status: verification.ok ? ProviderConnectionStatus.verified : ProviderConnectionStatus.errored,
        verifiedAt: verification.ok ? new Date() : null,
        lastHealthcheckAt: new Date(),
        lastError: verification.error,
      },
    });

    let operationalSync = null;
    if (verification.ok) {
      try {
        operationalSync = await syncOperationalArtifactsForUser(prisma, session.user.id);
      } catch (error) {
        console.error('Payment connection operational sync error:', error);
      }
    }

    return Response.json({
      paymentConnection: toPaymentConnectionSummary(updated),
      operationalSync,
    });
  } catch (error) {
    console.error('Payment connection verify error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
