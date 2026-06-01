'use client';

import { useState, useMemo } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useOrders } from '@/lib/useFirestore';
import { updateOrderStatus } from '@/lib/firestore';
import { useStaff, useActor } from '@/lib/staff-context';
import { useLanguage } from '@/lib/language-context';

function formatCurrency(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(d: unknown, locale: string) {
  if (!d) return '';
  const date = new Date(d as string);
  return date.toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DeliveryPage() {
  const { locale, setLocale } = useLanguage();
  const { staff } = useStaff();
  const actor = useActor();
  const { orders, loading } = useOrders();

  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () => orders.filter((o) => o.status === 'dispatched'),
    [orders],
  );

  async function handleMarkDelivered(orderDocId: string) {
    if (!actor) {
      alert(locale === 'th' ? 'ยังไม่มีโปรไฟล์พนักงาน' : 'Staff profile missing');
      return;
    }
    if (
      !confirm(
        locale === 'th'
          ? 'ยืนยันว่าส่งถึงสาขาแล้ว?'
          : 'Confirm delivery completed?',
      )
    ) {
      return;
    }
    setBusyId(orderDocId);
    try {
      await updateOrderStatus(orderDocId, 'delivered', actor);
    } catch (err) {
      console.error('Mark delivered failed:', err);
      alert(
        locale === 'th'
          ? 'บันทึกไม่ได้ ลองอีกครั้ง'
          : 'Failed to save, please retry',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleLogout() {
    if (
      !confirm(locale === 'th' ? 'ออกจากระบบ?' : 'Sign out?')
    ) {
      return;
    }
    await signOut(auth);
    window.location.href = '/admin/login/';
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-emerald-950 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center bg-white rounded-xl px-2 py-1 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Thaithae"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-emerald-300/70 leading-none">
                {locale === 'th' ? 'คนส่ง' : 'Delivery'}
              </p>
              <p className="text-sm font-semibold truncate leading-tight">
                {staff?.name ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLocale(locale === 'th' ? 'en' : 'th')}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs"
              aria-label="Toggle language"
            >
              {locale === 'th' ? 'TH' : 'EN'}
            </button>
            <button
              onClick={handleLogout}
              className="w-11 h-11 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
              aria-label="Sign out"
              title={locale === 'th' ? 'ออกจากระบบ' : 'Sign out'}
            >
              <span className="material-symbols-outlined text-[22px]">
                logout
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="font-headline font-bold text-xl text-on-surface">
            {locale === 'th' ? 'ออเดอร์รอส่ง' : 'Pending deliveries'}
          </h1>
          <span className="text-sm font-semibold text-primary">
            {pending.length}{' '}
            <span className="text-xs font-normal text-on-surface-variant">
              {locale === 'th' ? 'ออเดอร์' : 'orders'}
            </span>
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 animate-pulse"
              >
                <div className="h-5 w-32 bg-surface-container-high rounded mb-2" />
                <div className="h-4 w-48 bg-surface-container rounded" />
                <div className="h-12 w-full bg-surface-container rounded-xl mt-4" />
              </div>
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-outline-variant/40 py-16 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-[48px]">
              local_shipping
            </span>
            <p className="font-semibold text-on-surface mt-3">
              {locale === 'th'
                ? 'ไม่มีออเดอร์ที่ต้องส่งตอนนี้'
                : 'No pending deliveries'}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {locale === 'th'
                ? 'รอจนกว่าจะมีออเดอร์ที่แพ็คเสร็จ'
                : 'Waiting for packed orders'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((order) => {
              const totalItems = order.items.reduce(
                (sum, i) => sum + i.quantity,
                0,
              );
              const isBusy = busyId === order.id;
              return (
                <div
                  key={order.id}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 shadow-sm"
                >
                  {/* Branch + order # */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {locale === 'th' ? 'สาขา' : 'Branch'}
                      </p>
                      <p className="font-headline font-bold text-base text-on-surface truncate">
                        {order.branchName}
                      </p>
                    </div>
                    <span className="font-mono text-xs px-2 py-1 rounded-lg bg-surface-container-high text-on-surface-variant shrink-0">
                      {order.orderId}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {locale === 'th' ? 'จำนวนรายการ' : 'Items'}
                      </p>
                      <p className="font-semibold text-on-surface">
                        {totalItems}{' '}
                        <span className="text-xs font-normal text-on-surface-variant">
                          {locale === 'th' ? 'ชิ้น' : 'pcs'}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {locale === 'th' ? 'ยอดรวม' : 'Total'}
                      </p>
                      <p className="font-semibold text-on-surface">
                        ฿{formatCurrency(order.total)}
                      </p>
                    </div>
                  </div>

                  {/* Packed by + when */}
                  {order.packedByName && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 mb-3">
                      <span className="material-symbols-outlined text-[14px]">
                        inventory_2
                      </span>
                      <span className="font-semibold">
                        {locale === 'th' ? 'แพ็คโดย' : 'Packed by'}:
                      </span>
                      <span>{order.packedByName}</span>
                      {order.packedAt && (
                        <span className="text-emerald-600/70 ml-auto">
                          {formatDateTime(order.packedAt, locale)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action: ส่งเสร็จ */}
                  <button
                    onClick={() => handleMarkDelivered(order.id)}
                    disabled={isBusy}
                    className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary font-bold text-base hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                  >
                    {isBusy ? (
                      <>
                        <span className="material-symbols-outlined text-[20px] animate-spin">
                          progress_activity
                        </span>
                        {locale === 'th' ? 'กำลังบันทึก…' : 'Saving…'}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[22px]">
                          check_circle
                        </span>
                        {locale === 'th' ? 'ส่งเสร็จ' : 'Mark Delivered'}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
