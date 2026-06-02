'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProducts, useBranches } from '@/lib/useFirestore';
import { useLanguage } from '@/lib/language-context';
import { useActor } from '@/lib/staff-context';
import {
  addOrder,
  updateOrderStatus,
  updateStock,
  effectivePrice,
  type CustomerType,
  type Product,
} from '@/lib/firestore';
import type { ProductCategory } from '@/data/mock-data';

const productCategoryLabels: { key: 'all' | ProductCategory; th: string; en: string }[] = [
  { key: 'all', th: 'ทั้งหมด', en: 'All' },
  { key: 'glass', th: 'แก้ว/จาน', en: 'Glass' },
  { key: 'meat', th: 'เนื้อสัตว์', en: 'Meat' },
  { key: 'curry', th: 'แกง', en: 'Curry' },
  { key: 'sauce', th: 'ซอส/ผง', en: 'Sauce' },
  { key: 'dessert', th: 'ของหวาน', en: 'Dessert' },
  { key: 'filling', th: 'ไส้/ท็อปปิ้ง', en: 'Filling' },
];

function formatBaht(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NewOrderPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const actor = useActor();

  const { products, loading: loadingProducts } = useProducts();
  const { branches, loading: loadingBranches } = useBranches();

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | ProductCategory>('all');
  // productId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId),
    [branches, selectedBranchId],
  );
  const customerType: CustomerType =
    selectedBranch?.customerType === 'external' ? 'external' : 'internal';

  const visibleProducts = useMemo(() => {
    let list = products.filter((p) => p.isActive);
    if (selectedBranchId) {
      list = list.filter((p) => {
        if (!p.visibleToBranches || p.visibleToBranches.length === 0) return true;
        return p.visibleToBranches.includes(selectedBranchId);
      });
    }
    if (category !== 'all') {
      list = list.filter((p) => p.category === category);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.nameTh.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, selectedBranchId, category, search]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const product = products.find((p) => p.id === productId);
        if (!product || qty <= 0) return null;
        const unitPrice = effectivePrice(product, customerType);
        return { product, qty, unitPrice, total: unitPrice * qty };
      })
      .filter((x): x is { product: Product; qty: number; unitPrice: number; total: number } => !!x);
  }, [cart, products, customerType]);

  const subtotal = cartLines.reduce((s, l) => s + l.total, 0);
  const vat = subtotal * 0.07;
  const grandTotal = subtotal + vat;
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  function setQty(productId: string, qty: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[productId];
      } else {
        next[productId] = qty;
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!selectedBranch) {
      alert(locale === 'th' ? 'เลือกสาขาก่อน' : 'Pick a branch first');
      return;
    }
    if (cartLines.length === 0) {
      alert(locale === 'th' ? 'ยังไม่มีรายการในออเดอร์' : 'Cart is empty');
      return;
    }
    if (!actor) {
      alert(locale === 'th' ? 'ยังไม่มีโปรไฟล์พนักงาน' : 'Staff profile missing');
      return;
    }
    if (
      !confirm(
        locale === 'th'
          ? `ยืนยันสร้างออเดอร์ให้สาขา ${selectedBranch.nameTh || selectedBranch.nameEn}? ระบบจะข้ามขั้นรับและไปที่ "กำลังเตรียม" ทันที`
          : `Create order for ${selectedBranch.nameEn || selectedBranch.nameTh}? Will skip accept and go straight to "preparing".`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const branchName =
        (locale === 'th' ? selectedBranch.nameTh : selectedBranch.nameEn) ||
        selectedBranch.nameTh ||
        selectedBranch.nameEn ||
        selectedBranch.code;

      const orderDocId = await addOrder({
        branchId: selectedBranch.id,
        branchName,
        status: 'new',
        notes: notes.trim() || undefined,
        items: cartLines.map((l) => ({
          productId: l.product.id,
          nameTh: l.product.nameTh,
          nameEn: l.product.nameEn,
          quantity: l.qty,
          unit: l.product.unit,
          unitPrice: l.unitPrice,
          total: l.total,
        })),
        subtotal,
        vat,
        deliveryFee: 0,
        total: grandTotal,
      });

      // Mark as accepted/preparing in one shot, attributed to the staff
      // creating the order on the branch's behalf.
      await updateOrderStatus(orderDocId, 'preparing', actor);

      // Best-effort stock deduction (don't block on failure).
      await Promise.all(
        cartLines.map((l) =>
          updateStock(
            l.product.id,
            -l.qty,
            `Order #${orderDocId.slice(0, 6)} · ${branchName}`,
          ).catch((err) => {
            console.error(`Failed to deduct stock for ${l.product.nameEn}:`, err);
          }),
        ),
      );

      router.push('/admin/fulfillment/');
    } catch (err) {
      console.error('Failed to create order:', err);
      alert(
        locale === 'th'
          ? 'สร้างออเดอร์ไม่สำเร็จ ลองอีกครั้ง'
          : 'Failed to create order, please retry',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-on-surface-variant/60 uppercase">
            {locale === 'th' ? 'ออเดอร์' : 'Orders'}
          </p>
          <h1 className="font-headline font-bold text-2xl text-on-surface mt-1">
            {locale === 'th' ? 'สร้างออเดอร์ใหม่ (แทนสาขา)' : 'New order (on behalf of branch)'}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            {locale === 'th'
              ? 'ใช้เมื่อสาขาโทรเข้ามาสั่ง หรือกรอกแทนลูกค้านอก ระบบจะตั้งสถานะเป็น "กำลังเตรียม" ทันที'
              : 'For phone-in orders. Status starts at "preparing" with you as the receiver.'}
          </p>
        </div>
      </div>

      {/* Branch picker */}
      <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 space-y-3">
        <label className="block text-sm font-medium text-on-surface">
          {locale === 'th' ? 'เลือกสาขา/ลูกค้า' : 'Pick branch / customer'}
        </label>
        {loadingBranches ? (
          <div className="h-10 rounded-lg bg-surface-container animate-pulse" />
        ) : (
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{locale === 'th' ? '— เลือกสาขา —' : '— Select —'}</option>
            {branches
              .filter((b) => b.isActive)
              .map((b) => {
                const name = (locale === 'th' ? b.nameTh : b.nameEn) || b.nameTh || b.nameEn || b.code;
                const tag = b.customerType === 'external'
                  ? (locale === 'th' ? ' · ลูกค้านอก' : ' · External')
                  : '';
                return (
                  <option key={b.id} value={b.id}>
                    {b.code} {name}{tag}
                  </option>
                );
              })}
          </select>
        )}
        {selectedBranch && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {selectedBranch.code}
            </span>
            <span className={`px-2 py-0.5 rounded-full font-semibold ${
              customerType === 'external'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {customerType === 'external'
                ? (locale === 'th' ? 'ราคาลูกค้านอก' : 'External price')
                : (locale === 'th' ? 'ราคาลูกค้าใน' : 'Internal price')}
            </span>
          </div>
        )}
      </div>

      {/* Two-column layout: catalog + cart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Catalog */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={locale === 'th' ? 'ค้นหาสินค้า…' : 'Search products…'}
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'all' | ProductCategory)}
              className="px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {productCategoryLabels.map((c) => (
                <option key={c.key} value={c.key}>
                  {locale === 'th' ? c.th : c.en}
                </option>
              ))}
            </select>
          </div>

          {!selectedBranchId ? (
            <div className="rounded-xl border-2 border-dashed border-outline-variant/40 py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px]">storefront</span>
              <p className="mt-2 text-sm">
                {locale === 'th' ? 'เลือกสาขาก่อนเพื่อดูราคาที่ถูกต้อง' : 'Pick a branch to see correct pricing'}
              </p>
            </div>
          ) : loadingProducts ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-surface-container animate-pulse" />
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-6 text-center">
              {locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}
            </p>
          ) : (
            <div className="space-y-2">
              {visibleProducts.map((p) => {
                const qty = cart[p.id] ?? 0;
                const unitPrice = effectivePrice(p, customerType);
                const inCart = qty > 0;
                return (
                  <div
                    key={p.id}
                    className={`bg-surface-container-lowest rounded-xl p-3 flex items-center gap-3 border ${
                      inCart ? 'border-primary/40' : 'border-outline-variant/20'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant">
                        inventory_2
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {p.sku}
                      </p>
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {locale === 'th' ? p.nameTh : p.nameEn}
                      </p>
                      <p className="text-xs text-primary font-bold">
                        ฿{unitPrice.toLocaleString()}{' '}
                        <span className="font-normal text-on-surface-variant">
                          / {p.unit}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty - 1)}
                        disabled={!inCart}
                        className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center font-bold disabled:opacity-30"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        onChange={(e) =>
                          setQty(p.id, Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-12 h-8 text-center rounded-lg border border-outline-variant text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty + 1)}
                        className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart sidebar */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-3">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
            <h3 className="font-headline font-bold text-on-surface mb-3">
              {locale === 'th' ? `ตะกร้า (${cartCount} ชิ้น)` : `Cart (${cartCount} items)`}
            </h3>
            {cartLines.length === 0 ? (
              <p className="text-sm text-on-surface-variant py-6 text-center">
                {locale === 'th' ? 'ยังไม่มีสินค้า' : 'No items yet'}
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {cartLines.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setQty(l.product.id, 0)}
                      className="text-error hover:opacity-70 shrink-0"
                      aria-label="remove"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-on-surface truncate">
                        {locale === 'th' ? l.product.nameTh : l.product.nameEn}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {l.qty} × ฿{l.unitPrice.toLocaleString()}
                      </p>
                    </div>
                    <span className="font-semibold text-on-surface shrink-0">
                      ฿{formatBaht(l.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                {locale === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Notes (optional)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={locale === 'th' ? 'เช่น สั่งทางโทรศัพท์' : 'e.g. phoned in'}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Totals */}
            <div className="mt-4 pt-3 border-t border-outline-variant/40 space-y-1 text-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>{locale === 'th' ? 'ยอดก่อน VAT' : 'Subtotal'}</span>
                <span>฿{formatBaht(subtotal)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>VAT 7%</span>
                <span>฿{formatBaht(vat)}</span>
              </div>
              <div className="flex justify-between font-bold text-on-surface text-base pt-1 border-t border-outline-variant/40">
                <span>{locale === 'th' ? 'รวม' : 'Total'}</span>
                <span className="text-primary">฿{formatBaht(grandTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedBranch || cartLines.length === 0}
              className="w-full mt-4 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  {locale === 'th' ? 'กำลังบันทึก…' : 'Saving…'}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {locale === 'th' ? 'สร้างออเดอร์ (preparing)' : 'Create order (preparing)'}
                </>
              )}
            </button>
            {actor && (
              <p className="text-[11px] text-on-surface-variant text-center mt-2">
                {locale === 'th' ? 'รับโดย' : 'Accepted by'}: <span className="font-semibold">{actor.name}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
