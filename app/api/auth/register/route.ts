import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import { asEmail, asTrimmedString, isRecord } from '@/lib/validators';

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<RegisterBody>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const name = asTrimmedString(body.name);
    const email = asEmail(body.email);
    const password = asTrimmedString(body.password);

    if (!name || !email || !password) {
      return apiError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 6) {
      return apiError('Password must be at least 6 characters', 400, 'VALIDATION_ERROR');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return apiError('Email already in use', 409, 'CONFLICT');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          hashedPassword,
          businessName: name,
        },
      });

      await tx.reminderTemplate.createMany({
        data: [
          {
            userId: createdUser.id,
            channel: 'whatsapp',
            timing: '3 Days Before Due',
            template:
              'Hi {{client_name}}, this is a gentle reminder that your invoice for {{amount}} is due on {{due_date}}. You can pay securely here: {{payment_link}}',
            order: 0,
          },
          {
            userId: createdUser.id,
            channel: 'whatsapp',
            timing: 'On Due Date',
            template:
              'Hi {{client_name}}, your invoice for {{amount}} is due today. Please complete your payment here: {{payment_link}}',
            order: 1,
          },
          {
            userId: createdUser.id,
            channel: 'sms',
            timing: '1 Day Overdue',
            template:
              'Reminder: Your payment of {{amount}} is overdue. Pay now: {{payment_link}}',
            order: 0,
          },
          {
            userId: createdUser.id,
            channel: 'sms',
            timing: '7 Days Overdue',
            template:
              'URGENT: Your invoice of {{amount}} is 7 days overdue. Please pay immediately to avoid service interruption: {{payment_link}}',
            order: 1,
          },
        ],
      });

      return createdUser;
    });

    return Response.json({ message: 'User created successfully', userId: user.id }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
