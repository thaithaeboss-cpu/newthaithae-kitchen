'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useCustomers } from '@/lib/useFirestore';
import { addCustomer, updateCustomer, deleteCustomer } from '@/lib/firestore';

type CustomerFormData = {
  companyName: string;
  companyNameTh: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  creditTerms: number;
  creditLimit: number;
  outstandingBalance: number;
  isActive: boolean;
};

const emptyCustomer: CustomerFormData = {
  companyName: '',
  companyNameTh: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  creditTerms: 30,
  creditLimit: 0,
  outstandingBalance: 0,
  isActive: true,
};

export default function CustomersPage() {
  const { t, locale } = useLanguage();
  const { customers, loading, refresh } = useCustomers();
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<{ id: string } & CustomerFormData | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyCustomer);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (c.companyNameTh ?? '').includes(search) ||
      c.contactPerson.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditCustomer(null);
    setFormData(emptyCustomer);
    setShowModal(true);
  };

  const openEdit = (c: typeof customers[number]) => {
    setEditCustomer({
      id: c.id,
      companyName: c.companyName,
      companyNameTh: (c as any).companyNameTh ?? '',
      contactPerson: c.contactPerson,
      phone: c.phone,
      email: c.email,
      address: c.address,
      taxId: c.taxId,
      creditTerms: (c as any).creditTerms ?? (c as any).creditTermDays ?? 30,
      creditLimit: c.creditLimit,
      outstandingBalance: c.outstandingBalance,
      isActive: c.isActive,
    });
    setFormData({
      companyName: c.companyName,
      companyNameTh: (c as any).companyNameTh ?? '',
      contactPerson: c.contactPerson,
      phone: c.phone,
      email: c.email,
      address: c.address,
      taxId: c.taxId,
      creditTerms: (c as any).creditTerms ?? (c as any).creditTermDays ?? 30,
      creditLimit: c.creditLimit,
      outstandingBalance: c.outstandingBalance,
      isActive: c.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        companyName: formData.companyName,
        companyNameTh: formData.companyNameTh,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        taxId: formData.taxId,
        creditTerms: formData.creditTerms,
        creditLimit: formData.creditLimit,
        outstandingBalance: formData.outstandingBalance,
        isActive: formData.isActive,
      };
      if (editCustomer) {
        await updateCustomer(editCustomer.id, data);
      } else {
        await addCustomer(data);
      }
      await refresh();
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save customer:', err);
    }
  };

  const creditUsagePercent = (c: typeof customers[number]) =>
    c.creditLimit > 0 ? Math.round((c.outstandingBalance / c.creditLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-headline font-bold text-on-surface">{t('manage_customers')}</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('add_new_customer')}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          type="text"
          placeholder="ค้นหาลูกค้า..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant">
                  <th className="text-left px-4 py-3 font-semibold">{t('company_name')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('contact_person')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('phone')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('email')}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t('credit_terms')} ({t('days')})</th>
                  <th className="text-right px-4 py-3 font-semibold">{t('credit_limit')}</th>
                  <th className="text-right px-4 py-3 font-semibold">{t('outstanding_balance')}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t('status')}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="h-4 w-36 rounded bg-surface-container-high mb-1" />
                      <div className="h-3 w-24 rounded bg-surface-container-high" />
                    </td>
                    <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-surface-container-high" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-surface-container-high" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-surface-container-high" /></td>
                    <td className="px-4 py-3 text-center"><div className="h-4 w-8 rounded bg-surface-container-high mx-auto" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-20 rounded bg-surface-container-high ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-20 rounded bg-surface-container-high ml-auto" /></td>
                    <td className="px-4 py-3 text-center"><div className="h-5 w-16 rounded-full bg-surface-container-high mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-7 w-16 rounded-lg bg-surface-container-high mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="text-left px-4 py-3 font-semibold">{t('company_name')}</th>
                    <th className="text-left px-4 py-3 font-semibold">{t('contact_person')}</th>
                    <th className="text-left px-4 py-3 font-semibold">{t('phone')}</th>
                    <th className="text-left px-4 py-3 font-semibold">{t('email')}</th>
                    <th className="text-center px-4 py-3 font-semibold">{t('credit_terms')} ({t('days')})</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('credit_limit')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('outstanding_balance')}</th>
                    <th className="text-center px-4 py-3 font-semibold">{t('status')}</th>
                    <th className="text-center px-4 py-3 font-semibold">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filtered.map((c) => {
                    const usage = creditUsagePercent(c);
                    const creditTerms = (c as any).creditTerms ?? (c as any).creditTermDays ?? 30;
                    return (
                      <tr key={c.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-on-surface">{c.companyName}</p>
                          <p className="text-xs text-on-surface-variant">{(c as any).companyNameTh ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 text-on-surface">{c.contactPerson}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{c.phone}</td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs">{c.email}</td>
                        <td className="px-4 py-3 text-center text-on-surface">{creditTerms}</td>
                        <td className="px-4 py-3 text-right text-on-surface font-medium">
                          ฿{c.creditLimit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={`font-medium ${usage > 80 ? 'text-red-600' : usage > 50 ? 'text-amber-600' : 'text-on-surface'}`}>
                            ฿{c.outstandingBalance.toLocaleString()}
                          </p>
                          <div className="w-full h-1.5 bg-surface-container-high rounded-full mt-1">
                            <div
                              className={`h-full rounded-full ${usage > 80 ? 'bg-red-500' : usage > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(usage, 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.isActive ? t('status_active') : t('status_inactive')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEdit(c)}
                              className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                            </button>
                            <button
                              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                              className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                                {expandedId === c.id ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Expanded Order History */}
            {expandedId && (
              <div className="px-6 py-4 bg-surface-container border-t border-outline-variant/20">
                <h3 className="text-sm font-semibold text-on-surface mb-3">{t('order_history_label')}</h3>
                <p className="text-sm text-on-surface-variant">{t('no_order_history')}</p>
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((c) => {
              const usage = creditUsagePercent(c);
              return (
                <div key={c.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-on-surface">{c.companyName}</p>
                      <p className="text-xs text-on-surface-variant">{(c as any).companyNameTh ?? ''}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? t('status_active') : t('status_inactive')}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                      {c.contactPerson}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">call</span>
                      {c.phone}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-outline-variant/20">
                    <div>
                      <p className="text-xs text-on-surface-variant">{t('credit_limit')}</p>
                      <p className="font-medium text-on-surface text-sm">฿{c.creditLimit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-on-surface-variant">{t('outstanding_balance')} ({usage}%)</p>
                      <p className={`font-medium text-sm ${usage > 80 ? 'text-red-600' : 'text-on-surface'}`}>
                        ฿{c.outstandingBalance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openEdit(c)} className="flex-1 py-2 text-xs font-medium text-primary bg-primary/5 rounded-lg">
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="flex-1 py-2 text-xs font-medium text-on-surface-variant bg-surface-container rounded-lg"
                    >
                      {t('order_history_btn')}
                    </button>
                  </div>
                  {expandedId === c.id && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/20 space-y-2">
                      <p className="text-xs text-on-surface-variant">{t('no_order_history')}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h2 className="text-lg font-headline font-bold text-on-surface">
                {editCustomer ? t('edit_customer') : t('add_new_customer')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('company_name')} (EN)</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('company_name')} (TH)</label>
                  <input
                    type="text"
                    value={formData.companyNameTh}
                    onChange={(e) => setFormData({ ...formData, companyNameTh: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('contact_person')}</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('tax_id')}</label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('phone')}</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('email')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('address')}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('credit_terms')} ({t('days')})</label>
                  <input
                    type="number"
                    value={formData.creditTerms}
                    onChange={(e) => setFormData({ ...formData, creditTerms: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('credit_limit')}</label>
                  <input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('outstanding_balance')}</label>
                  <input
                    type="number"
                    value={formData.outstandingBalance}
                    onChange={(e) => setFormData({ ...formData, outstandingBalance: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-on-surface bg-surface-container-high rounded-lg hover:opacity-90"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-on-primary bg-primary rounded-lg hover:opacity-90"
              >
                {editCustomer ? t('save') : t('add_customer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
