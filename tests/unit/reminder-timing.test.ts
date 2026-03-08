import { describe, expect, it } from 'vitest';
import {
  getReminderScheduledFor,
  parseReminderTiming,
  renderReminderTemplate,
  shouldMaterializeReminderRun,
} from '@/lib/reminder-timing';

describe('reminder timing helpers', () => {
  it('parses before-due, on-due, and overdue labels', () => {
    expect(parseReminderTiming('3 Days Before Due')).toEqual({
      kind: 'before_due',
      offsetDays: -3,
    });
    expect(parseReminderTiming('On Due Date')).toEqual({
      kind: 'on_due_date',
      offsetDays: 0,
    });
    expect(parseReminderTiming('7 Days Overdue')).toEqual({
      kind: 'overdue',
      offsetDays: 7,
    });
  });

  it('computes reminder dispatch time at the shared UTC dispatch hour', () => {
    const scheduled = getReminderScheduledFor(
      new Date('2026-03-10T00:00:00.000Z'),
      '1 Day Before Due'
    );

    expect(scheduled?.toISOString()).toBe('2026-03-09T09:00:00.000Z');
  });

  it('skips pre-due reminders when the invoice was created after the reminder window', () => {
    expect(
      shouldMaterializeReminderRun(
        new Date('2026-03-10T00:00:00.000Z'),
        new Date('2026-03-09T12:00:00.000Z'),
        '1 Day Before Due'
      )
    ).toBe(false);
    expect(
      shouldMaterializeReminderRun(
        new Date('2026-03-10T00:00:00.000Z'),
        new Date('2026-03-10T12:00:00.000Z'),
        '1 Day Overdue'
      )
    ).toBe(true);
  });

  it('renders supported reminder variables into the message body', () => {
    const rendered = renderReminderTemplate(
      'Hi {{client_name}}, pay {{amount}} by {{due_date}}: {{payment_link}}',
      {
        client_name: 'Sara',
        amount: '120.00',
        due_date: '2026-03-10',
        payment_link: 'https://pay.link',
      }
    );

    expect(rendered).toBe('Hi Sara, pay 120.00 by 2026-03-10: https://pay.link');
  });
});
