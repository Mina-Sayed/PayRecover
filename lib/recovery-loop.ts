import { Prisma, type PrismaClient } from '@prisma/client';
import { createPaymobPaymentLink } from '@/lib/paymob';
import { shouldMaterializeReminderRun, getReminderScheduledFor, renderReminderTemplate } from '@/lib/reminder-timing';
import { amountToMinorUnits, formatCurrencyAmount, toDecimal } from '@/lib/money';
import { sendWatiTemplateMessage } from '@/lib/wati';
import {
  decryptProviderConfig,
  getVerifiedMessagingConnection,
  getVerifiedPaymentConnection,
  type WatiConnectionConfig,
} from '@/lib/provider-connections';

type PrismaLike = PrismaClient;

const MAX_REMINDER_DELIVERY_ATTEMPTS = 3;
const REMINDER_RETRY_DELAY_MINUTES = 15;

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
  messagingConnection: {
    encryptedConfig: string;
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
  const paymentConnection = await getVerifiedPaymentConnection(prisma, invoice.userId);
  if (!paymentConnection) {
    return null;
  }

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
  }, paymentConnection.config);

  const paymentLink = await prisma.$transaction(async (tx) => {
    await tx.paymentLink.updateMany({
      where: {
        invoiceId: invoice.id,
        providerConnectionId: paymentConnection.record.id,
        status: 'active',
        isPrimary: true,
      },
      data: {
        status: 'expired',
        isPrimary: false,
      },
    });

    const createdPaymentLink = await tx.paymentLink.create({
      data: {
        invoiceId: invoice.id,
        userId: invoice.userId,
        provider: 'paymob',
        providerRef: created.providerRef,
        providerConnectionId: paymentConnection.record.id,
        url: created.url,
        status: 'active',
        isPrimary: true,
        expiresAt: created.expiresAt,
        rawPayload: created.rawPayload as Prisma.InputJsonValue,
      },
    });

    await tx.invoiceEvent.create({
      data: {
        invoiceId: invoice.id,
        userId: invoice.userId,
        type: 'payment_link_created',
        message: `Payment link created for invoice ${invoice.invoiceNo}`,
      },
    });

    return createdPaymentLink;
  });

  return paymentLink;
}

function isReminderRunConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; meta?: { target?: unknown } };
  if (candidate.code !== 'P2002') {
    return false;
  }

  const target = candidate.meta?.target;
  if (!target) {
    return false;
  }

  if (Array.isArray(target)) {
    return target.includes('scheduledFor') && target.includes('timingLabel');
  }

  return typeof target === 'string' && target.includes('ReminderRun');
}

