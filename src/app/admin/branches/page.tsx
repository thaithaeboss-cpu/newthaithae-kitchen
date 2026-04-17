'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useBranches } from '@/lib/useFirestore';
import { addBranch, updateBranch, deleteBranch } from '@/lib/firestore';

type BranchFormData = {
  code: string;
  nameTh: string;
  nameEn: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  isActive: boolean;
  openTime: string;
  closeTime: string;
  ownerEmail?: string;
};

const emptyBranch: BranchFormData = {
  code: '',
  nameTh: '',
  nameEn: '',
  address: '',
  phone: '',
  email: '',
  manager: '',
  isActive: true,
  openTime: '08:00',
  closeTime: '22:00',
  ownerEmail: '',
};

export default function BranchesPage() {
  const { t, locale } = useLanguage();
  const { branches, loading, refresh } = useBranches();
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState<{ id: string } & BranchFormData | null>(null);
  const [formData, setFormData] = useState<BranchFormData>(emptyBranch);

  const openAdd = () => {
    setEditBranch(null);
    setFormData(emptyBranch);
    setShowModal(true);
  };

  const openEdit = (b: { id: string } & BranchFormData) => {
    setEditBranch(b);
    setFormData({
      code: b.code,
      nameTh: b.nameTh,
      nameEn: b.nameEn,
      address: b.address,
      phone: b.phone,
      email: b.email,
      manager: b.manager,
      isActive: b.isActive,
      openTime: b.openTime,
      closeTime: b.closeTime,
      ownerEmail: (b as { ownerEmail?: string }).ownerEmail ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        ownerEmail: formData.ownerEmail?.trim().toLowerCase() || undefined,
      };
      if (editBranch) {
        await updateBranch(editBranch.id, payload);
      } else {
        await addBranch(payload);
      }
      await refresh();
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save branch:', err);
    }
  };

  const toggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      await updateBranch(id, { isActive: !currentlyActive });
      await refresh();
    } catch (err) {
      console.error('Failed to update branch status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-headline font-bold text-on-surface">{t('manage_branches')}</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('add_new_branch')}
        </button>
      </div>

      {/* Branch Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 animate-pulse"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-14 rounded-lg bg-surface-container-high" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 rounded bg-surface-container-high" />
                    <div className="h-3 w-24 rounded bg-surface-container-high" />
                  </div>
                </div>
                <div className="h-6 w-16 rounded-full bg-surface-container-high" />
              </div>
              <div className="space-y-2 mt-3">
                <div className="h-3 w-full rounded bg-surface-container-high" />
                <div className="h-3 w-3/4 rounded bg-surface-container-high" />
                <div className="h-3 w-1/2 rounded bg-surface-container-high" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-outline-variant/20">
                <div className="h-14 rounded-lg bg-surface-container-high" />
                <div className="h-14 rounded-lg bg-surface-container-high" />
              </div>
              <div className="flex gap-2 mt-4">
                <div className="flex-1 h-9 rounded-lg bg-surface-container-high" />
                <div className="flex-1 h-9 rounded-lg bg-surface-container-high" />
                <div className="h-9 w-10 rounded-lg bg-surface-container-high" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs font-bold">
                    {b.code}
                  </span>
                  <div>
                    <h3 className="font-semibold text-on-surface">{locale === 'th' ? b.nameTh : b.nameEn}</h3>
                    <p className="text-xs text-on-surface-variant">{locale === 'th' ? b.nameEn : b.nameTh}</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                    b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {b.isActive ? t('status_open') : t('status_closed')}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant mt-0.5">location_on</span>
                  <p className="text-on-surface-variant">{b.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">person</span>
                  <p className="text-on-surface-variant">{b.manager}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">call</span>
                    <p className="text-on-surface-variant">{b.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">mail</span>
                    <p className="text-on-surface-variant">{b.email}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-outline-variant/20">
                <div className="bg-surface-container rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-on-surface">0</p>
                  <p className="text-xs text-on-surface-variant">{t('orders_this_month')}</p>
                </div>
                <div className="bg-surface-container rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-on-surface">฿0</p>
                  <p className="text-xs text-on-surface-variant">{t('total_spent_month')}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => openEdit(b)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  {t('edit')}
                </button>
                <button className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-on-surface-variant bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  {t('view_orders_btn')}
                </button>
                <button
                  onClick={() => toggleActive(b.id, b.isActive)}
                  className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                    b.isActive
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-green-600 bg-green-50 hover:bg-green-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {b.isActive ? 'block' : 'check_circle'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h2 className="text-lg font-headline font-bold text-on-surface">
                {editBranch ? t('edit_branch') : t('add_new_branch')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('branch_code')}</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="#407"
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('manager')}</label>
                  <input
                    type="text"
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {locale === 'th' ? 'อีเมลสำหรับ Login (ของสาขา)' : 'Login Email (branch account)'}
                </label>
                <input
                  type="email"
                  value={formData.ownerEmail ?? ''}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  placeholder="branch@thaithae.com"
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {locale === 'th'
                    ? 'อีเมลนี้ต้องถูกสร้างใน Firebase Console ก่อน พนักงานสาขาใช้เข้าสู่ระบบ'
                    : 'This email must be created in Firebase Console first. Branch staff uses it to log in.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('branch_name')} (TH)</label>
                <input
                  type="text"
                  value={formData.nameTh}
                  onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('branch_name')} (EN)</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('open_time')}</label>
                  <input
                    type="time"
                    value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('close_time')}</label>
                  <input
                    type="time"
                    value={formData.closeTime}
                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
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
                {editBranch ? t('save') : t('add_branch')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
