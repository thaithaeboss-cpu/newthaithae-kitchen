'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useProducts, useBranches } from '@/lib/useFirestore';
import {
  reviseOrderItems,
  effectivePrice,
  type CustomerType,
  type Order,
  type OrderItem,
} from '@/lib/firestore';

interface Props {
  order: Order;
  actor: { uid?: string; name: string };
  onClose: () => void;
  onSaved?: (result: { cancelled: boolean }) => void;
}

function formatBaht(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// In-memory snapshot for a line in the working set. Mirrors OrderItem
// but tracks where it came from so the UI can show "original" vs "added".
type WorkingLine = OrderItem & {
  origin: 'original' | 'added';
  originalQty: number;
  availableStock: number;
};

export default function EditOrderItemsModal({ order, actor, onClose, onSaved }: Props) {
  const { locale } = useLanguage();
  const { products } = useProducts();
  const { branches } = useBranches();
  const orderBranch = branches.find((b) => b.id === order.branchId);
  const customerType: CustomerType =
    orderBranch?.customerType === 'external' ? 'external' : 'internal';

  // Quantities for every line (original + added).
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const item of order.items) init[item.productId] = item.quantity;
    return init;
  });
  // Snapshots for lines added in this session — needed so we can render
  // and submit them even though they're not in order.items.
  const [addedSnapshots, setAddedSnapshots] = useState<Record<string, OrderItem>>({});
  const [addSearch, setAddSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the working set every render — combine original items with the
  // added snapshots and current quantities map.
  const workingLines: WorkingLine[] = useMemo(() => {
    const lines: WorkingLine[] = [];

    // Original items
    for (const item of order.items) {
      const newQty = quantities[item.productId] ?? item.quantity;
      const product = products.find((p) => p.id === item.productId);
      lines.push({
        ...item,
        quantity: newQty,
        total: item.unitPrice * newQty,
        origin: 'original',
        originalQty: item.quantity,
        // Available stock for additional units beyond the original qty.
        availableStock: product?.stock ?? 0,
      });
    }

    // Added items (productIds in snapshots but not in original)
    for (const productId of Object.keys(addedSnapshots)) {
      const snap = addedSnapshots[productId];
      const newQty = quantities[productId] ?? 0;
      const product = products.find((p) => p.id === productId);
      lines.push({
        ...snap,
        quantity: newQty,
        total: snap.unitPrice * newQty,
        origin: 'added',
        originalQty: 0,
        availableStock: product?.stock ?? 0,
      });
    }

    return lines;
  }, [order.items, products, quantities, addedSnapshots]);

  // Catalog of products that can be added (active, visible to this branch,
  // and not already in the working set).
  const inWorkingSet = useMemo(() => {
    const ids = new Set<string>();
    for (const item of order.items) ids.add(item.productId);
    for (const id of Object.keys(addedSnapshots)) ids.add(id);
    return ids;
  }, [order.items, addedSnapshots]);

  const addableProducts = useMemo(() => {
    let list = products.filter((p) => p.isActive && !inWorkingSet.has(p.id));
    if (orderBranch) {
      list = list.filter((p) => {
        if (!p.visibleToBranches || p.visibleToBranches.length === 0) return true;
        return p.visibleToBranches.includes(orderBranch.id);
      });
    }
    if (addSearch.trim()) {
      const q = addSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.nameTh.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      );
    }
    return list.slice(0, 10); // cap to keep dropdown manageable
  }, [products, inWorkingSet, orderBranch, addSearch]);

  function setQty(productId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  }

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const unitPrice = effectivePrice(product, customerType);
    const snap: OrderItem = {
      productId: product.id,
      nameTh: product.nameTh,
      nameEn: product.nameEn,
      quantity: 1,
      unit: product.unit,
      unitPrice,
      total: unitPrice,
    };
    setAddedSnapshots((prev) => ({ ...prev, [productId]: snap }));
    setQuantities((prev) => ({ ...prev, [productId]: 1 }));
    setAddSearch('');
  }

  // Validation: any line that wants more units than the original + stock-available
  // is over-limit. For added lines, originalQty=0 so the cap is just stock.
  const lineErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const line of workingLines) {
      const extraWanted = line.quantity - line.originalQty;
      if (extraWanted > line.availableStock) {
        errs[line.productId] =
          locale === 'th'
            ? `สต็อกเหลือ ${line.availableStock} เพิ่มได้สูงสุด ${line.originalQty + line.availableStock}`
            : `Stock left: ${line.availableStock}; max ${line.originalQty + line.availableStock}`;
      }
    }
    return errs;
  }, [workingLines, locale]);
  const hasStockError = Object.keys(lineErrors).length > 0;

  const keptLines = workingLines.filter((l) => l.quantity > 0);
  const subtotal = keptLines.reduce((s, l) => s + l.total, 0);
  const vat = subtotal * 0.07;
  const total = subtotal + vat;
  const allRemoved = keptLines.length === 0;
  const hasChange = workingLines.some(
    (l) => l.quantity !== l.originalQty,
  ) || Object.keys(addedSnapshots).length > 0;

  async function handleSave() {
    if (!hasChange) {
      onClose();
      return;
    }
    if (hasStockError) {
      setError(
        locale === 'th'
          ? 'บางรายการเกินสต็อก ลดจำนวนหรือเอาออกก่อน'
          : 'Some lines exceed stock — adjust before saving',
      );
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

    // Build the final OrderItem[] to ship to the backend.
    const newItems: OrderItem[] = keptLines.map((l) => ({
      productId: l.productId,
      nameTh: l.nameTh,
      nameEn: l.nameEn,
      unit: l.unit,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      total: l.unitPrice * l.quantity,
    }));

    setSaving(true);
    setError(null);
    try {
      const result = await reviseOrderItems(order.id, newItems, actor);
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
              {customerType === 'external' && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                  {locale === 'th' ? 'ลูกค้านอก' : 'External'}
                </span>
              )}
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Items list */}
          <div className="space-y-2">
            <p className="text-xs text-on-surface-variant">
              {locale === 'th'
                ? 'ลด/ลบ หรือเพิ่มจำนวน จะเช็คสต็อกอัตโนมัติ'
                : 'Reduce, remove, or increase items — stock is checked automatically'}
            </p>
            {workingLines.map((line) => {
              const removed = line.quantity === 0;
              const diff = line.quantity - line.originalQty;
              const stockErr = lineErrors[line.productId];
              const displayName = locale === 'th' ? line.nameTh : (line.nameEn || line.nameTh);
              const isAdded = line.origin === 'added';
              return (
                <div
                  key={line.productId}
                  className={`rounded-xl border p-3 ${
                    stockErr
                      ? 'border-red-300 bg-red-50'
                      : removed
                        ? 'border-red-200 bg-red-50 opacity-70'
                        : isAdded
                          ? 'border-emerald-200 bg-emerald-50'
                          : diff !== 0
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-outline-variant/30 bg-surface'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-sm font-semibold text-on-surface ${
                            removed ? 'line-through' : ''
                          }`}
                        >
                          {displayName}
                        </p>
                        {isAdded && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                            {locale === 'th' ? 'เพิ่มใหม่' : 'new'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        ฿{line.unitPrice.toLocaleString()} / {line.unit}
                        {!isAdded && (
                          <>
                            {' · '}
                            {locale === 'th' ? 'เดิม' : 'was'} {line.originalQty}
                          </>
                        )}
                        {' · '}
                        {locale === 'th' ? 'สต็อกเหลือ' : 'stock'} {line.availableStock}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(line.productId, line.quantity - 1)}
                        disabled={line.quantity <= 0}
                        className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center font-bold disabled:opacity-30"
                        aria-label="decrease"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={line.quantity}
                        onChange={(e) =>
                          setQty(line.productId, Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-14 h-8 text-center rounded-lg border border-outline-variant text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(line.productId, line.quantity + 1)}
                        disabled={line.quantity - line.originalQty >= line.availableStock}
                        className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold disabled:opacity-30"
                        aria-label="increase"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setQty(line.productId, 0)}
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
                      {removed
                        ? (locale === 'th' ? 'ถูกลบ' : 'Removed')
                        : diff > 0
                          ? (locale === 'th' ? `+${diff}` : `+${diff}`)
                          : diff < 0
                            ? `${diff}`
                            : (locale === 'th' ? 'รวม' : 'Total')}
                    </span>
                    <span className={`font-semibold ${removed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                      ฿{formatBaht(line.total)}
                    </span>
                  </div>
                  {stockErr && (
                    <p className="text-[11px] text-red-700 mt-1 font-medium">{stockErr}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add product picker */}
          <div className="rounded-xl border border-dashed border-outline-variant/60 p-3 bg-surface">
            <p className="text-xs font-semibold text-on-surface mb-2">
              {locale === 'th' ? 'เพิ่มสินค้าเข้าออเดอร์' : 'Add product to order'}
            </p>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder={locale === 'th' ? 'ค้นหาสินค้า…' : 'Search…'}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {addSearch.trim() && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {addableProducts.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2 text-center">
                    {locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}
                  </p>
                ) : (
                  addableProducts.map((p) => {
                    const unitPrice = effectivePrice(p, customerType);
                    const outOfStock = p.stock <= 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => addProduct(p.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed text-left"
                      >
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                          {outOfStock ? 'block' : 'add_circle'}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-on-surface truncate">
                            {locale === 'th' ? p.nameTh : p.nameEn}
                          </span>
                          <span className="block text-[11px] text-on-surface-variant">
                            ฿{unitPrice.toLocaleString()} / {p.unit} · {locale === 'th' ? 'สต็อก' : 'stock'} {p.stock}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

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

        {/* Footer */}
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
              disabled={saving || hasStockError || !hasChange}
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
