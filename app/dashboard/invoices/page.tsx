'use client';

import React, { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Download, Mail, MessageCircle, ChevronDown, MapPin, FileText, X } from 'lucide-react';

const initialMockInvoices = [
  { id: 'INV-2024-001', client: 'Elite Fitness Gym', phone: '+971 50 123 4567', email: 'billing@elitefitness.ae', address: 'Dubai Marina, UAE', amount: 1250, dueDate: '2024-01-15', status: 'overdue', pastInvoices: [{ id: 'INV-2023-112', amount: 1250, date: '2023-12-15', status: 'paid' }, { id: 'INV-2023-098', amount: 1250, date: '2023-11-15', status: 'paid' }] },
  { id: 'INV-2024-002', client: 'Dr. Ahmed Clinic', phone: '+20 10 1234 5678', email: 'info@ahmedclinic.eg', address: 'Heliopolis, Cairo', amount: 850, dueDate: '2024-01-20', status: 'overdue', pastInvoices: [{ id: 'INV-2023-115', amount: 850, date: '2023-12-20', status: 'paid' }] },
  { id: 'INV-2024-003', client: 'Sarah Coaching', phone: '+966 50 123 4567', email: 'sarah@coaching.sa', address: 'Riyadh, KSA', amount: 450, dueDate: '2024-01-28', status: 'pending', pastInvoices: [] },
  { id: 'INV-2024-004', client: 'CrossFit Amman', phone: '+962 7 9123 4567', email: 'hello@crossfitamman.jo', address: 'Abdoun, Amman', amount: 2100, dueDate: '2024-01-10', status: 'paid', pastInvoices: [{ id: 'INV-2023-101', amount: 2100, date: '2023-12-10', status: 'paid' }] },
  { id: 'INV-2024-005', client: 'Yoga Studio DXB', phone: '+971 55 987 6543', email: 'namaste@yogastudiodxb.ae', address: 'JLT, Dubai', amount: 600, dueDate: '2024-02-05', status: 'pending', pastInvoices: [{ id: 'INV-2024-001', amount: 600, date: '2024-01-05', status: 'paid' }] },
  { id: 'INV-2024-006', client: 'Dr. Fatima Dental', phone: '+973 3 123 4567', email: 'drfatima@dental.bh', address: 'Manama, Bahrain', amount: 1500, dueDate: '2023-12-28', status: 'paid', pastInvoices: [{ id: 'INV-2023-089', amount: 1500, date: '2023-11-28', status: 'paid' }] },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState(initialMockInvoices);
  const [filter, setFilter] = useState('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleRow = (id: string) => {
    setExpandedRowId(prev => prev === id ? null : id);
  };

  const handleCreateInvoice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newInvoice = {
      id: `INV-2024-00${invoices.length + 1}`,
      client: formData.get('clientName') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: 'Added manually',
      amount: Number(formData.get('amount')),
      dueDate: formData.get('dueDate') as string,
      status: 'pending',
      pastInvoices: []
    };

    setInvoices([newInvoice, ...invoices]);
    setIsModalOpen(false);
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients & Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your subscriptions, clients, and payment statuses.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search clients..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-full sm:w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {['all', 'overdue', 'pending', 'paid'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                  filter === status 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Client Details</th>
                <th className="px-6 py-4 font-medium">Invoice ID</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.map((invoice) => (
                <React.Fragment key={invoice.id}>
                  <tr className={`hover:bg-slate-50/50 transition-colors group ${expandedRowId === invoice.id ? 'bg-slate-50/50' : ''}`}>
                    <td 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => toggleRow(invoice.id)}
                    >
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {invoice.client}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedRowId === invoice.id ? 'rotate-180' : ''}`} />
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-emerald-500" />
                        {invoice.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {invoice.id}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      ${invoice.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      {invoice.status === 'overdue' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                          Overdue
                        </span>
                      )}
                      {invoice.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                          Pending
                        </span>
                      )}
                      {invoice.status === 'paid' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors" title="Download PDF">
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Send WhatsApp Reminder">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRowId === invoice.id && (
                    <tr className="bg-slate-50/30 border-b border-slate-200">
                      <td colSpan={6} className="px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Contact Details */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Contact Information</h4>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 text-sm text-slate-600">
                                <Mail className="w-4 h-4 text-slate-400" />
                                {invoice.email}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {invoice.address}
                              </div>
                            </div>
                          </div>
                          
                          {/* Past Invoices */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Past Invoices</h4>
                            {invoice.pastInvoices.length > 0 ? (
                              <div className="space-y-2">
                                {invoice.pastInvoices.map((past) => (
                                  <div key={past.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <FileText className="w-4 h-4 text-slate-400" />
                                      <div>
                                        <div className="text-sm font-medium text-slate-900">{past.id}</div>
                                        <div className="text-xs text-slate-500">{new Date(past.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-slate-900">${past.amount.toLocaleString()}</div>
                                      <div className="text-xs text-emerald-600 font-medium capitalize">{past.status}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 italic">No past invoices found.</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No invoices found matching the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
          <div>Showing {filteredInvoices.length} of {invoices.length} invoices</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">Previous</button>
            <button className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Create New Invoice</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                <input 
                  required
                  name="clientName"
                  type="text" 
                  placeholder="e.g. Sarah Fitness" 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
                  <input 
                    required
                    name="phone"
                    type="tel" 
                    placeholder="+971 50..." 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input 
                    required
                    name="email"
                    type="email" 
                    placeholder="client@email.com" 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                  <input 
                    required
                    name="amount"
                    type="number" 
                    min="1"
                    placeholder="0.00" 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input 
                    required
                    name="dueDate"
                    type="date" 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  Create & Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
