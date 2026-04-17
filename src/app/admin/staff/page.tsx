'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useStaff } from '@/lib/staff-context';
import {
  getAllStaff,
  upsertStaff,
  updateStaff,
  deleteStaff,
  type Staff,
  type StaffRole,
} from '@/lib/firestore';
import { isOwnerEmail } from '@/lib/owner';

const roleLabels: Record<StaffRole, { th: string; en: string }> = {
  admin: { th: 'ผู้ดูแลระบบ', en: 'Admin' },
  kitchen: { th: 'ครัว', en: 'Kitchen' },
  packer: { th: 'แพ็ค', en: 'Packer' },
  both: { th: 'ครัว+แพ็ค', en: 'Kitchen + Packer' },
};

// Simple helper: Firestore doc id is the Firebase Auth uid. Admin must create
// the Firebase Auth account in Firebase Console FIRST, then paste the uid here.
// (We can't create auth users client-side without signing out the current user.)

export default function StaffManagementPage() {
  const { locale } = useLanguage();
  const { staff: currentStaff } = useStaff();

  const [list, setList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setLoading(true);
    const all = await getAllStaff();
    setList(all);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  // Only users with 'admin' role can manage staff
  const canManage = currentStaff?.role === 'admin';

  async function handleToggleActive(s: Staff) {
    if (isOwnerEmail(s.authEmail)) {
      alert(locale === 'th'
        ? 'บัญชีเจ้าของระบบไม่สามารถถูกปิดใช้งานได้'
        : "Owner account cannot be deactivated.");
      return;
    }
    await updateStaff(s.id, { isActive: !s.isActive });
    reload();
  }

  async function handleDelete(s: Staff) {
    if (isOwnerEmail(s.authEmail)) {
      alert(locale === 'th'
        ? 'บัญชีเจ้าของระบบไม่สามารถถูกลบได้'
        : 'Owner account cannot be deleted.');
      return;
    }
    if (!confirm(locale === 'th' ? `ลบพนักงาน "${s.name}"?` : `Delete staff "${s.name}"?`)) return;
    await deleteStaff(s.id);
    reload();
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-on-surface-variant/60 uppercase">
            {locale === 'th' ? 'การตั้งค่า' : 'Settings'}
          </p>
          <h1 className="font-headline font-bold text-2xl text-on-surface mt-1">
            {locale === 'th' ? 'พนักงาน' : 'Staff'}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            {locale === 'th'
              ? 'จัดการพนักงานที่เข้ามาทำงานในโรงงาน ใช้สำหรับแสดงชื่อผู้รับออเดอร์/แพ็คออเดอร์'
              : 'Manage factory staff. Used to show who accepted/packed each order.'}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            {locale === 'th' ? 'เพิ่มพนักงาน' : 'Add staff'}
          </button>
        )}
      </div>

      {/* Bootstrap instructions */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-2">
        <p className="font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          {locale === 'th' ? 'วิธีเพิ่มพนักงานใหม่' : 'How to add a new staff member'}
        </p>
        <ol className="text-xs space-y-1 list-decimal list-inside">
          <li>
            {locale === 'th'
              ? 'สร้างบัญชี Firebase Auth (email + password) ใน Firebase Console → Authentication → Users'
              : 'Create a Firebase Auth account (email + password) in Firebase Console → Authentication → Users'}
          </li>
          <li>
            {locale === 'th'
              ? 'คัดลอก User UID จากรายการที่สร้าง'
              : 'Copy the User UID shown next to the new account'}
          </li>
          <li>
            {locale === 'th'
              ? 'กด "เพิ่มพนักงาน" ที่ด้านบน → วาง UID + กรอกชื่อ + บทบาท'
              : 'Click "Add staff" above → paste the UID + enter name + role'}
          </li>
          <li>
            {locale === 'th'
              ? 'แจ้งอีเมล + password ให้พนักงาน → เข้า /admin/login ด้วยบัญชีของตัวเอง'
              : 'Share the email + password with the staff member → they log in at /admin/login'}
          </li>
        </ol>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl p-4 animate-pulse">
              <div className="h-5 bg-surface-container rounded w-1/3 mb-2" />
              <div className="h-4 bg-surface-container rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl mb-3">group</span>
          <p className="font-semibold">{locale === 'th' ? 'ยังไม่มีพนักงาน' : 'No staff yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div
              key={s.id}
              className={`bg-surface-container-lowest rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center gap-3 ${s.isActive ? 'border-outline-variant/50' : 'border-outline-variant/30 opacity-60'}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-headline font-bold text-on-surface">{s.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                    {roleLabels[s.role][locale as 'th' | 'en']}
                  </span>
                  {!s.isActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">
                      {locale === 'th' ? 'ปิดใช้งาน' : 'Inactive'}
                    </span>
                  )}
                  {currentStaff?.id === s.id && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                      {locale === 'th' ? 'คุณ' : 'You'}
                    </span>
                  )}
                  {isOwnerEmail(s.authEmail) && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 inline-flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[11px]">shield_person</span>
                      {locale === 'th' ? 'เจ้าของระบบ' : 'Owner'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 font-mono truncate">{s.authEmail}</p>
                <p className="text-[10px] text-on-surface-variant/60 mt-0.5 font-mono truncate">UID: {s.id}</p>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 shrink-0">
                  {!isOwnerEmail(s.authEmail) && (
                    <button
                      onClick={() => handleToggleActive(s)}
                      title={s.isActive ? 'Deactivate' : 'Activate'}
                      className="p-2 rounded-lg hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined text-base">
                        {s.isActive ? 'toggle_on' : 'toggle_off'}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => { setEditing(s); setShowForm(true); }}
                    title={locale === 'th' ? 'แก้ไข' : 'Edit'}
                    className="p-2 rounded-lg hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  {currentStaff?.id !== s.id && !isOwnerEmail(s.authEmail) && (
                    <button
                      onClick={() => handleDelete(s)}
                      title={locale === 'th' ? 'ลบ' : 'Delete'}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <StaffForm
          editing={editing}
          locale={locale}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}
    </div>
  );
}

function StaffForm({
  editing,
  locale,
  onClose,
  onSaved,
}: {
  editing: Staff | null;
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [uid, setUid] = useState(editing?.id ?? '');
  const [email, setEmail] = useState(editing?.authEmail ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [role, setRole] = useState<StaffRole>(editing?.role ?? 'kitchen');
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Guard: refuse to create/update a staff profile for an email that's
  // already registered as a branch owner. Prevents branch accounts from
  // being escalated into /admin/* via the form.
  const isLockedOwner = isOwnerEmail(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!uid.trim() || !email.trim() || !name.trim()) {
      setErr(locale === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill in all fields');
      return;
    }
    setSaving(true);
    try {
      await upsertStaff(uid.trim(), {
        authEmail: email.trim().toLowerCase(),
        name: name.trim(),
        // Owner email is force-admin regardless of what's chosen in the UI.
        role: isLockedOwner ? 'admin' : role,
        isActive: isLockedOwner ? true : isActive,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-container-lowest rounded-2xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="font-headline font-bold text-lg text-on-surface">
            {editing
              ? (locale === 'th' ? 'แก้ไขพนักงาน' : 'Edit staff')
              : (locale === 'th' ? 'เพิ่มพนักงาน' : 'Add staff')}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-on-surface mb-1">
              Firebase Auth UID
              <span className="text-on-surface-variant font-normal ml-1">
                ({locale === 'th' ? 'จาก Firebase Console' : 'from Firebase Console'})
              </span>
            </label>
            <input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              required
              disabled={!!editing}
              placeholder="abc123xyz456..."
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface mb-1">
              {locale === 'th' ? 'อีเมลที่ใช้ล็อกอิน' : 'Login email'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="bank@thaithae.com"
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface mb-1">
              {locale === 'th' ? 'ชื่อที่จะแสดง' : 'Display name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={locale === 'th' ? 'แบงค์' : 'Bank'}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface mb-1">
              {locale === 'th' ? 'บทบาท' : 'Role'}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="kitchen">{roleLabels.kitchen[locale as 'th' | 'en']}</option>
              <option value="packer">{roleLabels.packer[locale as 'th' | 'en']}</option>
              <option value="both">{roleLabels.both[locale as 'th' | 'en']}</option>
              <option value="admin">{roleLabels.admin[locale as 'th' | 'en']}</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-on-surface">
              {locale === 'th' ? 'เปิดใช้งาน' : 'Active'}
            </span>
          </label>

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container"
            >
              {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving
                ? (locale === 'th' ? 'กำลังบันทึก…' : 'Saving…')
                : (locale === 'th' ? 'บันทึก' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
