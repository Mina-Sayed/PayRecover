import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import { isRecord } from '@/lib/validators';

interface SettingsBody {
  businessName?: unknown;
  whatsappNumber?: unknown;
  name?: unknown;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
      },
    });

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return Response.json(user);
  } catch (error) {
    console.error('Settings read error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await readJsonBody<SettingsBody>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const normalizeNullableField = (value: unknown) => {
      if (value === undefined) return { provided: false as const, valid: true as const };
      if (typeof value !== 'string') return { provided: true as const, valid: false as const };
      const trimmed = value.trim();
      return {
        provided: true as const,
        valid: true as const,
        value: trimmed.length > 0 ? trimmed : null,
      };
    };

    const nameField = normalizeNullableField(body.name);
    const businessNameField = normalizeNullableField(body.businessName);
    const whatsappNumberField = normalizeNullableField(body.whatsappNumber);

    if (!nameField.valid || !businessNameField.valid || !whatsappNumberField.valid) {
      return apiError('Invalid settings payload', 400, 'VALIDATION_ERROR');
    }

    if (!nameField.provided && !businessNameField.provided && !whatsappNumberField.provided) {
      return apiError('No update fields provided', 400, 'VALIDATION_ERROR');
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(nameField.provided && { name: nameField.value }),
        ...(businessNameField.provided && { businessName: businessNameField.value }),
        ...(whatsappNumberField.provided && { whatsappNumber: whatsappNumberField.value }),
      },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
      },
    });

    return Response.json(user);
  } catch (error) {
    console.error('Settings update error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