export async function syncReminderRunsForInvoice(prisma: PrismaLike, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId },
    include: {
      client: true,
      paymentLinks: {
        where: { isPrimary: true, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!invoice || invoice.status === 'paid' || invoice.paymentLinks.length === 0) {
    return [];
  }

  const messagingConnection = await getVerifiedMessagingConnection(prisma, invoice.userId);
  if (!messagingConnection) {
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

    try {
      const run = await prisma.reminderRun.create({
        data: {
          invoiceId: invoice.id,
          templateId: template.id,
          userId: invoice.userId,
          channel: 'whatsapp',
          messagingConnectionId: messagingConnection.record.id,
          timingLabel: template.timing,
          templateSnapshot: template.template,
          scheduledFor,
        },
        select: { id: true },
      });

      createdRuns.push(run.id);
    } catch (error) {
      if (!isReminderRunConflict(error)) {
        throw error;
      }
    }
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

  if (invoice.status === 'paid') {
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

interface OperationalBackfillResult {
  invoicesScanned: number;
  paymentLinksCreated: number;
  reminderRunsCreated: number;
}

export async function syncOperationalArtifactsForUser(
  prisma: PrismaLike,
  userId: string
): Promise<OperationalBackfillResult> {
  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: { in: ['pending', 'overdue'] },
    },
    include: {
      client: true,
      paymentLinks: {
        where: { isPrimary: true, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (invoices.length === 0) {
    return {
      invoicesScanned: 0,
      paymentLinksCreated: 0,
      reminderRunsCreated: 0,
    };
  }

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessName: true },
  });

  const businessName = owner?.businessName || 'PayRecover';
  const paymentConnection = await getVerifiedPaymentConnection(prisma, userId);
  const messagingConnection = await getVerifiedMessagingConnection(prisma, userId);

  let paymentLinksCreated = 0;
  let reminderRunsCreated = 0;

  for (const invoice of invoices) {
    let hasActivePrimaryPaymentLink = invoice.paymentLinks.length > 0;

    if (!hasActivePrimaryPaymentLink && paymentConnection) {
      try {
        const paymentLink = await refreshInvoicePaymentLink(
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
          businessName
        );

        if (paymentLink) {
          paymentLinksCreated += 1;
          hasActivePrimaryPaymentLink = true;
        }
      } catch (error) {
        console.error('Operational backfill payment-link error:', {
          invoiceId: invoice.id,
          userId,
          error,
        });
      }
    }

    if (messagingConnection && hasActivePrimaryPaymentLink) {
      try {
        const createdRuns = await syncReminderRunsForInvoice(prisma, invoice.id);
        reminderRunsCreated += createdRuns.length;
      } catch (error) {
        console.error('Operational backfill reminder-run error:', {
          invoiceId: invoice.id,
          userId,
          error,
        });
      }
    }
  }

  return {
    invoicesScanned: invoices.length,
    paymentLinksCreated,
    reminderRunsCreated,
  };
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

function getNextReminderRetryDate(now: Date): Date {
  return new Date(now.getTime() + REMINDER_RETRY_DELAY_MINUTES * 60 * 1000);
}

async function failReminderRunAttempt(
  prisma: PrismaLike,
  runId: string,
  attemptNo: number,
  errorMessage: string
) {
  await prisma.deliveryAttempt.update({
    where: {
      reminderRunId_attemptNo: {
        reminderRunId: runId,
        attemptNo,
      },
    },
    data: {
      status: 'failed',
      errorMessage,
    },
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
      invoice: {
        status: { not: 'paid' },
        paymentLinks: {
          some: {
            isPrimary: true,
            status: 'active',
          },
        },
      },
    },
    include: {
      invoice: {
        include: {
          client: true,
          paymentLinks: {
            where: { isPrimary: true, status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      messagingConnection: true,
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

    if (!run.messagingConnection?.encryptedConfig) {
      await failReminderRunAttempt(prisma, run.id, attemptNo, 'No verified WATI connection');
      await prisma.reminderRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          lastError: 'No verified WATI connection',
        },
      });
      processed.push({ id: run.id, status: 'failed' });
      continue;
    }

    if (run.invoice.paymentLinks.length === 0) {
      await failReminderRunAttempt(prisma, run.id, attemptNo, 'No active payment link');
      await prisma.reminderRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          lastError: 'No active payment link',
        },
      });
      processed.push({ id: run.id, status: 'failed' });
      continue;
    }

    if (!run.template?.providerTemplateName) {
      await failReminderRunAttempt(prisma, run.id, attemptNo, 'Missing WATI template name');
      await prisma.reminderRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          lastError: 'Missing WATI template name',
        },
      });
      processed.push({ id: run.id, status: 'failed' });
      continue;
    }

    try {
      const connection = decryptProviderConfig<WatiConnectionConfig>(
        run.messagingConnection.encryptedConfig
      );
      const response = await sendWatiTemplateMessage({
        phone: run.invoice.client.phone,
        templateName: run.template.providerTemplateName,
        broadcastName: `payrecover-${run.invoice.invoiceNo}-${run.id}`,
        parameters: buildReminderTemplateParameters(run as ReminderDispatchSelection),
      }, connection);

      if (!response.providerMessageId) {
        throw new Error('WATI response did not include a message ID');
      }

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

      await failReminderRunAttempt(prisma, run.id, attemptNo, errorMessage);

      const willRetry = attemptNo < MAX_REMINDER_DELIVERY_ATTEMPTS;
      await prisma.reminderRun.update({
        where: { id: run.id },
        data: willRetry
          ? {
              status: 'scheduled',
              scheduledFor: getNextReminderRetryDate(now),
              lastError: errorMessage,
            }
          : {
              status: 'failed',
              lastError: errorMessage,
            },
      });

      await prisma.invoiceEvent.create({
        data: {
          invoiceId: run.invoiceId,
          userId: run.userId,
          type: 'reminder_failed',
          message: willRetry
            ? `WhatsApp reminder send failed and was rescheduled: ${errorMessage}`
            : `WhatsApp reminder failed: ${errorMessage}`,
        },
      });

      processed.push({ id: run.id, status: willRetry ? 'retry_scheduled' : 'failed' });
    }
  }

  return processed;
}
