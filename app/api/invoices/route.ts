import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, readJsonBody } from '@/lib/api-response';
import {
  asDate,
  asEmail,
  asPositiveNumber,
  asTrimmedString,
  isInvoiceStatus,
  isRecord,
} from '@/lib/validators';
import { getNextInvoiceNumber, isInvoiceNumberConflict } from '@/lib/invoice-sequence';
import { formatInvoiceEventMessage } from '@/lib/invoice-events';
import { getDerivedOpenInvoiceStatus, syncOpenInvoiceStatuses } from '@/lib/invoice-status';
import { clampInvoiceListPage, getInvoiceListTotalPages } from '@/lib/invoice-list-state';

interface CreateInvoiceBody {
  clientName?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  amount?: unknown;
  dueDate?: unknown;
}

const ALLOWED_STATUSES = new Set(['all', 'pending', 'overdue', 'paid']);
const MAX_INVOICE_NUMBER_ATTEMPTS = 5;

interface CreateInvoiceInput {
  userId: string;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  amount: number;
  dueDate: Date;
}

interface InvoiceMutationClient {
  client: {
    findFirst: typeof prisma.client.findFirst;
    create: typeof prisma.client.create;
    update: typeof prisma.client.update;
  };
  invoice: {
    findMany: typeof prisma.invoice.findMany;
    findFirst: typeof prisma.invoice.findFirst;
    create: typeof prisma.invoice.create;
    update: typeof prisma.invoice.update;
  };
  invoiceEvent: {
    create: typeof prisma.invoiceEvent.create;
  };
}

async function createInvoiceWithClientAndEvent({
  userId,
  clientName,
  phone,
  email,
  address,
  amount,
  dueDate,
}: CreateInvoiceInput) {
  const status = getDerivedOpenInvoiceStatus(dueDate);

  for (let attempt = 1; attempt <= MAX_INVOICE_NUMBER_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        let client = await tx.client.findFirst({
          where: { userId, phone },
        });

        if (!client) {
          client = await tx.client.create({
            data: {
              userId,
              name: clientName,
              phone,
              email,
              address,
            },
          });
        } else {
          client = await tx.client.update({
            where: { id: client.id },
            data: {
              name: clientName,
              email,
              address,
            },
          });
        }

        const existingInvoiceNos = await tx.invoice.findMany({
          where: { userId },
          select: { invoiceNo: true },
        });
        const invoiceNo = getNextInvoiceNumber(
          existingInvoiceNos.map((invoice) => invoice.invoiceNo)
        );

        const invoice = await tx.invoice.create({
          data: {
            invoiceNo,
            clientId: client.id,
            userId,
            amount,
            dueDate,
            status,
          },
        });

        await tx.invoiceEvent.create({
          data: {
            invoiceId: invoice.id,
            userId,
            type: 'invoice_created',
            message: formatInvoiceEventMessage(
              'invoice_created',
              `Invoice ${invoice.invoiceNo} created for ${client.name}`
            ),
          },
        });

        const createdInvoice = await tx.invoice.findFirst({
          where: { id: invoice.id, userId },
          include: {
            client: true,
            events: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        });

        if (!createdInvoice) {
          throw new Error('Created invoice could not be reloaded');
        }

        return createdInvoice;
      });
    } catch (error) {
      if (isInvoiceNumberConflict(error) && attempt < MAX_INVOICE_NUMBER_ATTEMPTS) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to allocate a unique invoice number');
}

