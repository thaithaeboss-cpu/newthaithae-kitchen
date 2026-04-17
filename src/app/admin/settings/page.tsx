'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/language-context';
import { loadSettings, saveSettings } from '@/lib/firestore';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  isActive: boolean;
}

const initialUsers: User[] = [
  { id: 'u1', name: 'Admin', email: 'admin@thaithae.com.au', role: 'admin', isActive: true },
];

export default function SettingsPage() {
  const { t, locale } = useLanguage();

  // General
  const [companyName, setCompanyName] = useState('Thaithae No1 Pty Ltd');
  const [companyAddress, setCompanyAddress] = useState('7 Commercial Road, Kingsgrove, NSW 2208');
  const [taxId, setTaxId] = useState('ABN 82663758');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savedGeneral, setSavedGeneral] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Bank account
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankBsb, setBankBsb] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [savedBank, setSavedBank] = useState(false);

  // Order Settings
  const [autoAccept, setAutoAccept] = useState(false);

  // Notifications
  const [emailNotif, setEmailNotif] = useState(true);
  const [lineNotif, setLineNotif] = useState(true);
  const [orderNotif, setOrderNotif] = useState(true);
  const [stockNotif, setStockNotif] = useState(true);
  const [paymentNotif, setPaymentNotif] = useState(false);

  // Users
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'staff' as User['role'] });

  // Load settings from Firestore on mount
  useEffect(() => {
    loadSettings().then((data) => {
      if (!data) return;
      if (data.companyName) setCompanyName(data.companyName);
      if (data.companyAddress) setCompanyAddress(data.companyAddress);
      if (data.taxId) setTaxId(data.taxId);
      if (data.logoUrl) { setLogoUrl(data.logoUrl); setLogoPreview(data.logoUrl); }
      if (data.bankName) setBankName(data.bankName);
      if (data.bankAccountName) setBankAccountName(data.bankAccountName);
      if (data.bankAccountNumber) setBankAccountNumber(data.bankAccountNumber);
      if (data.bankBsb) setBankBsb(data.bankBsb);
    });
  }, []);

  async function handleSaveGeneral() {
    setSavingGeneral(true);
    try {
      await saveSettings({ companyName, companyAddress, taxId, logoUrl });
      setSavedGeneral(true);
      setTimeout(() => setSavedGeneral(false), 2500);
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleSaveBank() {
    setSavingBank(true);
    try {
      await saveSettings({ bankName, bankAccountName, bankAccountNumber, bankBsb });
      setSavedBank(true);
      setTimeout(() => setSavedBank(false), 2500);
    } finally {
      setSavingBank(false);
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setLogoPreview(compressed);
        setLogoUrl(compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) return;
    setUsers([
      ...users,
      { id: `u${Date.now()}`, name: newUser.name, email: newUser.email, role: newUser.role, isActive: true },
    ]);
    setNewUser({ name: '', email: '', role: 'staff' });
    setShowAddUser(false);
  };

  const roleLabel = (role: string) => {
    const map: Record<string, { label: string; color: string }> = {
      admin:   { label: t('admin_role'),   color: 'bg-red-100 text-red-700' },
      manager: { label: t('manager_role'), color: 'bg-blue-100 text-blue-700' },
      staff:   { label: t('staff_role'),   color: 'bg-green-100 text-green-700' },
    };
    const r = map[role] || { label: role, color: 'bg-gray-100 text-gray-700' };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${r.color}`}>{r.label}</span>;
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full relative transition-colors ${value ? 'bg-primary' : 'bg-outline-variant'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${value ? 'right-1' : 'left-1'}`} />
    </button>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-headline font-bold text-on-surface">{t('settings_title')}</h1>

      {/* General Settings */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">business</span>
          {t('general_info')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">{t('company_name_label')}</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">{t('company_address')}</label>
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">{t('tax_id')}</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">{t('logo')}</label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              <div
                onClick={() => logoInputRef.current?.click()}
                className="border-2 border-dashed border-outline-variant/50 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors relative overflow-hidden"
              >
                {logoPreview ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo preview" className="h-16 object-contain" />
                    <p className="text-xs text-on-surface-variant">{locale === 'th' ? 'กดเพื่อเปลี่ยน' : 'Click to change'}</p>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant">cloud_upload</span>
                    <p className="text-xs text-on-surface-variant mt-1">{t('upload_logo')}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-outline-variant/20 flex justify-end">
          <button
            onClick={handleSaveGeneral}
            disabled={savingGeneral}
            className="px-4 py-2 text-sm font-medium text-on-primary bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {savingGeneral ? (
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            ) : savedGeneral ? (
              <span className="material-symbols-outlined text-base">check_circle</span>
            ) : null}
            {savedGeneral ? (locale === 'th' ? 'บันทึกแล้ว!' : 'Saved!') : t('save')}
          </button>
        </div>
      </div>

      {/* Bank Account */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">account_balance</span>
          {locale === 'th' ? 'บัญชีธนาคาร' : 'Bank Account'}
        </h2>
        <p className="text-sm text-on-surface-variant mb-4">
          {locale === 'th'
            ? 'ข้อมูลนี้จะแสดงให้สาขาเห็นเพื่อใช้โอนเงินชำระค่าสินค้า'
            : 'This info will be shown to branches for payment transfers.'}
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                {locale === 'th' ? 'ธนาคาร' : 'Bank Name'}
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Commonwealth Bank"
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                {locale === 'th' ? 'ชื่อบัญชี' : 'Account Name'}
              </label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="e.g. Thaithae No1 Pty Ltd"
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">BSB</label>
              <input
                type="text"
                value={bankBsb}
                onChange={(e) => setBankBsb(e.target.value)}
                placeholder="e.g. 062-000"
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                {locale === 'th' ? 'เลขบัญชี' : 'Account Number'}
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 1234 5678"
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveBank}
            disabled={savingBank}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {savingBank ? (
              <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
            ) : null}
            {savedBank ? (locale === 'th' ? 'บันทึกแล้ว!' : 'Saved!') : t('save')}
          </button>
        </div>
      </div>

      {/* Order Settings */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">shopping_cart</span>
          {t('order_settings_title')}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-container rounded-lg">
            <div>
              <p className="text-sm font-medium text-on-surface">{t('auto_accept_title')}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{t('auto_accept_desc')}</p>
            </div>
            <Toggle value={autoAccept} onChange={setAutoAccept} />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">notifications</span>
          {t('notif_settings')}
        </h2>
        <div className="space-y-3">
          {[
            { label: t('email_notif_title'), desc: t('email_notif_desc'), value: emailNotif, set: setEmailNotif },
            { label: t('line_notif_title'),  desc: t('line_notif_desc'),  value: lineNotif,  set: setLineNotif },
            { label: t('new_order_notif'),   desc: t('new_order_notif_desc'), value: orderNotif, set: setOrderNotif },
            { label: t('low_stock_notif'),   desc: t('low_stock_notif_desc'), value: stockNotif, set: setStockNotif },
            { label: t('payment_notif'),     desc: t('payment_notif_desc'),   value: paymentNotif, set: setPaymentNotif },
          ].map(({ label, desc, value, set }) => (
            <div key={label} className="flex items-center justify-between p-4 bg-surface-container rounded-lg">
              <div>
                <p className="text-sm font-medium text-on-surface">{label}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{desc}</p>
              </div>
              <Toggle value={value} onChange={set} />
            </div>
          ))}
        </div>
      </div>

      {/* User Management */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant">manage_accounts</span>
            {t('user_mgmt')}
          </h2>
          <button
            onClick={() => setShowAddUser(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            {t('add_user_btn')}
          </button>
        </div>

        {showAddUser && (
          <div className="mb-4 p-4 bg-surface-container rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder={t('full_name')}
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User['role'] })}
                className="px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="staff">{t('staff_role')}</option>
                <option value="manager">{t('manager_role')}</option>
                <option value="admin">{t('admin_role')}</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddUser(false)} className="px-3 py-1.5 text-sm text-on-surface bg-surface-container-high rounded-lg">
                {t('cancel')}
              </button>
              <button onClick={handleAddUser} className="px-3 py-1.5 text-sm text-on-primary bg-primary rounded-lg">
                {t('add_user_btn')}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary-container text-[18px]">person</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface">{u.name}</p>
                  <p className="text-xs text-on-surface-variant">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {roleLabel(u.role)}
                <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* External Menu Link */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-headline font-bold text-on-surface mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">public</span>
          {locale === 'th' ? 'ลิงก์เมนูลูกค้านอก' : 'External Customer Menu'}
        </h2>
        <p className="text-sm text-on-surface-variant mb-4">
          {locale === 'th'
            ? 'แชร์ลิงก์นี้ให้ลูกค้านอก (เช่น ร้านที่ซื้อส่ง) เพื่อดูสินค้าที่เปิดให้เห็น'
            : 'Share this link with external customers to view your public product list.'}
        </p>
        <ExternalMenuLink />
      </div>
    </div>
  );
}

function ExternalMenuLink() {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('/menu');
  useEffect(() => {
    setUrl(`${window.location.origin}/menu`);
  }, []);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-sm text-on-surface-variant font-mono select-all truncate">
        {url}
      </div>
      <button
        onClick={copy}
        className="shrink-0 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-[16px]">{copied ? 'check' : 'content_copy'}</span>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
