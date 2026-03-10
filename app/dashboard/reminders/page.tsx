'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Smartphone, Save, Clock, Plus, Trash2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../../components/toast';
import ConfirmDialog from '../../components/confirm-dialog';
import Skeleton from '../../components/skeleton';
import { apiFetch } from '@/lib/client-api';
import { updateReminderDraft, withReminderOrder } from '@/lib/dashboard-state';

interface Reminder {
  id: string;
  channel: 'whatsapp' | 'sms';
  timing: string;
  template: string;
  providerTemplateName: string | null;
  active: boolean;
  order: number;
}

function getReminderExecutionState(reminder: Reminder): {
  label: string;
  tone: string;
} {
  if (!reminder.active) {
    return {
      label: 'Paused',
      tone: 'bg-slate-100 text-slate-500',
    };
  }

  if (reminder.channel === 'sms') {
    return {
      label: 'Template only',
      tone: 'bg-amber-100 text-amber-700',
    };
  }

  if (!reminder.providerTemplateName) {
    return {
      label: 'Needs WATI mapping',
      tone: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    label: 'Executable',
    tone: 'bg-emerald-100 text-emerald-700',
  };
}

function RemindersLoadingState() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 mt-2" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addToast } = useToast();

  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<Reminder[]>('/api/reminders');
      setReminders(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const visibleReminders = useMemo(() => {
    return reminders
      .filter((reminder) => reminder.channel === activeTab)
      .sort((a, b) => a.order - b.order);
  }, [activeTab, reminders]);

  const handleToggle = (id: string) => {
    setReminders((prev) =>
      updateReminderDraft(prev, id, {
        active: !prev.find((reminder) => reminder.id === id)?.active,
      })
    );
  };

  const handleTemplateChange = (id: string, value: string) => {
    setReminders((prev) => updateReminderDraft(prev, id, { template: value }));
  };

  const handleTimingChange = (id: string, value: string) => {
    setReminders((prev) => updateReminderDraft(prev, id, { timing: value }));
  };

  const handleAddReminder = async () => {
    try {
      const reminder = await apiFetch<Reminder>('/api/reminders', {
        method: 'POST',
        body: JSON.stringify({
          channel: activeTab,
          timing: '3 Days Before Due',
          template:
            'Hi {{client_name}}, you have an outstanding invoice of {{amount}}. Pay here: {{payment_link}}',
          providerTemplateName: '',
        }),
      });
      setReminders((prev) => [...prev, reminder]);
      addToast('New reminder step added');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add reminder', 'error');
    }
  };

  const handleDeleteReminder = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch<{ message: string }>(`/api/reminders?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setReminders((prev) => prev.filter((reminder) => reminder.id !== deleteTarget.id));
      addToast('Reminder step removed', 'error');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to remove reminder', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = withReminderOrder(
        visibleReminders.map((reminder, index) => ({
          ...reminder,
          order: index,
        }))
      ).map((reminder) => ({
        id: reminder.id,
        timing: reminder.timing,
        template: reminder.template,
        providerTemplateName: reminder.providerTemplateName,
        active: reminder.active,
        order: reminder.order,
      }));

      await apiFetch<{ message: string }>('/api/reminders', {
        method: 'PUT',
        body: JSON.stringify({ reminders: payload }),
      });

      setReminders((prev) => {
        const byId = new Map(payload.map((item) => [item.id, item]));
        return prev.map((reminder) => {
          const next = byId.get(reminder.id);
          if (!next) return reminder;
          return {
            ...reminder,
            timing: next.timing,
            template: next.template,
            providerTemplateName: next.providerTemplateName ?? null,
            active: next.active,
            order: next.order,
          };
        });
      });

      addToast(`${activeTab === 'whatsapp' ? 'WhatsApp' : 'SMS'} automations saved successfully`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save automations', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && reminders.length === 0) {
    return <RemindersLoadingState />;
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
        <p className="text-slate-500 text-sm mt-1">
          Configure your automated reminder schedules and message templates.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Live dispatch is currently wired for WhatsApp only. SMS templates remain stored for planning,
        and WhatsApp reminder steps need a matching WATI template name before the scheduler can send them.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadReminders}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-sm hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'whatsapp'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp Templates
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'sms'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            SMS Templates
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {activeTab === 'whatsapp' ? 'WhatsApp Sequence' : 'SMS Sequence'}
            </h3>
            <button
              onClick={handleAddReminder}
              className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Reminder
            </button>
          </div>

          <div className="space-y-6">
            {visibleReminders.map((reminder, index) => {
              const executionState = getReminderExecutionState(reminder);

              return (
                <motion.div
                  key={reminder.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="border border-slate-200 rounded-xl p-5 relative"
                >
                <div className="absolute -left-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="absolute -left-3 -top-3 bg-emerald-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="ml-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <select
                        value={reminder.timing}
                        onChange={(e) => handleTimingChange(reminder.id, e.target.value)}
                        className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option>3 Days Before Due</option>
                        <option>1 Day Before Due</option>
                        <option>On Due Date</option>
                        <option>1 Day Overdue</option>
                        <option>3 Days Overdue</option>
                        <option>7 Days Overdue</option>
                        <option>14 Days Overdue</option>
                      </select>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-md ${
                          reminder.active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {reminder.active ? 'Active' : 'Paused'}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-md ${executionState.tone}`}
                      >
                        {executionState.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeleteTarget(reminder)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete step"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={reminder.active}
                          onChange={() => handleToggle(reminder.id)}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Message Template
                    </label>
                    <textarea
                      className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                      value={reminder.template}
                      onChange={(e) => handleTemplateChange(reminder.id, e.target.value)}
                    />
                    <div className="flex gap-2 text-xs text-slate-500">
                      <span>Variables:</span>
                      <span className="text-emerald-600">{'{{client_name}}'}</span>
                      <span className="text-emerald-600">{'{{amount}}'}</span>
                      <span className="text-emerald-600">{'{{due_date}}'}</span>
                      <span className="text-emerald-600">{'{{payment_link}}'}</span>
                    </div>
                  </div>

                  {activeTab === 'whatsapp' && (
                    <div className="space-y-2 mt-4">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        WATI Template Name
                      </label>
                      <input
                        type="text"
                        value={reminder.providerTemplateName || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setReminders((prev) =>
                            prev.map((item) =>
                              item.id === reminder.id
                                ? { ...item, providerTemplateName: value.trim() || null }
                                : item
                            )
                          );
                        }}
                        placeholder="approved_wati_template_name"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <p className="text-xs text-slate-500">
                        The rendered message above stays your internal template copy. The WATI template
                        name controls live WhatsApp delivery.
                      </p>
                    </div>
                  )}
                </div>
                </motion.div>
              );
            })}

            {visibleReminders.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">No reminder steps</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add a reminder to start automating your follow-ups.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end pt-6 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Reminder Step"
        message="Are you sure you want to remove this reminder step? Your clients won't receive notifications at this stage anymore."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleDeleteReminder}
        onCancel={() => setDeleteTarget(null)}
      />
    </motion.div>
  );
}
