'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { reviseOrderItems, type Order } from '@/lib/firestore';

interface Props {
  order: Order;
  actor: { uid?: string; name: string };
  onClose: () => void;
  onSaved?: (result: { cancelled: boolean }) => void;
}

function formatBaht(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EditOrderItemsModal({ order, actor, onClose, onSaved }: Props) {
  const { locale } = useLanguage();
  // Map productId -> new qty (start with current quantities)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const item of order.items) {
      init[item.productId] = item.quantity;
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setQty(productId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  }

  const previewItems = useMemo(() => {
    return order.items.map((item) => {
      const newQty = quantities[item.productId] ?? item.quantity;
      const removed = newQty === 0;
      const total = item.unitPrice * newQty;
      const diff = newQty - item.quantity;
      return { ...item, newQty, removed, lineTotal: total, diff };
    });
  }, [order.items, quantities]);

  const keptItems = previewItems.filter((i) => !i.removed);
  const subtotal = keptItems.reduce((s, i) => s + i.lineTotal, 0);
  const vat = subtotal * 0.07;
  const total = subtotal + vat;
  const allRemoved = keptItems.length === 0;
  const hasChange = previewItems.some((i) => i.diff !== 0);
  const hasInvalid = previewItems.some((i) => i.diff > 0);

  async function handleSave() {
    if (!hasChange) {
      onClose();
      return;
    }
    if (hasInvalid) {
      setError(locale === 'th' ? 'เพิ่มจำนวนไม่ได้ ลดได้อย่างเดียว' : 'You can only reduce quantities');
      return;
    }
    if (allRemoved) {
      if (
        !confirm(
          locale === 'th'
            ? 'ลบหมดทุกรายการจะยกเลิกออเดอร์ทั้งใบ ดำเนินการต่อ?'
            : 'Removing all items will cancel the entire order. Continue?',
        )
      ) {
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const result = await reviseOrderItems(order.id, quantities, actor);
      onSaved?.(result);
      onClose();
    } catch (err) {
      console.error('reviseOrderItems failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : locale === 'th'
            ? 'บันทึกไม่สำเร็จ'
            : 'Failed to save',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 shrink-0">
          <div>
            <h2 className="text-lg font-headline font-bold text-on-surface">
              {locale === 'th' ? 'แก้ไขรายการ' : 'Edit items'}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {order.orderId} · {order.branchName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container-high"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <p className="text-xs text-on-surface-variant mb-2">
            {locale === 'th'
              ? 'ลดจำนวนหรือลบรายการที่ไม่ต้องการ (เพิ่มไม่ได้)'
              : 'Reduce quantity or remove items (cannot add)'}
          </p>
          {previewItems.map((item) => {
            const displayName = locale === 'th' ? item.nameTh : (item.nameEn || item.nameTh);
            return (
              <div
                key={item.productId}
                className={`rounded-xl border p-3 ${
                  item.removed
                    ? 'border-red-200 bg-red-50 opacity-60'
                    : item.diff < 0
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-outline-variant/30 bg-surface'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold text-on-surface ${
                        item.removed ? 'line-through' : ''
                      }`}
                    >
                      {displayName}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      ฿{item.unitPrice.toLocaleString()} / {item.unit}
                      {' · '}
                      {locale === 'th' ? 'เดิม' : 'was'} {item.quantity}
                      {item.diff < 0 && !item.removed && (
                        <span className="ml-2 text-amber-700 font-semibold">
                          → {item.newQty}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQty(item.productId, item.newQty - 1)}
                      disabled={item.newQty <= 0}
                      className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center font-bold disabled:opacity-30"
                      aria-label="decrease"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={item.newQty}
                      onChange={(e) =>
                        setQty(
                          item.productId,
                          Math.min(item.quantity, Math.max(0, Number(e.target.value) || 0)),
                        )
                      }
                      className="w-14 h-8 text-center rounded-lg border border-outline-variant text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(item.productId, 0)}
                      className="w-8 h-8 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 flex items-center justify-center"
                      aria-label="remove line"
                      title={locale === 'th' ? 'ลบรายการนี้' : 'Remove'}
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-on-surface-variant">
                    {item.removed
                      ? (locale === 'th' ? 'ถูกลบ' : 'Removed')
                      : (locale === 'th' ? 'รวม' : 'Total')}
                  </span>
                  <span className={`font-semibold ${item.removed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                    ฿{formatBaht(item.lineTotal)}
                  </span>
                </div>
              </div>
            );
          })}

          {allRemoved && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">
                {locale === 'th' ? 'ลบหมดทุกรายการ' : 'All items removed'}
              </p>
              <p className="text-xs mt-1">
                {locale === 'th'
                  ? 'การบันทึกจะยกเลิกออเดอร์ทั้งใบและคืนสต็อกทั้งหมด'
                  : 'Saving will cancel the entire order and restock everything.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer: totals + actions */}
        <div className="border-t border-outline-variant/20 px-5 py-4 space-y-3 shrink-0">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-on-surface-variant">
              <span>{locale === 'th' ? 'ยอดเดิม' : 'Original total'}</span>
              <span className="line-through">฿{formatBaht(order.total)}</span>
            </div>
            <div className="flex justify-between font-bold text-on-surface text-base">
              <span>{locale === 'th' ? 'ยอดใหม่' : 'New total'}</span>
              <span className="text-primary">฿{formatBaht(total)}</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container disabled:opacity-50"
            >
              {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || hasInvalid || !hasChange}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {saving && (
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              )}
              {allRemoved
                ? (locale === 'th' ? 'ยกเลิกออเดอร์' : 'Cancel order')
                : (locale === 'th' ? 'บันทึก' : 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
