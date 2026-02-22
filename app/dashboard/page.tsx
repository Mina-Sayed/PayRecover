'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight, MessageCircle, Smartphone, Users } from 'lucide-react';

const chartData = [
  { name: 'Aug', recovered: 4000, overdue: 2400 },
  { name: 'Sep', recovered: 3000, overdue: 1398 },
  { name: 'Oct', recovered: 5500, overdue: 3800 },
  { name: 'Nov', recovered: 4780, overdue: 3908 },
  { name: 'Dec', recovered: 8900, overdue: 4800 },
  { name: 'Jan', recovered: 12400, overdue: 3800 },
];

const recentInvoices = [
  { id: 'INV-2024-001', client: 'Elite Fitness Gym', amount: 1250, dueDate: '2024-01-15', status: 'overdue', daysOverdue: 12, reminder: 'WhatsApp Sent' },
  { id: 'INV-2024-002', client: 'Dr. Ahmed Clinic', amount: 850, dueDate: '2024-01-20', status: 'overdue', daysOverdue: 7, reminder: 'SMS Sent' },
  { id: 'INV-2024-003', client: 'Sarah Coaching', amount: 450, dueDate: '2024-01-28', status: 'pending', daysOverdue: 0, reminder: 'Scheduled' },
  { id: 'INV-2024-004', client: 'CrossFit Amman', amount: 2100, dueDate: '2024-01-10', status: 'paid', daysOverdue: 0, reminder: 'Paid' },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Track your payment recovery and active reminders.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Outstanding</h3>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">$4,250</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Across 14 overdue invoices</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Recovered This Month</h3>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">$12,400</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +14%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Compared to last month</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Active Reminders</h3>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">34</span>
            <span className="text-xs font-medium text-blue-600 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +5
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Scheduled for the next 7 days</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Acquisition Cost</h3>
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">$1.45</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
              -12%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Based on Pro Tier & SMS usage</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Recovery Trends</h3>
          <p className="text-sm text-slate-500">Recovered revenue vs overdue amounts over time.</p>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `$${value}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [`$${value}`, 'Recovered']}
              />
              <Area type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRecovered)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Actionable List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Action Required</h3>
            <p className="text-sm text-slate-500">Recent overdue invoices needing attention.</p>
          </div>
          <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Last Action</th>
                <th className="px-6 py-4 font-medium text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{invoice.client}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{invoice.id}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    ${invoice.amount}
                  </td>
                  <td className="px-6 py-4">
                    {invoice.status === 'overdue' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                        {invoice.daysOverdue} Days Overdue
                      </span>
                    )}
                    {invoice.status === 'pending' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                        Due in 2 Days
                      </span>
                    )}
                    {invoice.status === 'paid' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Paid
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {invoice.reminder}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {invoice.status === 'overdue' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Send WhatsApp">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Send SMS">
                          <Smartphone className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
