import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import { isDatabaseConnectivityError } from '@/lib/database-errors';
import { requireEnv } from '@/lib/env';
import { validatePasswordStrength } from '@/lib/password-policy';
import { callSupabaseRpc } from '@/lib/supabase-rpc';
import { asEmail, asTrimmedString, isRecord } from '@/lib/validators';

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

type TransactionClient = {
  user: Pick<typeof prisma.user, 'create'>;
  reminderTemplate: Pick<typeof prisma.reminderTemplate, 'createMany'>;
};

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

    const passwordValidationError = validatePasswordStrength(password);
    if (passwordValidationError) {
      return apiError(passwordValidationError, 400, 'VALIDATION_ERROR');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      const user = await prisma.$transaction(async (tx: TransactionClient) => {
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
              providerTemplateName: null,
              template:
                'Hi {{client_name}}, this is a gentle reminder that your invoice for {{amount}} is due on {{due_date}}. You can pay securely here: {{payment_link}}',
              order: 0,
            },
            {
              userId: createdUser.id,
              channel: 'whatsapp',
              timing: 'On Due Date',
              providerTemplateName: null,
              template:
                'Hi {{client_name}}, your invoice for {{amount}} is due today. Please complete your payment here: {{payment_link}}',
              order: 1,
            },
          ],
        });

        return createdUser;
      });

      return Response.json({ message: 'User created successfully', userId: user.id }, { status: 201 });
    } catch (error) {
      if (isDatabaseConnectivityError(error)) {
        try {
          const payload = await callSupabaseRpc<{ userId: string }>('app_register_user', {
            p_name: name,
            p_email: email,
            p_hashed_password: hashedPassword,
            p_secret: requireEnv('PROVIDER_CONFIG_SECRET'),
          });

          return Response.json(
            { message: 'User created successfully', userId: payload.userId },
            { status: 201 }
          );
        } catch (rpcError) {
          const message =
            rpcError instanceof Error ? rpcError.message.toLowerCase() : String(rpcError).toLowerCase();
          if (message.includes('email already in use')) {
            return apiError('Email already in use', 409, 'CONFLICT');
          }

          console.error('Registration fallback error:', rpcError);
          return apiError('Internal server error', 500, 'INTERNAL_ERROR');
        }
      }

      if (
        error &&
        typeof error === 'object' &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return apiError('Email already in use', 409, 'CONFLICT');
      }

      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
