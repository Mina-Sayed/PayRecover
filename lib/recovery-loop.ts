import { Prisma, type PrismaClient } from '@prisma/client';
import { createPaymobPaymentLink, isPaymobConfigured } from '@/lib/paymob';
import { shouldMaterializeReminderRun, getReminderScheduledFor, renderReminderTemplate } from '@/lib/reminder-timing';
import { amountToMinorUnits, formatCurrencyAmount, toDecimal } from '@/lib/money';
import { sendWatiTemplateMessage, isWatiConfigured } from '@/lib/wati';

type PrismaLike = PrismaClient;

interface InvoiceCore {
  id: string;
  invoiceNo: string;
  userId: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  dueDate: Date;
  status: string;
  createdAt: Date;
  client: {
    name: string;
    email: string | null;
    phone: string;
  };
}

interface ReminderTemplateRecord {
  id: string;
  userId: string;
  channel: string;
  timing: string;
  template: string;
  providerTemplateName: string | null;
  active: boolean;
}

interface ReminderDispatchSelection {
  id: string;
  userId: string;
  channel: string;
  timingLabel: string;
  templateSnapshot: string;
  providerMessageId: string | null;
  invoice: InvoiceCore & {
    paymentLinks: Array<{
      url: string;
      status: string;
      provider: string;
    }>;
  };
  template: {
    providerTemplateName: string | null;
  } | null;
  attempts: Array<{ attemptNo: number }>;
}

function buildBaseUrl(): string {
  return process.env.AUTH_URL || 'http://localhost:3000';
}

function redirectPathForInvoice(invoiceId: string): string {
  return `${buildBaseUrl()}/dashboard/invoices?invoice=${encodeURIComponent(invoiceId)}`;
}

function callbackPath(pathname: string): string {
  return `${buildBaseUrl()}${pathname}`;
}

export async function refreshInvoicePaymentLink(
  prisma: PrismaLike,
  invoice: InvoiceCore,
  businessName: string
) {
  if (!isPaymobConfigured()) {
    return null;
  }

  await prisma.paymentLink.updateMany({
    where: {
      invoiceId: invoice.id,
      provider: 'paymob',
      status: 'active',
    },
    data: {
      status: 'expired',
    },
  });

  const created = await createPaymobPaymentLink({
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    amountCents: amountToMinorUnits(invoice.amount),
    currency: invoice.currency,
    clientName: invoice.client.name,
    clientEmail: invoice.client.email,
    clientPhone: invoice.client.phone,
    businessName,
    callbackUrl: callbackPath('/api/webhooks/paymob'),
    redirectUrl: redirectPathForInvoice(invoice.id),
  });

  const paymentLink = await prisma.paymentLink.create({
    data: {
      invoiceId: invoice.id,
      userId: invoice.userId,
      provider: 'paymob',
      providerRef: created.providerRef,
      url: created.url,
      status: 'active',
      expiresAt: created.expiresAt,
      rawPayload: created.rawPayload as Prisma.InputJsonValue,
    },
  });

  await prisma.invoiceEvent.create({
    data: {
      invoiceId: invoice.id,
      userId: invoice.userId,
      type: 'payment_link_created',
      message: `Payment link created for invoice ${invoice.invoiceNo}`,
    },
  });

  return paymentLink;
}

export async function syncReminderRunsForInvoice(prisma: PrismaLike, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId },
    include: {
      client: true,
      paymentLinks: {
        where: { provider: 'paymob', status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!invoice || invoice.status === 'paid' || invoice.paymentLinks.length === 0) {
    return [];
  }

  const templates = await prisma.reminderTemplate.findMany({
    where: {
      userId: invoice.userId,
      channel: 'whatsapp',
      active: true,
    },
    orderBy: { order: 'asc' },
  });

  const createdRuns = [] as string[];

  for (const template of templates) {
    if (!shouldMaterializeReminderRun(invoice.dueDate, invoice.createdAt, template.timing)) {
      continue;
    }

    const scheduledFor = getReminderScheduledFor(invoice.dueDate, template.timing);
    if (!scheduledFor) {
      continue;
    }

    const existing = await prisma.reminderRun.findFirst({
      where: {
        invoiceId: invoice.id,
        timingLabel: template.timing,
        scheduledFor,
        channel: 'whatsapp',
      },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    const run = await prisma.reminderRun.create({
      data: {
        invoiceId: invoice.id,
        templateId: template.id,
        userId: invoice.userId,
        channel: 'whatsapp',
        timingLabel: template.timing,
        templateSnapshot: template.template,
        scheduledFor,
      },
      select: { id: true },
    });

    createdRuns.push(run.id);
  }

  return createdRuns;
}

export async function ensureInvoiceOperationalArtifacts(
  prisma: PrismaLike,
  invoiceId: string
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId },
    include: {
      client: true,
    },
  });

  if (!invoice) {
    return null;
  }

  const owner = await prisma.user.findUnique({
    where: { id: invoice.userId },
    select: { businessName: true },
  });

  let paymentLink = null;
  try {
    paymentLink = await refreshInvoicePaymentLink(
      prisma,
      {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        userId: invoice.userId,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        status: invoice.status,
        createdAt: invoice.createdAt,
        client: invoice.client,
      },
      owner?.businessName || 'PayRecover'
    );
  } catch (error) {
    await prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice.id,
        userId: invoice.userId,
        type: 'payment_link_failed',
        message:
          error instanceof Error
            ? `Payment link creation failed: ${error.message}`
            : 'Payment link creation failed',
      },
    });
  }

  if (paymentLink) {
    await syncReminderRunsForInvoice(prisma, invoice.id);
  }

  return paymentLink;
}

