'use client';

import { useState } from 'react';
import { useAnnouncements } from '@/lib/useFirestore';
import { addAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/firestore';
import type { Announcement } from '@/lib/firestore';
import { useLanguage } from '@/lib/language-context';

const CATEGORIES: { key: Announcement['category']; th: string; en: string }[] = [
  { key: 'new_policy',     th: 'นโยบายใหม่',     en: 'New Policy' },
  { key: 'kitchen_notice', th: 'แจ้งครัว',        en: 'Kitchen Notice' },
  { key: 'system_update',  th: 'อัปเดตระบบ',      en: 'System Update' },
  { key: 'promotion',      th: 'โปรโมชัน',        en: 'Promotion' },
];

const PRIORITIES: { key: Announcement['priority']; th: string; en: string; color: string }[] = [
  { key: 'low',    th: 'ต่ำ',    en: 'Low',    color: 'bg-gray-100 text-gray-600' },
  { key: 'medium', th: 'กลาง',   en: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { key: 'high',   th: 'สูง',    en: 'High',   color: 'bg-red-100 text-red-700' },
];

const emptyForm = {
  title: '',
  content: '',
  category: 'kitchen_notice' as Announcement['category'],
  priority: 'medium' as Announcement['priority'],
  isActive: true,
  expiresAt: undefined as Date | undefined,
};

export default function AnnouncementsPage() {
  const { locale } = useLanguage();
  const { announcements, loading } = useAnnouncements(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      priority: a.priority,
      isActive: a.isActive,
      expiresAt: a.expiresAt,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    // Strip undefined fields — Firestore rejects them
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== undefined)
    ) as typeof form;
    try {
      if (editing) {
        await updateAnnouncement(editing.id, payload);
      } else {
        await addAnnouncement(payload);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(locale === 'th' ? 'ลบประกาศนี้?' : 'Delete this announcement?')) return;
    await deleteAnnouncement(id);
  }

  async function toggleActive(a: Announcement) {
    await updateAnnouncement(a.id, { isActive: !a.isActive });
  }

  const priorityBadge = (p: Announcement['priority']) => {
    const cfg = PRIORITIES.find((x) => x.key === p)!;
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.color}`}>
        {locale === 'th' ? cfg.th : cfg.en}
      </span>
    );
  };

  const catLabel = (k: Announcement['category']) => {
    const c = CATEGORIES.find((x) => x.key === k);
    return locale === 'th' ? c?.th : c?.en;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-bold text-on-surface">
          {locale === 'th' ? 'ประกาศ' : 'Announcements'}
        </h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {locale === 'th' ? 'เพิ่มประกาศ' : 'Add Announcement'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-surface-container-high rounded-xl animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] block mb-2">campaign</span>
          <p>{locale === 'th' ? 'ยังไม่มีประกาศ' : 'No announcements yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm ${!a.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-on-surface">{a.title}</p>
                    {priorityBadge(a.priority)}
                    <span className="px-2 py-0.5 text-xs rounded-full bg-surface-container text-on-surface-variant">
                      {catLabel(a.category)}
                    </span>
                    {!a.isActive && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-semibold">
                        {locale === 'th' ? 'ซ่อน' : 'Hidden'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-variant line-clamp-2">{a.content}</p>
                  {a.expiresAt && (
                    <p className="text-xs text-on-surface-variant mt-1">
                      {locale === 'th' ? 'หมดอายุ: ' : 'Expires: '}
                      {new Date(a.expiresAt).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-AU')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(a)}
                    className={`p-1.5 rounded-lg transition-colors ${a.isActive ? 'hover:bg-amber-50' : 'hover:bg-green-50'}`}
                    title={a.isActive ? 'ซ่อน' : 'แสดง'}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${a.isActive ? 'text-amber-500' : 'text-green-600'}`}>
                      {a.isActive ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-red-600">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h2 className="text-lg font-headline font-bold text-on-surface">
                {editing
                  ? (locale === 'th' ? 'แก้ไขประกาศ' : 'Edit Announcement')
                  : (locale === 'th' ? 'เพิ่มประกาศใหม่' : 'New Announcement')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {locale === 'th' ? 'หัวข้อ' : 'Title'} *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {locale === 'th' ? 'เนื้อหา' : 'Content'}
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">
                    {locale === 'th' ? 'หมวด' : 'Category'}
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as Announcement['category'] })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{locale === 'th' ? c.th : c.en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">
                    {locale === 'th' ? 'ความสำคัญ' : 'Priority'}
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as Announcement['priority'] })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.key} value={p.key}>{locale === 'th' ? p.th : p.en}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Expires At */}
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {locale === 'th' ? 'วันหมดอายุ (ไม่บังคับ)' : 'Expiry Date (optional)'}
                </label>
                <input
                  type="date"
                  value={form.expiresAt ? new Date(form.expiresAt).toISOString().slice(0, 10) : ''}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value ? new Date(e.target.value) : undefined })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-on-surface">
                  {locale === 'th' ? 'แสดงให้สาขาเห็น' : 'Visible to branches'}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-on-surface bg-surface-container-high rounded-lg hover:opacity-90"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm font-medium text-on-primary bg-primary rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? '...' : (locale === 'th' ? 'บันทึก' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
