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
import { formatInvoiceEventMessage } from '@/lib/invoice-events';
import { getDerivedOpenInvoiceStatus } from '@/lib/invoice-status';

interface UpdateInvoiceBody {
  amount?: unknown;
  dueDate?: unknown;
  status?: unknown;
  notes?: unknown;
  clientName?: unknown;
  phone?: unknown;
  email?: unknown;
}

/**
 * Handle PATCH requests to update an invoice and optionally its client, persist changes in a transaction, and record invoice events.
 *
 * Performs input validation, computes derived status and paidAt when applicable, updates client fields if provided, creates corresponding invoice events, reloads the refreshed invoice with its client and recent events, and returns the updated invoice.
 *
 * @returns A Response containing the refreshed invoice as JSON on success; returns an error response (e.g., 400, 401, 404, 500) with an error message and code on failure.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    const { id } = await params;
    const body = await readJsonBody<UpdateInvoiceBody>(request);

    if (!body || !isRecord(body)) {
      return apiError('Invalid JSON body', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        client: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!existing) {
      return apiError('Invoice not found', 404, 'NOT_FOUND');
    }

    const updateData: Prisma.InvoiceUpdateInput = {};

    if (body.amount !== undefined) {
      const amount = asPositiveNumber(body.amount);
      if (amount === null) {
        return apiError('Invalid amount', 400, 'VALIDATION_ERROR');
      }
      updateData.amount = amount;
    }

    if (body.dueDate !== undefined) {
      const dueDate = asDate(body.dueDate);
      if (!dueDate) {
        return apiError('Invalid dueDate', 400, 'VALIDATION_ERROR');
      }
      updateData.dueDate = dueDate;
      if (existing.status !== 'paid') {
        updateData.status = getDerivedOpenInvoiceStatus(dueDate);
        updateData.paidAt = null;
      }
    }

    if (body.status !== undefined) {
      if (!isInvoiceStatus(body.status)) {
        return apiError('Invalid status value', 400, 'VALIDATION_ERROR');
      }

      const nextDueDate =
        updateData.dueDate instanceof Date ? updateData.dueDate : existing.dueDate;
      const requestedStatus =
        body.status === 'paid' ? 'paid' : getDerivedOpenInvoiceStatus(nextDueDate);

      updateData.status = requestedStatus;
      if (requestedStatus === 'paid' && existing.status !== 'paid') {
        updateData.paidAt = new Date();
      } else if (requestedStatus !== 'paid') {
        updateData.paidAt = null;
      }
    }

    if (body.notes !== undefined) {
      const notes = asTrimmedString(body.notes);
      updateData.notes = notes;
    }

    const clientPatch: Prisma.ClientUpdateInput = {};
    if (body.clientName !== undefined) {
      const clientName = asTrimmedString(body.clientName);
      if (!clientName) {
        return apiError('Invalid clientName', 400, 'VALIDATION_ERROR');
      }
      clientPatch.name = clientName;
    }

    if (body.phone !== undefined) {
      const phone = asTrimmedString(body.phone);
      if (!phone) {
        return apiError('Invalid phone', 400, 'VALIDATION_ERROR');
      }
      clientPatch.phone = phone;
    }

    if (body.email !== undefined) {
      const email = asEmail(body.email);
      if (!email) {
        return apiError('Invalid email', 400, 'VALIDATION_ERROR');
      }
      clientPatch.email = email;
    }

    const hasInvoiceUpdates = Object.keys(updateData).length > 0;
    const hasClientUpdates = Object.keys(clientPatch).length > 0;

    if (!hasInvoiceUpdates && !hasClientUpdates) {
      return apiError('No valid update fields provided', 400, 'VALIDATION_ERROR');
    }

    const invoice = await prisma.$transaction(async (tx) => {
      if (hasClientUpdates) {
        await tx.client.update({
          where: { id: existing.clientId },
          data: clientPatch,
        });
      }

      const updatedInvoice = hasInvoiceUpdates
        ? await tx.invoice.update({
            where: { id },
            data: updateData,
          })
        : existing;

      if (hasInvoiceUpdates) {
        const changedFields = [
          body.amount !== undefined ? 'amount' : null,
          body.dueDate !== undefined ? 'due date' : null,
          body.notes !== undefined ? 'notes' : null,
          body.status !== undefined ? 'status' : null,
        ].filter(Boolean);

        await tx.invoiceEvent.create({
          data: {
            invoiceId: updatedInvoice.id,
            userId,
            type:
              updatedInvoice.status === 'paid' && existing.status !== 'paid'
                ? 'invoice_marked_paid'
                : 'invoice_details_updated',
            message: formatInvoiceEventMessage(
              updatedInvoice.status === 'paid' && existing.status !== 'paid'
                ? 'invoice_marked_paid'
                : 'invoice_details_updated',
              updatedInvoice.status === 'paid' && existing.status !== 'paid'
                ? `Invoice ${updatedInvoice.invoiceNo} marked as paid`
                : `Invoice ${updatedInvoice.invoiceNo} updated: ${changedFields.join(', ')}`
            ),
          },
        });
      }

      if (hasClientUpdates) {
        const clientFields = [
          body.clientName !== undefined ? 'name' : null,
          body.phone !== undefined ? 'phone' : null,
          body.email !== undefined ? 'email' : null,
        ].filter(Boolean);

        await tx.invoiceEvent.create({
          data: {
            invoiceId: updatedInvoice.id,
            userId,
            type: 'invoice_client_updated',
            message: formatInvoiceEventMessage(
              'invoice_client_updated',
              `Client details updated: ${clientFields.join(', ')}`
            ),
          },
        });
      }

      const refreshedInvoice = await tx.invoice.findFirst({
        where: { id, userId },
        include: {
          client: true,
          events: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!refreshedInvoice) {
        throw new Error('Updated invoice could not be reloaded');
      }

      return refreshedInvoice;
    });

    return Response.json(invoice);
  } catch (error) {
    console.error('Update invoice error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * Deletes the invoice identified by the route `id` for the authenticated user.
 *
 * @param params - Promise resolving to route parameters containing the invoice `id`
 * @returns `Response` with `{ message: 'Invoice deleted' }` on success; otherwise an error response with status `401` (unauthorized), `404` (not found), or `500` (internal server error)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    const { id } = await params;

    const existing = await prisma.invoice.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return apiError('Invoice not found', 404, 'NOT_FOUND');
    }

    await prisma.invoice.delete({ where: { id } });

    return Response.json({ message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