export async function suppressReminderRunsForInvoice(
  prisma: PrismaLike,
  invoiceId: string,
  userId: string,
  reason: string
) {
  await prisma.reminderRun.updateMany({
    where: {
      invoiceId,
      userId,
      status: { in: ['scheduled', 'sending', 'failed'] },
    },
    data: {
      status: 'suppressed',
      suppressionReason: reason,
    },
  });

  await prisma.invoiceEvent.create({
    data: {
      invoiceId,
      userId,
      type: 'reminders_suppressed',
      message: reason,
    },
  });
}

function buildReminderTemplateParameters(selection: ReminderDispatchSelection): string[] {
  const paymentLink = selection.invoice.paymentLinks[0];
  return [
    selection.invoice.client.name,
    formatCurrencyAmount(selection.invoice.amount),
    selection.invoice.dueDate.toISOString().slice(0, 10),
    paymentLink?.url || '',
  ];
}

function buildReminderMessage(selection: ReminderDispatchSelection): string {
  const paymentLink = selection.invoice.paymentLinks[0];
  return renderReminderTemplate(selection.templateSnapshot, {
    client_name: selection.invoice.client.name,
    amount: formatCurrencyAmount(selection.invoice.amount),
    due_date: selection.invoice.dueDate.toISOString().slice(0, 10),
    payment_link: paymentLink?.url || '',
  });
}

export async function dispatchDueReminderRuns(
  prisma: PrismaLike,
  now = new Date(),
  limit = 20
) {
  const dueRuns = await prisma.reminderRun.findMany({
    where: {
      status: 'scheduled',
      channel: 'whatsapp',
      scheduledFor: { lte: now },
      invoice: { status: { not: 'paid' } },
    },
    include: {
      invoice: {
        include: {
          client: true,
          paymentLinks: {
            where: { provider: 'paymob', status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      template: {
        select: { providerTemplateName: true },
      },
      attempts: {
        select: { attemptNo: true },
        orderBy: { attemptNo: 'desc' },
        take: 1,
      },
    },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
  });

  const processed = [] as Array<{ id: string; status: string }>;

  for (const run of dueRuns) {
    const claimed = await prisma.reminderRun.updateMany({
      where: { id: run.id, status: 'scheduled' },
      data: { status: 'sending' },
    });

    if (claimed.count === 0) {
      continue;
    }

    const attemptNo = (run.attempts[0]?.attemptNo ?? 0) + 1;
    await prisma.deliveryAttempt.create({
      data: {
        reminderRunId: run.id,
        attemptNo,
        status: 'started',
      },
    });

    if (!isWatiConfigured()) {
      await prisma.reminderRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          lastError: 'WATI is not configured',
        },
      });
      processed.push({ id: run.id, status: 'failed' });
      continue;
    }

    if (!run.template?.providerTemplateName) {
      await prisma.reminderRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          lastError: 'Missing WATI template name',
        },
      });
      await prisma.deliveryAttempt.update({
        where: {
          reminderRunId_attemptNo: {
            reminderRunId: run.id,
            attemptNo,
          },
        },
        data: {
          status: 'failed',
          errorMessage: 'Missing WATI template name',
        },
      });
      processed.push({ id: run.id, status: 'failed' });
      continue;
    }

    try {
      const response = await sendWatiTemplateMessage({
        phone: run.invoice.client.phone,
        templateName: run.template.providerTemplateName,
        broadcastName: `payrecover-${run.invoice.invoiceNo}-${run.id}`,
        parameters: buildReminderTemplateParameters(run as ReminderDispatchSelection),
      });

      await prisma.deliveryAttempt.update({
        where: {
          reminderRunId_attemptNo: {
            reminderRunId: run.id,
            attemptNo,
          },
        },
        data: {
          status: 'succeeded',
          providerResponse: response.rawPayload as Prisma.InputJsonValue,
        },
      });

      await prisma.reminderRun.update({
        where: { id: run.id },
        data: {
          status: 'sent',
          sentAt: now,
          providerMessageId: response.providerMessageId,
          lastError: null,
        },
      });

      await prisma.invoiceEvent.create({
        data: {
          invoiceId: run.invoiceId,
          userId: run.userId,
          type: 'reminder_sent',
          message: `WhatsApp reminder sent: ${buildReminderMessage(run as ReminderDispatchSelection)}`,
        },
      });

      processed.push({ id: run.id, status: 'sent' });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown WATI delivery error';

      await prisma.deliveryAttempt.update({
        where: {
          reminderRunId_attemptNo: {
            reminderRunId: run.id,
            attemptNo,
          },
        },
        data: {
          status: 'failed',
          errorMessage,
        },
      });

      await prisma.reminderRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          lastError: errorMessage,
        },
      });

      await prisma.invoiceEvent.create({
        data: {
          invoiceId: run.invoiceId,
          userId: run.userId,
          type: 'reminder_failed',
          message: `WhatsApp reminder failed: ${errorMessage}`,
        },
      });

      processed.push({ id: run.id, status: 'failed' });
    }
  }

  return processed;
}
