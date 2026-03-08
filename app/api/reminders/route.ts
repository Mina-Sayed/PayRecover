import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
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

    const reminders = await prisma.reminderTemplate.findMany({
      where: { userId },
      orderBy: [{ channel: 'asc' }, { order: 'asc' }],
    });

    return Response.json(reminders);
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

    const channel = isReminderChannel(body.channel) ? body.channel : 'whatsapp';
    const timing = asTrimmedString(body.timing) || '3 Days Before Due';
    const template =
      asTrimmedString(body.template) ||
      'Hi {{client_name}}, you have an outstanding invoice of {{amount}}. Pay here: {{payment_link}}';
    const providerTemplateName = asOptionalTrimmedString(body.providerTemplateName);

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

    await Promise.all(
      updates.map((reminder) =>
        prisma.reminderTemplate.updateMany({
          where: { id: reminder.id, userId },
          data: {
            timing: reminder.timing,
            template: reminder.template,
            providerTemplateName: reminder.providerTemplateName,
            active: reminder.active,
            order: reminder.order,
          },
        })
      )
    );

    return Response.json({ message: 'Reminders updated' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('reminder')) {
      return apiError(error.message, 400, 'VALIDATION_ERROR');
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
