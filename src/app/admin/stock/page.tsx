'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProducts, useStockAdjustments } from '@/lib/useFirestore';
import { updateStock } from '@/lib/firestore';
import { useLanguage } from '@/lib/language-context';

const stockMovement = [
  { month: 'ก.ค.', inbound: 450, outbound: 380 },
  { month: 'ส.ค.', inbound: 520, outbound: 410 },
  { month: 'ก.ย.', inbound: 480, outbound: 420 },
  { month: 'ต.ค.', inbound: 550, outbound: 460 },
  { month: 'พ.ย.', inbound: 600, outbound: 510 },
  { month: 'ธ.ค.', inbound: 180, outbound: 120 },
];

export default function StockPage() {
  const { t, locale } = useLanguage();
  const { products, loading: loadingProducts } = useProducts();
  const { adjustments, loading: loadingAdjustments } = useStockAdjustments(20);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [adjType, setAdjType] = useState<'add' | 'remove' | 'count'>('add');
  const [adjQuantity, setAdjQuantity] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Compute stats from live products list
  const totalProducts = products.length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  const maxMovement = Math.max(...stockMovement.map((m) => Math.max(m.inbound, m.outbound)));

  // Each card deep-links into /admin/products with the matching stock filter
  // so users land on a pre-filtered list of products they care about.
  const overviewCards: {
    label: string;
    value: number;
    icon: string;
    color: string;
    href: string;
  }[] = [
    {
      label: t('total_products'),
      value: totalProducts,
      icon: 'inventory_2',
      color: 'bg-blue-100 text-blue-700',
      href: '/admin/products/',
    },
    {
      label: t('low_stock'),
      value: lowStock,
      icon: 'trending_down',
      color: 'bg-amber-100 text-amber-700',
      href: '/admin/products/?stock=low_stock',
    },
    {
      label: t('out_of_stock'),
      value: outOfStock,
      icon: 'remove_shopping_cart',
      color: 'bg-red-100 text-red-700',
      href: '/admin/products/?stock=out_of_stock',
    },
  ];

  const handleSubmitAdjustment = async () => {
    if (!selectedProduct || adjQuantity <= 0) return;
    setSaving(true);
    try {
      // Map UI type to signed quantity: 'remove' becomes negative, 'count' is absolute replacement handled by updateStock
      const signedQty = adjType === 'remove' ? -adjQuantity : adjQuantity;
      const reasonText = adjReason + (adjNotes ? ` — ${adjNotes}` : '');
      await updateStock(selectedProduct, signedQty, reasonText);
      setSelectedProduct('');
      setAdjQuantity(0);
      setAdjReason('');
      setAdjNotes('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (type: string) => {
    if (type === 'add' || type === 'in') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">{t('add_stock')}</span>;
    if (type === 'remove' || type === 'out') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">{t('remove_stock')}</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">{t('stock_count')}</span>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-headline font-bold text-on-surface">{t('stock_management')}</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {loadingProducts
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-surface-container-high rounded-xl h-28" />
            ))
          : overviewCards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="group bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-lg ${c.color} flex items-center justify-center mb-3`}>
                    <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant/40 group-hover:text-primary transition-colors">
                    arrow_outward
                  </span>
                </div>
                <p className="text-2xl font-bold text-on-surface">{c.value}</p>
                <p className="text-sm text-on-surface-variant mt-1">{c.label}</p>
              </Link>
            ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Stock Adjustment Form */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
          <h2 className="text-lg font-headline font-bold text-on-surface mb-4">{t('stock_adjustment')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">{t('select_product_placeholder')}</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">-- {t('select_product_placeholder')} --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameTh} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">{t('adjustment_type')}</label>
              <div className="flex gap-2">
                {(['add', 'remove', 'count'] as const).map((adjOption) => (
                  <button
                    key={adjOption}
                    onClick={() => setAdjType(adjOption)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      adjType === adjOption
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface border-outline-variant/50 text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {adjOption === 'add' ? t('add_stock') : adjOption === 'remove' ? t('remove_stock') : t('stock_count')}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('quantity')}</label>
                <input
                  type="number"
                  value={adjQuantity}
                  onChange={(e) => setAdjQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('reason')}</label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="เช่น รับสินค้าเข้า"
                  className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">{t('adjustment_notes')}</label>
              <textarea
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={handleSubmitAdjustment}
              disabled={saving}
              className="w-full py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (locale === 'th' ? 'กำลังบันทึก...' : 'Saving...') : t('save_adjustment')}
            </button>
          </div>
        </div>

        {/* Stock Movement Chart */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
          <h2 className="text-lg font-headline font-bold text-on-surface mb-4">{t('stock_movement')}</h2>
          <div className="flex items-center gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-on-surface-variant">{t('inbound')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-tertiary" />
              <span className="text-on-surface-variant">{t('outbound')}</span>
            </div>
          </div>
          <div className="flex items-end gap-4 h-48">
            {stockMovement.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex gap-1 items-end w-full justify-center" style={{ height: '160px' }}>
                  <div
                    className="w-1/3 bg-primary rounded-t-sm"
                    style={{ height: `${(m.inbound / maxMovement) * 140}px` }}
                  />
                  <div
                    className="w-1/3 bg-tertiary rounded-t-sm"
                    style={{ height: `${(m.outbound / maxMovement) * 140}px` }}
                  />
                </div>
                <span className="text-xs text-on-surface-variant">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Adjustments Log */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/20">
          <h2 className="text-lg font-headline font-bold text-on-surface">{t('adjustment_history')}</h2>
        </div>
        {loadingAdjustments ? (
          <div className="p-6 space-y-3">
            <div className="animate-pulse bg-surface-container-high rounded-xl h-16" />
            <div className="animate-pulse bg-surface-container-high rounded-xl h-16" />
            <div className="animate-pulse bg-surface-container-high rounded-xl h-16" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant">
                  <th className="text-left px-4 py-3 font-semibold">{t('todays_date')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{locale === 'th' ? 'สินค้า' : 'Product'}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t('adjustment_type')}</th>
                  <th className="text-right px-4 py-3 font-semibold">{t('quantity')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('reason')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{locale === 'th' ? 'ผู้ดำเนินการ' : 'Operator'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {adjustments.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-on-surface">{a.productName}</td>
                    <td className="px-4 py-3 text-center">{typeLabel(a.type)}</td>
                    <td className="px-4 py-3 text-right font-medium text-on-surface">
                      {a.type === 'add' ? '+' : a.type === 'remove' ? '-' : ''}{Math.abs(a.quantity)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{a.reason}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{a.performedBy}</td>
                  </tr>
                ))}
                {adjustments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant text-sm">
                      {locale === 'th' ? 'ยังไม่มีประวัติการปรับสต็อก' : 'No adjustment history yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
