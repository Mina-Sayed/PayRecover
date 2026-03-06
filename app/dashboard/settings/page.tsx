'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Save,
  CreditCard,
  Building2,
  Bell,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Skeleton from '../../components/skeleton';
import { useToast } from '../../components/toast';
import { apiFetch } from '@/lib/client-api';
import { providerCatalog } from '@/lib/provider-catalog';

type SettingsTab = 'general' | 'integrations' | 'notifications';

interface SettingsResponse {
  name: string | null;
  email: string;
  businessName: string | null;
  whatsappNumber: string | null;
  plan: string;
}

interface SettingsForm {
  name: string;
  businessName: string;
  whatsappNumber: string;
}

function SettingsLoadingState() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </aside>
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-11 w-full max-w-xl" />
          <Skeleton className="h-11 w-full max-w-xl" />
          <Skeleton className="h-11 w-full max-w-xl" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [profile, setProfile] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<SettingsForm>({
    name: '',
    businessName: '',
    whatsappNumber: '',
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    paymentReceived: true,
    dailySummary: true,
    overdueAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addToast } = useToast();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SettingsResponse>('/api/settings');
      setProfile(data);
      setForm({
        name: data.name ?? '',
        businessName: data.businessName ?? '',
        whatsappNumber: data.whatsappNumber ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      form.name.trim() !== (profile.name ?? '') ||
      form.businessName.trim() !== (profile.businessName ?? '') ||
      form.whatsappNumber.trim() !== (profile.whatsappNumber ?? '')
    );
  }, [form, profile]);

  const updateForm = (field: keyof SettingsForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!isDirty) {
      addToast('No changes to save', 'info');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch<SettingsResponse>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.trim(),
          businessName: form.businessName.trim(),
          whatsappNumber: form.whatsappNumber.trim(),
        }),
      });
      setProfile(updated);
      setForm({
        name: updated.name ?? '',
        businessName: updated.businessName ?? '',
        whatsappNumber: updated.whatsappNumber ?? '',
      });
      addToast('Settings saved successfully');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return <SettingsLoadingState />;
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your business profile, notifications, and provider integrations.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadSettings}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-sm hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'general'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Business Profile
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'integrations'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Integrations
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Bell className="w-4 h-4" />
              Notifications
            </button>
          </nav>
        </aside>

        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  className="space-y-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Business Profile</h3>
                    <p className="text-sm text-slate-500">
                      This information is used across your invoices and reminder templates.
                    </p>
                  </div>

                  <div className="space-y-4 max-w-xl">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(event) => updateForm('name', event.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={form.businessName}
                        onChange={(event) => updateForm('businessName', event.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Support Email
                      </label>
                      <input
                        type="email"
                        value={profile?.email ?? ''}
                        readOnly
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        WhatsApp Business Number
                      </label>
                      <input
                        type="text"
                        value={form.whatsappNumber}
                        onChange={(event) => updateForm('whatsappNumber', event.target.value)}
                        placeholder="+971 50 000 0000"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Current plan: <strong className="text-slate-700">{profile?.plan ?? 'free'}</strong>
                    </span>
                    <button
                      onClick={handleSave}
                      disabled={saving || !isDirty}
                      className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === 'integrations' && (
                <motion.div
                  key="integrations"
                  className="space-y-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Provider Connections</h3>
                    <p className="text-sm text-slate-500">
                      The next rollout is locked to Paymob for payments and WATI for WhatsApp
                      delivery.
                    </p>
                  </div>

                  <div className="grid gap-4 max-w-2xl">
                    {providerCatalog.map((provider) => (
                      <div
                        key={provider.id}
                        className="border border-slate-200 rounded-xl p-5 bg-slate-50/50"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-blue-600">
                              {provider.badge}
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{provider.name}</h4>
                              <p className="text-xs text-slate-500">{provider.headline}</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">
                            {provider.rolloutStatus === 'selected' ? 'Selected' : 'Deferred'}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 mt-4">{provider.description}</p>

                        <div className="mt-4 grid gap-2">
                          {provider.capabilities.map((capability) => (
                            <div key={capability} className="text-xs text-slate-600">
                              {capability}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Planned environment keys
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            {provider.envKeys.join(', ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-medium text-blue-900">Secure by default</h5>
                      <p className="text-xs text-blue-700 mt-1">
                        Paymob secrets and WATI tokens stay server-side, and both provider webhook
                        paths will require signature validation before going live.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  className="space-y-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
                    <p className="text-sm text-slate-500">
                      Local preferences for dashboard alerts and summary notifications.
                    </p>
                  </div>

                  <div className="space-y-4 max-w-xl">
                    {(
                      [
                        ['paymentReceived', 'Payment Received', 'Get notified when a payment is marked as paid.'],
                        ['dailySummary', 'Daily Summary', 'Receive a daily digest of reminder activity.'],
                        ['overdueAlerts', 'Overdue Alerts', 'Get alerted when invoices turn overdue.'],
                      ] as const
                    ).map(([key, label, description]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 border border-slate-200 rounded-xl"
                      >
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{label}</h4>
                          <p className="text-xs text-slate-500">{description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={notificationPrefs[key]}
                            onChange={() => {
                              setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
                              addToast('Notification preference updated', 'info');
                            }}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700">
                      Notification preferences are stored locally in this phase. Server persistence can
                      be added in the next backend iteration.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