async function updateInvoiceStatusWithEvent(
  tx: InvoiceMutationClient,
  args: {
    id: string;
    userId: string;
    currentStatus: 'pending' | 'overdue' | 'paid';
    dueDate: Date;
    requestedStatus: 'pending' | 'overdue' | 'paid';
  }
) {
  const effectiveStatus =
    args.requestedStatus === 'paid' ? 'paid' : getDerivedOpenInvoiceStatus(args.dueDate);

  const updated = await tx.invoice.update({
    where: { id: args.id },
    data: {
      status: effectiveStatus,
      paidAt: effectiveStatus === 'paid' ? new Date() : null,
    },
  });

  if (effectiveStatus !== args.currentStatus) {
    await tx.invoiceEvent.create({
      data: {
        invoiceId: updated.id,
        userId: args.userId,
        type: effectiveStatus === 'paid' ? 'invoice_marked_paid' : 'invoice_status_recalculated',
        message: formatInvoiceEventMessage(
          effectiveStatus === 'paid' ? 'invoice_marked_paid' : 'invoice_status_recalculated',
          effectiveStatus === 'paid'
            ? `Invoice ${updated.invoiceNo} marked as paid`
            : `Invoice ${updated.invoiceNo} status recalculated to ${effectiveStatus}`
        ),
      },
    });
  }

  return tx.invoice.findFirst({
    where: { id: args.id, userId: args.userId },
    include: {
      client: true,
      events: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    await syncOpenInvoiceStatuses(prisma, userId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').trim();

    if (!ALLOWED_STATUSES.has(status)) {
      return apiError('Invalid status filter', 400, 'VALIDATION_ERROR');
    }

    const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10);
    const limitRaw = Number.parseInt(searchParams.get('limit') || '10', 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;

    const where: Prisma.InvoiceWhereInput = { userId };

    if (status !== 'all') {
      where.status = status;
    }

    if (search) {
      const searchFilters: Prisma.InvoiceWhereInput[] = [
        { client: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { client: { is: { email: { contains: search, mode: 'insensitive' } } } },
      ];

      where.OR = searchFilters;
    }

    const total = await prisma.invoice.count({ where });
    const totalPages = getInvoiceListTotalPages(total, limit);
    const effectivePage = clampInvoiceListPage(page, totalPages);
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (effectivePage - 1) * limit,
      take: limit,
    });

    return Response.json({
      invoices,
      total,
      page: effectivePage,
      totalPages,
    });
  } catch (error) {
    console.error('Invoices list error:', error);
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

    const body = await readJsonBody<CreateInvoiceBody>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const clientName = asTrimmedString(body.clientName);
    const phone = asTrimmedString(body.phone);
    const email = asEmail(body.email);
    const address = asTrimmedString(body.address) || '';
    const amount = asPositiveNumber(body.amount);
    const dueDate = asDate(body.dueDate);

    if (!clientName || !phone || !email || amount === null || !dueDate) {
      return apiError('Missing or invalid required fields', 400, 'VALIDATION_ERROR');
    }

    const invoice = await createInvoiceWithClientAndEvent({
      userId,
      clientName,
      phone,
      email,
      address,
      amount,
      dueDate,
    });

    return Response.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await readJsonBody<{ id?: unknown; status?: unknown }>(request);
    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const id = asTrimmedString(body.id);
    if (!id) {
      return apiError('Invoice ID is required', 400, 'VALIDATION_ERROR');
    }

    if (!isInvoiceStatus(body.status)) {
      return apiError('Invalid status value', 400, 'VALIDATION_ERROR');
    }
    const requestedStatus = body.status;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true, dueDate: true },
    });

    if (!invoice) {
      return apiError('Invoice not found', 404, 'NOT_FOUND');
    }

    if (!isInvoiceStatus(invoice.status)) {
      console.error('Invoice has unsupported status value', {
        invoiceId: invoice.id,
        status: invoice.status,
      });
      return apiError('Internal server error', 500, 'INTERNAL_ERROR');
    }
    const currentStatus = invoice.status;

    const updated = await prisma.$transaction((tx) =>
      updateInvoiceStatusWithEvent(tx, {
        id,
        userId: session.user.id,
        currentStatus,
        dueDate: invoice.dueDate,
        requestedStatus,
      })
    );

    return Response.json(updated);
  } catch (error) {
    console.error('Bulk invoice patch error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
