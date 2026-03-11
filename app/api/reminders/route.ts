import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import { isDatabaseConnectivityError } from '@/lib/database-errors';
import { requireEnv } from '@/lib/env';
import { callSupabaseRpc, ensureFallbackUserProfile } from '@/lib/supabase-rpc';
import {
  asOptionalTrimmedString,
  asTrimmedString,
  isRecord,
  isReminderChannel,
} from '@/lib/validators';

interface ReminderInput {
  id?: unknown;
  channel?: unknown;
  timing?: unknown;
  template?: unknown;
  providerTemplateName?: unknown;
  active?: unknown;
  order?: unknown;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    try {
      const reminders = await prisma.reminderTemplate.findMany({
        where: { userId, channel: 'whatsapp' },
        orderBy: [{ channel: 'asc' }, { order: 'asc' }],
      });

      return Response.json(reminders);
    } catch (error) {
      if (isDatabaseConnectivityError(error)) {
        const reminders = await callSupabaseRpc<unknown[]>('app_get_reminders', {
          p_user_id: userId,
          p_secret: requireEnv('PROVIDER_CONFIG_SECRET'),
        });

        return Response.json(reminders);
      }

      throw error;
    }
  } catch (error) {
    console.error('Reminders list error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    const body = await readJsonBody<ReminderInput>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    if (body.channel !== undefined && !isReminderChannel(body.channel)) {
      return apiError('Unsupported reminder channel', 400, 'VALIDATION_ERROR');
    }

    const channel = 'whatsapp';
    const timing = asTrimmedString(body.timing) || '3 Days Before Due';
    const template =
      asTrimmedString(body.template) ||
      'Hi {{client_name}}, you have an outstanding invoice of {{amount}}. Pay here: {{payment_link}}';
    const providerTemplateName = asOptionalTrimmedString(body.providerTemplateName);

    try {
      const lastReminder = await prisma.reminderTemplate.findFirst({
        where: { userId, channel },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const reminder = await prisma.reminderTemplate.create({
        data: {
          userId,
          channel,
          timing,
          template,
          providerTemplateName,
          order: (lastReminder?.order ?? -1) + 1,
        },
      });

      return Response.json(reminder, { status: 201 });
    } catch (error) {
      if (isDatabaseConnectivityError(error)) {
        const secret = requireEnv('PROVIDER_CONFIG_SECRET');
        await ensureFallbackUserProfile(
          {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
          },
          secret
        );

        const reminder = await callSupabaseRpc<unknown>('app_create_reminder', {
          p_user_id: userId,
          p_timing: timing,
          p_template: template,
          p_provider_template_name: providerTemplateName,
          p_secret: secret,
        });

        return Response.json(reminder, { status: 201 });
      }

      throw error;
    }
  } catch (error) {
    console.error('Create reminder error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    const body = await readJsonBody<{ reminders?: unknown }>(request);
    if (!body || !isRecord(body) || !Array.isArray(body.reminders)) {
      return apiError('Invalid reminders payload', 400, 'VALIDATION_ERROR');
    }

    const updates = body.reminders.map((rawReminder, index) => {
      if (!isRecord(rawReminder)) {
        throw new Error('Invalid reminder object');
      }

      const id = asTrimmedString(rawReminder.id);
      const timing = asTrimmedString(rawReminder.timing);
      const template = asTrimmedString(rawReminder.template);
      const providerTemplateName = asOptionalTrimmedString(rawReminder.providerTemplateName);
      const active = typeof rawReminder.active === 'boolean' ? rawReminder.active : true;
      const order = Number.isFinite(Number(rawReminder.order))
        ? Number(rawReminder.order)
        : index;

      if (!id || !timing || !template) {
        throw new Error('Missing required reminder fields');
      }

      return { id, timing, template, providerTemplateName, active, order };
    });

    await prisma.$transaction(async (tx) => {
      for (const reminder of updates) {
        const result = await tx.reminderTemplate.updateMany({
          where: { id: reminder.id, userId },
          data: {
            timing: reminder.timing,
            template: reminder.template,
            providerTemplateName: reminder.providerTemplateName,
            active: reminder.active,
            order: reminder.order,
          },
        });

        if (result.count !== 1) {
          throw new Error(`Reminder not found or not owned by user: ${reminder.id}`);
        }
      }
    });

    return Response.json({ message: 'Reminders updated' });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('reminder')) {
      const status = error.message.includes('not found') ? 404 : 400;
      const code = status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR';
      return apiError(error.message, status, code);
    }

    console.error('Update reminders error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const id = asTrimmedString(searchParams.get('id'));

    if (!id) {
      return apiError('Missing reminder ID', 400, 'VALIDATION_ERROR');
    }

    await prisma.reminderTemplate.deleteMany({
      where: { id, userId },
    });

    return Response.json({ message: 'Reminder deleted' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
