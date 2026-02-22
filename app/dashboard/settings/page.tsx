'use client';

import { useState } from 'react';
import { Save, CreditCard, Building2, Bell, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your business profile and payment integrations.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Building2 className="w-4 h-4" />
              Business Profile
            </button>
            <button 
              onClick={() => setActiveTab('payments')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'payments' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <CreditCard className="w-4 h-4" />
              Payment Gateways
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Bell className="w-4 h-4" />
              Notifications
            </button>
          </nav>
        </aside>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            {activeTab === 'general' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Business Profile</h3>
                  <p className="text-sm text-slate-500">This information will be displayed on your invoices and payment links.</p>
                </div>
                
                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                    <input type="text" defaultValue="Dr. John Doe Clinic" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Support Email</label>
                    <input type="email" defaultValue="support@johndoeclinic.com" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Business Number</label>
                    <input type="text" defaultValue="+971 50 000 0000" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    <p className="text-xs text-slate-500 mt-1">This number will be used to send automated reminders.</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors">
                    <Save className="w-4 h-4" />
                    Save Profile
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Payment Gateways</h3>
                  <p className="text-sm text-slate-500">Connect your preferred payment provider to automatically generate payment links for MENA customers.</p>
                </div>
                
                <div className="grid gap-4 max-w-2xl">
                  {/* Paymob */}
                  <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-blue-600">
                        PM
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">Paymob</h4>
                        <p className="text-xs text-slate-500">Popular in Egypt, UAE, KSA</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                      Connect
                    </button>
                  </div>

                  {/* Tap Payments */}
                  <div className="border border-emerald-200 rounded-xl p-5 flex items-center justify-between bg-emerald-50/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white border border-emerald-200 rounded-lg flex items-center justify-center font-bold text-emerald-600">
                        TAP
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900">Tap Payments</h4>
                          <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Accept KNET, Mada, Benefit, Fawry</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                      Manage
                    </button>
                  </div>

                  {/* Stripe */}
                  <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-indigo-600">
                        ST
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">Stripe</h4>
                        <p className="text-xs text-slate-500">Global card payments (UAE only)</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                      Connect
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 mt-6">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-medium text-blue-900">Secure Payments</h5>
                    <p className="text-xs text-blue-700 mt-1">We never store your customers' credit card details. All transactions are securely processed by your connected gateway.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
                  <p className="text-sm text-slate-500">Choose when and how you want to be notified.</p>
                </div>
                
                <div className="space-y-4 max-w-xl">
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Payment Received</h4>
                      <p className="text-xs text-slate-500">Get an email when a client pays an invoice.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Daily Summary</h4>
                      <p className="text-xs text-slate-500">Receive a daily digest of sent reminders and recovered payments.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
