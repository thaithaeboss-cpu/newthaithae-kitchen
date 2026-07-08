'use client';

import { useState, useMemo, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useOrders } from '@/lib/useFirestore';
import { updateOrderStatus, type Order } from '@/lib/firestore';
import { useStaff, useActor } from '@/lib/staff-context';
import { useLanguage } from '@/lib/language-context';

// How long to wait for the server to confirm the write before we stop the
// spinner and show the "waiting for network" state. Field devices on a weak
// signal can take a while; 8s is long enough to catch a normal commit but short
// enough that the button never appears frozen.
const SYNC_TIMEOUT_MS = 8000;

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
  // Orders the driver has marked delivered whose write has NOT yet been
  // acknowledged by the server. We keep them on screen (instead of letting the
  // local optimistic write flip them out of the list) so the driver can never
  // mistake an unsynced tap for a completed one.
  const [syncing, setSyncing] = useState<Map<string, Order>>(new Map());
  const [isOnline, setIsOnline] = useState(true);
  // Which order's item list is expanded. Drivers open this to check which
  // branch leftover goods on the truck belong to.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const serverPending = useMemo(
    () => orders.filter((o) => o.status === 'dispatched'),
    [orders],
  );

  // Cards to render = orders still awaiting delivery on the server, PLUS orders
  // the driver just tapped that haven't synced yet (which the local cache has
  // already flipped out of `dispatched`). Syncing state wins so a just-tapped
  // card shows its "waiting" badge rather than a fresh action button.
  const cards = useMemo(() => {
    const map = new Map<string, { order: Order; syncing: boolean }>();
    for (const o of serverPending) map.set(o.id, { order: o, syncing: false });
    for (const [id, o] of syncing) map.set(id, { order: o, syncing: true });
    return Array.from(map.values());
  }, [serverPending, syncing]);

  const clearSyncing = (id: string) =>
    setSyncing((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

  async function handleMarkDelivered(order: Order) {
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

    setBusyId(order.id);
    // Park it in the syncing bucket immediately so the card stays visible even
    // after the optimistic local write removes it from `serverPending`.
    setSyncing((prev) => new Map(prev).set(order.id, order));

    // Pass the order we already hold so updateOrderStatus skips its server read
    // (which would hang on a weak signal). When online, this promise resolves
    // only after the server commits the write; when offline it stays pending.
    const write = updateOrderStatus(order.id, 'delivered', actor, order);

    // Once the server actually accepts the write, drop the "waiting" badge — even
    // if that happens long after the timeout below (i.e. signal came back).
    write
      .then(() => clearSyncing(order.id))
      .catch((err) => {
        console.error('Mark delivered failed:', err);
        clearSyncing(order.id);
        alert(
          locale === 'th'
            ? 'บันทึกไม่ได้ ลองอีกครั้ง'
            : 'Failed to save, please retry',
        );
      });

    // Don't let the button spin forever on a bad signal. If the server hasn't
    // confirmed within the timeout, stop the spinner and leave the card in its
    // "waiting for network" state so the driver knows it isn't done yet.
    try {
      await Promise.race([
        write.then(() => 'ok').catch(() => 'error'),
        new Promise((res) => setTimeout(() => res('timeout'), SYNC_TIMEOUT_MS)),
      ]);
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
        {!isOnline && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 text-sm">
            <span className="material-symbols-outlined text-[18px]">wifi_off</span>
            <span className="font-medium">
              {locale === 'th'
                ? 'ออฟไลน์ — การกดจะถูกส่งขึ้นระบบอัตโนมัติเมื่อมีเน็ต'
                : 'Offline — taps will sync automatically when back online'}
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <h1 className="font-headline font-bold text-xl text-on-surface">
            {locale === 'th' ? 'ออเดอร์รอส่ง' : 'Pending deliveries'}
          </h1>
          <span className="text-sm font-semibold text-primary">
            {cards.length}{' '}
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
        ) : cards.length === 0 ? (
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
            {cards.map(({ order, syncing: isSyncing }) => {
              const totalItems = order.items.reduce(
                (sum, i) => sum + i.quantity,
                0,
              );
              const isBusy = busyId === order.id;
              return (
                <div
                  key={order.id}
                  className={`bg-surface-container-lowest rounded-2xl border p-4 shadow-sm ${
                    isSyncing
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : 'border-outline-variant/30'
                  }`}
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

                  {/* View items — so the driver can check which branch the
                      leftover goods on the truck belong to */}
                  <button
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === order.id ? null : order.id,
                      )
                    }
                    className="w-full flex items-center justify-center gap-1.5 mb-3 py-2 rounded-lg border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container active:scale-[0.99] transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {expandedId === order.id ? 'expand_less' : 'list_alt'}
                    </span>
                    {expandedId === order.id
                      ? locale === 'th'
                        ? 'ซ่อนรายการ'
                        : 'Hide items'
                      : locale === 'th'
                        ? 'ดูรายการสินค้า'
                        : 'View items'}
                  </button>

                  {expandedId === order.id && (
                    <div className="mb-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest divide-y divide-outline-variant/20">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${item.productId}-${idx}`}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <span className="text-sm text-on-surface min-w-0 break-words">
                            {locale === 'th' ? item.nameTh : item.nameEn}
                          </span>
                          <span className="text-sm font-bold text-on-surface shrink-0 tabular-nums">
                            {item.quantity}
                            <span className="text-xs font-normal text-on-surface-variant ml-1">
                              {item.unit ||
                                (locale === 'th' ? 'ชิ้น' : 'pcs')}
                            </span>
                          </span>
                        </div>
                      ))}
                      {order.notes && (
                        <div className="flex items-start gap-1.5 px-3 py-2.5 text-xs text-amber-800 bg-amber-50">
                          <span className="material-symbols-outlined text-[15px] mt-px">
                            sticky_note_2
                          </span>
                          <span className="break-words">{order.notes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action: ส่งเสร็จ — or the "waiting to sync" state once tapped */}
                  {isSyncing ? (
                    <div className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 font-semibold text-sm px-3">
                      <span className="material-symbols-outlined text-[20px] animate-spin">
                        progress_activity
                      </span>
                      <span className="text-center leading-tight">
                        {locale === 'th'
                          ? 'รอส่งขึ้นระบบ — ยังไม่เสร็จ จนกว่าจะมีเน็ต'
                          : 'Waiting to sync — not done until it reaches the server'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleMarkDelivered(order)}
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
