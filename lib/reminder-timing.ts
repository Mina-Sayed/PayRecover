const DISPATCH_HOUR_UTC = 9;

export interface ParsedReminderTiming {
  offsetDays: number;
  kind: 'before_due' | 'on_due_date' | 'overdue';
}

export interface ReminderTemplateVariables {
  client_name: string;
  amount: string;
  due_date: string;
  payment_link: string;
}

function toDispatchTime(date: Date): Date {
  const scheduled = new Date(date);
  scheduled.setUTCHours(DISPATCH_HOUR_UTC, 0, 0, 0);
  return scheduled;
}

export function parseReminderTiming(timing: string): ParsedReminderTiming | null {
  const normalized = timing.trim();

  if (normalized === 'On Due Date') {
    return { kind: 'on_due_date', offsetDays: 0 };
  }

  const beforeMatch = /^(\d+)\s+Day(?:s)?\s+Before Due$/i.exec(normalized);
  if (beforeMatch) {
    return { kind: 'before_due', offsetDays: Number(beforeMatch[1]) * -1 };
  }

  const overdueMatch = /^(\d+)\s+Day(?:s)?\s+Overdue$/i.exec(normalized);
  if (overdueMatch) {
    return { kind: 'overdue', offsetDays: Number(overdueMatch[1]) };
  }

  return null;
}

export function getReminderScheduledFor(dueDate: Date, timing: string): Date | null {
  const parsed = parseReminderTiming(timing);
  if (!parsed) {
    return null;
  }

  const scheduled = new Date(dueDate);
  scheduled.setUTCDate(scheduled.getUTCDate() + parsed.offsetDays);
  return toDispatchTime(scheduled);
}

export function shouldMaterializeReminderRun(
  dueDate: Date,
  createdAt: Date,
  timing: string
): boolean {
  const scheduledFor = getReminderScheduledFor(dueDate, timing);
  const parsed = parseReminderTiming(timing);

  if (!scheduledFor || !parsed) {
    return false;
  }

  if (parsed.kind === 'before_due') {
    return scheduledFor >= createdAt;
  }

  return true;
}

export function renderReminderTemplate(
  template: string,
  variables: ReminderTemplateVariables
): string {
  return template.replace(/\{\{(client_name|amount|due_date|payment_link)\}\}/g, (_match, token) => {
    return variables[token as keyof ReminderTemplateVariables] ?? '';
  });
}
