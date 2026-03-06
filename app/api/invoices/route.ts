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

/**
 * Creates or updates a client, allocates a unique invoice number, creates the invoice and an initial `invoice_created` event, and returns the created invoice with its client and recent events.
 *
 * @param userId - ID of the user who owns the invoice
 * @param clientName - Client's display name
 * @param phone - Client's phone number used to look up or match an existing client
 * @param email - Client's email address
 * @param address - Client's postal address (may be empty)
 * @param amount - Invoice amount in the application's smallest currency unit
 * @param dueDate - Invoice due date (ISO date string or Date)
 * @returns The created invoice record including its `client` relation and the most recent five `events`
 * @throws Error when the created invoice cannot be reloaded after creation
 * @throws Error when a unique invoice number cannot be allocated after multiple attempts
 */
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

/**
 * Update an invoice's status, record a corresponding invoice event when the status changes, and return the refreshed invoice with its client and recent events.
 *
 * Updates the invoice's `status` and sets `paidAt` to the current time when marked `paid`. If the effective status differs from `currentStatus`, creates an `invoiceEvent` of type `invoice_marked_paid` or `invoice_status_recalculated` with a formatted message.
 *
 * @returns The updated invoice including its `client` relation and the most recent five `events`, or `null` if no matching invoice is found.
 */
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

/**
 * Lists invoices for the authenticated user, supporting status filtering, search, and pagination.
 *
 * Synchronizes open invoice statuses for the user before querying. Reads query parameters from the
 * request URL: `status` (one of allowed filters or `all`), `search` (searches client name, invoiceNo,
 * and client email), `page`, and `limit` (maximum 50). Returns a paginated list of invoices including
 * each invoice's client and up to the latest 5 events.
 *
 * @param request - The incoming HTTP Request whose URL query parameters control filtering and pagination.
 * @returns A Response containing a JSON object with `invoices` (array), `total` (number of matched invoices),
 * `page` (current page), and `totalPages` (number of pages), or an error response with an appropriate HTTP status.
 */
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

/**
 * Creates a new invoice (creating or updating the client as needed) from the JSON request body and returns the created invoice.
 *
 * @param request - HTTP Request whose JSON body must include `clientName`, `phone`, `email`, `amount`, and `dueDate`; `address` is optional
 * @returns The created invoice record including its client and recent invoice events; returned with HTTP 201 on success
 */
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

/**
 * HTTP PATCH handler that updates an invoice's status and records the corresponding invoice event.
 *
 * Validates the authenticated session and request body (expects `id` and `status`), updates the invoice status within a transaction (creating an event when the status changes), and returns the updated invoice with its client and recent events.
 *
 * @param request - The incoming Request whose JSON body must contain `id` (invoice id) and `status` (new invoice status).
 * @returns A Response containing the updated invoice (including its client and recent events) on success; otherwise an error response with an appropriate HTTP status and error code.
 */
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
