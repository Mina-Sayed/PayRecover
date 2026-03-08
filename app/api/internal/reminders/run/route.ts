import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { dispatchDueReminderRuns } from '@/lib/recovery-loop';
import { requireEnv } from '@/lib/env';

function isAuthorized(request: Request): boolean {
  const secret = requireEnv('CRON_SECRET');
  const headerSecret = request.headers.get('x-cron-secret');
  const bearerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  return headerSecret === secret || bearerSecret === secret;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const limitRaw = Number.parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;

    const processed = await dispatchDueReminderRuns(prisma, new Date(), limit);

    return Response.json({
      processedCount: processed.length,
      processed,
    });
  } catch (error) {
    console.error('Reminder run dispatch error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
