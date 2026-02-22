'use client';

import { useState } from 'react';
import { MessageSquare, Smartphone, Save, Clock, Plus } from 'lucide-react';

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'sms'>('whatsapp');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your automated reminder schedules and message templates.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'whatsapp' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp Templates
          </button>
          <button 
            onClick={() => setActiveTab('sms')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'sms' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Smartphone className="w-4 h-4" />
            SMS Templates
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {activeTab === 'whatsapp' ? 'WhatsApp Sequence' : 'SMS Sequence'}
            </h3>
            <button className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
              <Plus className="w-4 h-4" />
              Add Reminder
            </button>
          </div>

          <div className="space-y-6">
            {/* Reminder 1 */}
            <div className="border border-slate-200 rounded-xl p-5 relative">
              <div className="absolute -left-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-400">
                <Clock className="w-4 h-4" />
              </div>
              <div className="ml-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <select className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                      <option>3 Days Before Due</option>
                      <option>On Due Date</option>
                      <option>1 Day Overdue</option>
                    </select>
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">Active</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Message Template</label>
                  <textarea 
                    className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    defaultValue={`Hi {{client_name}}, this is a gentle reminder that your invoice for {{amount}} is due on {{due_date}}. You can pay securely here: {{payment_link}}`}
                  />
                  <div className="flex gap-2 text-xs text-slate-500">
                    <span>Available variables:</span>
                    <button className="text-emerald-600 hover:underline">{'{{client_name}}'}</button>
                    <button className="text-emerald-600 hover:underline">{'{{amount}}'}</button>
                    <button className="text-emerald-600 hover:underline">{'{{due_date}}'}</button>
                    <button className="text-emerald-600 hover:underline">{'{{payment_link}}'}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Reminder 2 */}
            <div className="border border-slate-200 rounded-xl p-5 relative">
              <div className="absolute -left-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-400">
                <Clock className="w-4 h-4" />
              </div>
              <div className="ml-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <select className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                      <option>On Due Date</option>
                      <option>3 Days Before Due</option>
                      <option>1 Day Overdue</option>
                    </select>
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">Active</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Message Template</label>
                  <textarea 
                    className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    defaultValue={`Hi {{client_name}}, your invoice for {{amount}} is due today. Please complete your payment here: {{payment_link}}`}
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="mt-8 flex justify-end pt-6 border-t border-slate-100">
            <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors">
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
