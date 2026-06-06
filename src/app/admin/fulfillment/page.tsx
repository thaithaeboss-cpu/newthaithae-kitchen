'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useOrders, useBranches } from '@/lib/useFirestore';
import { updateOrderStatus, loadSettings } from '@/lib/firestore';
import type { Order, OrderStatus, AppSettings } from '@/lib/firestore';
import { useLanguage } from '@/lib/language-context';
import { useActor } from '@/lib/staff-context';
import type { TranslationKey } from '@/lib/i18n';
import EditOrderItemsModal from '@/components/EditOrderItemsModal';

type FulfillmentTab = 'new' | 'preparing' | 'dispatched';

const tabConfig: { key: FulfillmentTab; labelKey: TranslationKey; statuses: OrderStatus[] }[] = [
  { key: 'new', labelKey: 'new_orders', statuses: ['new', 'processing'] },
  { key: 'preparing', labelKey: 'preparing', statuses: ['preparing'] },
  { key: 'dispatched', labelKey: 'dispatched', statuses: ['dispatched', 'out_for_delivery'] },
];

function getUrgencyTag(order: Order): { labelKey: TranslationKey; bg: string } {
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
  if (order.total > 10000 || totalItems > 40) {
    return { labelKey: 'high_volume', bg: 'bg-amber-100 text-amber-700' };
  }
  const created = new Date(order.createdAt as unknown as string);
  const est = order.estimatedDelivery ? new Date(order.estimatedDelivery as unknown as string) : null;
  if (est && est.getTime() - created.getTime() < 6 * 3600 * 1000) {
    return { labelKey: 'urgent', bg: 'bg-red-100 text-red-700' };
  }
  return { labelKey: 'standard', bg: 'bg-blue-100 text-blue-700' };
}

const itemColors = [
  'bg-emerald-400', 'bg-amber-400', 'bg-blue-400', 'bg-rose-400',
  'bg-purple-400', 'bg-teal-400', 'bg-orange-400', 'bg-cyan-400',
];

function formatCurrency(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(dateVal: unknown) {
  const d = new Date(dateVal as string);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateVal: unknown) {
  const d = new Date(dateVal as string);
  return d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
}

export default function FulfillmentPage() {
  const { t, locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<FulfillmentTab>('new');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  // When true, clicking the "preparing" card also opens a roll-up modal
  // so the kitchen can see total qty per product across every preparing
  // order in one glance.
  const [showPreparingSummary, setShowPreparingSummary] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const { orders, loading: loadingOrders } = useOrders();
  const { branches } = useBranches();
  const actor = useActor();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const getBranchCode = (branchId: string): string => {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.code ?? '#???';
  };

  const ordersByTab = useMemo(() => {
    const grouped: Record<FulfillmentTab, Order[]> = { new: [], preparing: [], dispatched: [] };
    for (const order of orders) {
      for (const tab of tabConfig) {
        if (tab.statuses.includes(order.status)) {
          grouped[tab.key].push(order);
        }
      }
    }
    return grouped;
  }, [orders]);

  // Roll up every line item across all "preparing" orders so the kitchen
  // can see total demand per product in one shot, sorted by quantity desc.
  const preparingSummary = useMemo(() => {
    type Bucket = {
      productId: string;
      nameTh: string;
      nameEn: string;
      unit: string;
      totalQty: number;
      orderCount: number;
      branches: Set<string>;
    };
    const map = new Map<string, Bucket>();
    for (const order of ordersByTab.preparing) {
      for (const item of order.items) {
        const key = item.productId;
        const bucket = map.get(key);
        if (bucket) {
          bucket.totalQty += item.quantity;
          bucket.orderCount += 1;
          bucket.branches.add(order.branchName);
        } else {
          map.set(key, {
            productId: key,
            nameTh: item.nameTh,
            nameEn: item.nameEn,
            unit: item.unit,
            totalQty: item.quantity,
            orderCount: 1,
            branches: new Set([order.branchName]),
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [ordersByTab.preparing]);

  const filteredOrders = useMemo(() => {
    let result = ordersByTab[activeTab];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (o) => o.orderId.toLowerCase().includes(q) || o.branchName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeTab, ordersByTab, searchQuery]);

  const completedToday = orders.filter((o) => o.status === 'delivered').length;

  // Each stat card is now interactive. The first three switch the tab
  // below; "completed today" deep-links into /admin/orders pre-filtered
  // to delivered (there's no completed tab in this page on purpose).
  const stats: {
    label: string;
    count: number;
    icon: string;
    color: string;
    action: { kind: 'tab'; tab: FulfillmentTab } | { kind: 'link'; href: string };
  }[] = [
    {
      label: t('new_orders'),
      count: ordersByTab.new.length,
      icon: 'inbox',
      color: 'text-blue-600 bg-blue-50',
      action: { kind: 'tab', tab: 'new' },
    },
    {
      label: t('preparing'),
      count: ordersByTab.preparing.length,
      icon: 'skillet',
      color: 'text-amber-600 bg-amber-50',
      action: { kind: 'tab', tab: 'preparing' },
    },
    {
      label: t('out_for_delivery'),
      count: ordersByTab.dispatched.length,
      icon: 'local_shipping',
      color: 'text-indigo-600 bg-indigo-50',
      action: { kind: 'tab', tab: 'dispatched' },
    },
    {
      label: t('completed_today'),
      count: completedToday,
      icon: 'check_circle',
      color: 'text-emerald-600 bg-emerald-50',
      action: { kind: 'link', href: '/admin/orders/?status=delivered' },
    },
  ];

  const toggleCheck = (orderId: string, itemIndex: number) => {
    const key = `${orderId}-${itemIndex}`;
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  function printOrderSlip(order: Order) {
    const rows = order.items.map((item) => {
      const name = locale === 'th' ? item.nameTh : (item.nameEn || item.nameTh);
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity} ${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">฿${formatCurrency(item.total)}</td>
      </tr>`;
    }).join('');

    const createdDate = new Date(order.createdAt as unknown as string)
      .toLocaleString(locale === 'th' ? 'th-TH' : 'en-AU');

    const branch = branches.find((b) => b.id === order.branchId);
    const branchAddress = branch?.address ?? '';
    const branchPhone = branch?.phone ?? '';

    const co = settings;
    const bankHtml = (co?.bankAccountNumber)
      ? `<div style="margin-top:10px;padding:5px 10px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;font-size:10px;line-height:1.5;color:#374151;">
          <span style="font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.04em;margin-right:6px;">${locale === 'th' ? 'การชำระ' : 'Payment'}</span>
          ${[
            co.bankName ? `<strong>${co.bankName}</strong>` : null,
            co.bankAccountName,
            co.bankBsb ? `BSB <span style="font-family:monospace;">${co.bankBsb}</span>` : null,
            `${locale === 'th' ? 'เลข' : 'Acct'} <span style="font-family:monospace;font-weight:700;color:#166534;">${co.bankAccountNumber}</span>`,
          ].filter(Boolean).join(' · ')}
        </div>`
      : '';

    const logoHtml = co?.logoUrl
      ? `<img src="${co.logoUrl}" alt="logo" style="height:56px;object-fit:contain;"/>`
      : '';
    const coName = co?.companyName ?? 'Thai Thae';
    const coAddress = co?.companyAddress ?? '';
    const coTaxId = co?.taxId ?? '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Order ${order.orderId}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: sans-serif; font-size: 13px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #111; margin-bottom: 20px; }
        .company { flex: 1; }
        .company h1 { margin: 0 0 2px; font-size: 18px; }
        .company p { margin: 2px 0; font-size: 12px; color: #555; }
        .order-title { text-align: right; }
        .order-title h2 { margin: 0 0 4px; font-size: 22px; color: #00342b; }
        .order-title p { margin: 2px 0; font-size: 12px; color: #555; }
        .bill-section { display: flex; gap: 32px; margin-bottom: 20px; }
        .bill-box { flex: 1; background: #f9fafb; border-radius: 8px; padding: 12px 14px; }
        .bill-box h4 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #888; }
        .bill-box p { margin: 2px 0; font-size: 13px; font-weight: 600; }
        .bill-box .sub { font-weight: 400; color: #555; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #f3f4f6; }
        th { padding: 8px 12px; text-align: left; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing:.05em; }
        .total-row td { padding: 12px 12px; font-weight: bold; font-size: 15px; border-top: 2px solid #111; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #888; text-align: center; }
        @page { margin: 15mm; size: A4; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <div class="header">
        <div class="company">
          ${logoHtml}
          <h1 style="margin-top:${co?.logoUrl ? '8px' : '0'}">${coName}</h1>
          ${coAddress ? `<p>${coAddress}</p>` : ''}
          ${coTaxId ? `<p>ABN / Tax ID: ${coTaxId}</p>` : ''}
        </div>
        <div class="order-title">
          <h2>${locale === 'th' ? 'ใบสั่งซื้อ' : 'Purchase Order'}</h2>
          <p><strong>#${order.orderId}</strong></p>
          <p>${createdDate}</p>
        </div>
      </div>

      <div class="bill-section">
        <div class="bill-box">
          <h4>${locale === 'th' ? 'จาก (ผู้ขาย)' : 'From (Supplier)'}</h4>
          <p>${coName}</p>
          ${coAddress ? `<p class="sub">${coAddress}</p>` : ''}
        </div>
        <div class="bill-box">
          <h4>${locale === 'th' ? 'ถึง (สาขา)' : 'Bill To (Branch)'}</h4>
          <p>${order.branchName}</p>
          ${branchAddress ? `<p class="sub">${branchAddress}</p>` : ''}
          ${branchPhone ? `<p class="sub">Tel: ${branchPhone}</p>` : ''}
        </div>
      </div>

      <table>
        <thead><tr>
          <th>${locale === 'th' ? 'รายการสินค้า' : 'Item'}</th>
          <th style="text-align:center">${locale === 'th' ? 'จำนวน' : 'Qty'}</th>
          <th style="text-align:right">${locale === 'th' ? 'ราคา' : 'Amount'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2" style="text-align:right">${locale === 'th' ? 'รวมทั้งสิ้น' : 'Grand Total'}</td>
            <td style="text-align:right;color:#00342b;">฿${formatCurrency(order.total)}</td>
          </tr>
        </tfoot>
      </table>
      ${order.notes ? `<div style="margin-top:16px;padding:10px 14px;background:#fffbeb;border-radius:6px;font-size:12px;color:#92400e;"><strong>${locale === 'th' ? 'หมายเหตุ' : 'Note'}:</strong> ${order.notes}</div>` : ''}
      ${bankHtml}
      <div class="footer">${coName}${coTaxId ? ` &nbsp;·&nbsp; ABN/Tax ID: ${coTaxId}` : ''} &nbsp;·&nbsp; ${locale === 'th' ? 'พิมพ์เมื่อ' : 'Printed'}: ${new Date().toLocaleString(locale === 'th' ? 'th-TH' : 'en-AU')}</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
  }

  // Print the kitchen prep sheet — a rolled-up list of every product
  // needed across every preparing order. Kept intentionally simple so
  // it's readable at a glance from across the prep area.
  function printPreparingSummary() {
    if (preparingSummary.length === 0) return;
    const co = settings;
    const coName = co?.companyName ?? 'Thai Thae';
    const logoHtml = co?.logoUrl
      ? `<img src="${co.logoUrl}" alt="logo" style="height:48px;object-fit:contain;"/>`
      : '';
    const now = new Date().toLocaleString(locale === 'th' ? 'th-TH' : 'en-AU');
    const orderCount = ordersByTab.preparing.length;
    const grandQty = preparingSummary.reduce((s, b) => s + b.totalQty, 0);

    const rows = preparingSummary
      .map((b, idx) => {
        const name = locale === 'th' ? b.nameTh : (b.nameEn || b.nameTh);
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;width:40px;text-align:center;color:#888;">${idx + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:18px;font-weight:700;">${b.totalQty}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#666;width:60px;">${b.unit}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${locale === 'th' ? 'ยอดรวมที่ต้องเตรียม' : 'Prep Summary'}</title>
      <style>
        * { box-sizing: border-box; }
        @page { size: A4; margin: 18mm; }
        body { font-family: sans-serif; font-size: 14px; color: #111; margin: 0; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #111; margin-bottom: 16px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
        .header .meta { font-size: 11px; color: #555; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background:#f3f4f6; padding:8px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#555; }
        .summary { margin-top: 16px; padding: 10px 12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; font-size:12px; color:#166534; display:flex; justify-content:space-between; }
        .footer { margin-top:20px; padding-top:10px; border-top:1px solid #e5e7eb; font-size:10px; color:#888; }
      </style>
    </head><body>
      <div class="header">
        <div>
          <h1>${locale === 'th' ? 'ยอดรวมที่ต้องเตรียม' : 'Kitchen Prep Summary'}</h1>
          <div class="meta">
            ${locale === 'th' ? 'พิมพ์เมื่อ' : 'Printed'}: ${now}
            &nbsp;·&nbsp;
            ${orderCount} ${locale === 'th' ? 'ออเดอร์' : 'orders'}
            &nbsp;·&nbsp;
            ${preparingSummary.length} ${locale === 'th' ? 'รายการสินค้า' : 'products'}
          </div>
        </div>
        ${logoHtml}
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;text-align:center;">#</th>
            <th>${locale === 'th' ? 'รายการสินค้า' : 'Product'}</th>
            <th style="text-align:right;">${locale === 'th' ? 'จำนวน' : 'Qty'}</th>
            <th>${locale === 'th' ? 'หน่วย' : 'Unit'}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <span>${locale === 'th' ? 'รวมทั้งหมด' : 'Grand total'}: <strong>${preparingSummary.length}</strong> ${locale === 'th' ? 'รายการ' : 'products'}</span>
        <span>${locale === 'th' ? 'รวมจำนวนชิ้น' : 'Total units'}: <strong>${grandQty}</strong></span>
      </div>
      <div class="footer">${coName} &nbsp;·&nbsp; ${locale === 'th' ? 'รายการอัปเดตทุกครั้งที่มีออเดอร์เปลี่ยนสถานะ' : 'List updates whenever order statuses change'}</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <p className="text-xs font-bold tracking-widest text-on-surface-variant/60 uppercase">
          {t('order_management')}
        </p>
        <h1 className="text-3xl font-headline font-bold text-on-surface mt-1">
          {t('order_fulfillment_title')}
        </h1>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const innerContent = (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-on-surface-variant font-medium">{stat.label}</p>
                <p className="text-2xl font-headline font-bold text-on-surface mt-1">
                  {stat.count}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                <span className="material-symbols-outlined text-[22px]">{stat.icon}</span>
              </div>
            </div>
          );
          const isActiveTab =
            stat.action.kind === 'tab' && stat.action.tab === activeTab;
          const baseClass = `group bg-surface-container-lowest rounded-xl p-4 border text-left transition-all hover:shadow-md hover:border-primary/40 ${
            isActiveTab ? 'border-primary/60 ring-2 ring-primary/10' : 'border-outline-variant/30'
          }`;
          return stat.action.kind === 'tab' ? (
            <button
              key={stat.label}
              type="button"
              onClick={() => {
                if (stat.action.kind !== 'tab') return;
                setActiveTab(stat.action.tab);
                // The "preparing" card additionally pops a roll-up modal
                // so the kitchen can see total demand at a glance.
                if (stat.action.tab === 'preparing') setShowPreparingSummary(true);
              }}
              className={baseClass}
            >
              {innerContent}
            </button>
          ) : (
            <Link
              key={stat.label}
              href={stat.action.href}
              className={baseClass}
            >
              {innerContent}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          type="text"
          placeholder={t('search_order_or_branch')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-outline-variant/30">
        <nav className="flex gap-6">
          {tabConfig.map((tab) => {
            const count = ordersByTab[tab.key].length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  relative pb-3 text-sm font-medium transition-colors flex items-center gap-2
                  ${isActive
                    ? 'text-on-surface font-bold border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                  }
                `}
              >
                {t(tab.labelKey)}
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold
                    ${isActive ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}
                  `}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Order Cards */}
      <div className="space-y-4">
        {/* Loading skeleton */}
        {loadingOrders && (
          <>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-24 bg-surface-container-high rounded-lg" />
                  <div className="h-6 w-16 bg-surface-container-high rounded-lg" />
                </div>
                <div className="h-6 w-48 bg-surface-container-high rounded-lg mt-3" />
                <div className="h-4 w-32 bg-surface-container-high rounded-lg mt-2" />
                <div className="flex items-center justify-between mt-4">
                  <div className="h-10 w-16 bg-surface-container-high rounded-lg" />
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-surface-container-high" />
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <div className="flex-1 h-12 bg-surface-container-high rounded-xl" />
                  <div className="flex-1 h-12 bg-surface-container-high rounded-xl" />
                </div>
              </div>
            ))}
          </>
        )}

        {!loadingOrders && filteredOrders.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-10 text-center border border-outline-variant/30">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
              package_2
            </span>
            <p className="mt-2 text-on-surface-variant">{t('no_orders_in_tab')}</p>
          </div>
        )}

        {!loadingOrders && filteredOrders.map((order) => {
          const urgency = getUrgencyTag(order);
          const branchCode = getBranchCode(order.branchId);
          const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
          const isExpanded = expandedOrder === order.id;
          const previewItems = order.items.slice(0, 4);
          const moreCount = order.items.length - 4;

          return (
            <div
              key={order.id}
              className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 transition-shadow hover:shadow-md"
            >
              {/* Top Row: Branch badge + urgency */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container text-xs font-bold text-on-surface-variant tracking-wide">
                  <span className="material-symbols-outlined text-[14px]">store</span>
                  {t('branch')} {branchCode}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${urgency.bg}`}>
                  {t(urgency.labelKey)}
                </span>
                <span className="ml-auto text-xs text-on-surface-variant">
                  {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                </span>
              </div>

              {/* Branch Name & Order ID */}
              <h3 className="text-xl font-headline font-bold text-on-surface mt-3">
                {order.branchName}
              </h3>
              <p className="text-sm text-on-surface-variant mt-0.5">
                #{order.orderId}
              </p>

              {/* Items Count + Preview */}
              <div className="flex items-center justify-between mt-4">
                <div>
                  <p className="text-2xl font-headline font-bold text-on-surface">
                    {totalItems}
                  </p>
                  <p className="text-xs text-on-surface-variant">{t('total_items')}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  {previewItems.map((item, i) => {
                    const displayName = locale === 'th' ? item.nameTh : (item.nameEn || item.nameTh);
                    return (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-full ${itemColors[i % itemColors.length]} flex items-center justify-center text-white text-[10px] font-bold`}
                        title={displayName}
                      >
                        {displayName.charAt(0)}
                      </div>
                    );
                  })}
                  {moreCount > 0 && (
                    <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-[10px] font-bold">
                      +{moreCount}
                    </div>
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">{t('order_total')}</span>
                <span className="font-headline font-bold text-on-surface">
                  ฿{formatCurrency(order.total)}
                </span>
              </div>

              {/* Staff action badges */}
              {(order.acceptedByName || order.packedByName || order.deliveredByName) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.acceptedByName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                      <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                      {t('accepted_by')}: {order.acceptedByName}
                      {order.acceptedAt && (
                        <span className="text-blue-500/70 font-normal">
                          · {formatTime(order.acceptedAt)}
                        </span>
                      )}
                    </span>
                  )}
                  {order.packedByName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
                      <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                      {t('packed_by')}: {order.packedByName}
                      {order.packedAt && (
                        <span className="text-emerald-500/70 font-normal">
                          · {formatTime(order.packedAt)}
                        </span>
                      )}
                    </span>
                  )}
                  {order.deliveredByName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold">
                      <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                      {t('delivered_by')}: {order.deliveredByName}
                      {order.deliveredAt && (
                        <span className="text-purple-500/70 font-normal">
                          · {formatTime(order.deliveredAt)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                {activeTab === 'new' && (
                  <>
                    <button
                      onClick={async () => { await updateOrderStatus(order.id, 'preparing', actor ?? undefined); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[20px]">check</span>
                      {t('accept_order')}
                    </button>
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-outline-variant text-on-surface font-semibold text-sm hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">list_alt</span>
                      {t('view_items_list')}
                    </button>
                  </>
                )}
                {activeTab === 'preparing' && (
                  <>
                    <button
                      onClick={async () => { await updateOrderStatus(order.id, 'dispatched', actor ?? undefined); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                      {t('mark_ready')}
                    </button>
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-outline-variant text-on-surface font-semibold text-sm hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">list_alt</span>
                      {t('view_items_list')}
                    </button>
                  </>
                )}
                {activeTab === 'dispatched' && (
                  <>
                    <button
                      onClick={async () => { await updateOrderStatus(order.id, 'delivered', actor ?? undefined); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      {t('mark_delivered')}
                    </button>
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-outline-variant text-on-surface font-semibold text-sm hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">pin_drop</span>
                      {t('track_delivery')}
                    </button>
                  </>
                )}
              </div>

              {/* Expanded Items Modal/Drawer */}
              {isExpanded && (
                <div className="mt-5 pt-5 border-t border-outline-variant/50">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">checklist</span>
                      {t('items_checklist')} - #{order.orderId}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      {order.status !== 'delivered' && order.status !== 'cancelled' && actor && (
                        <button
                          type="button"
                          onClick={() => setEditingOrder(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          {locale === 'th' ? 'แก้ไขรายการ' : 'Edit items'}
                        </button>
                      )}
                      <button
                        onClick={() => printOrderSlip(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        {t('print_order')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {order.items.map((item, i) => {
                      const checkKey = `${order.id}-${i}`;
                      const isChecked = checkedItems.has(checkKey);
                      const displayName = locale === 'th' ? item.nameTh : (item.nameEn || item.nameTh);
                      return (
                        <button
                          key={i}
                          onClick={() => toggleCheck(order.id, i)}
                          className={`
                            w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
                            ${isChecked ? 'bg-primary-fixed/30' : 'bg-surface-container hover:bg-surface-container-high'}
                          `}
                        >
                          <div
                            className={`
                              w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                              ${isChecked
                                ? 'bg-primary border-primary'
                                : 'border-outline-variant'
                              }
                            `}
                          >
                            {isChecked && (
                              <span className="material-symbols-outlined text-on-primary text-[16px]">
                                check
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isChecked ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                              {displayName}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${isChecked ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                              {item.quantity} {item.unit}
                            </p>
                            <p className="text-xs text-on-surface-variant">
                              ฿{formatCurrency(item.total)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Progress */}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{
                          width: `${(order.items.filter((_, i) => checkedItems.has(`${order.id}-${i}`)).length / order.items.length) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-on-surface-variant shrink-0">
                      {order.items.filter((_, i) => checkedItems.has(`${order.id}-${i}`)).length}/{order.items.length} items
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="mt-4 p-3 bg-surface-container rounded-lg flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">{t('order_total')}</span>
                    <span className="font-headline font-bold text-on-surface">
                      ฿{formatCurrency(order.total)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingOrder && actor && (
        <EditOrderItemsModal
          order={editingOrder}
          actor={actor}
          onClose={() => setEditingOrder(null)}
        />
      )}

      {showPreparingSummary && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPreparingSummary(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 shrink-0">
              <div>
                <h2 className="text-lg font-headline font-bold text-on-surface">
                  {locale === 'th' ? 'ยอดรวมที่ต้องเตรียม' : 'Total to prepare'}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  {locale === 'th'
                    ? `${ordersByTab.preparing.length} ออเดอร์ · ${preparingSummary.length} รายการสินค้า`
                    : `${ordersByTab.preparing.length} orders · ${preparingSummary.length} products`}
                </p>
              </div>
              <button
                onClick={() => setShowPreparingSummary(false)}
                className="p-1 rounded-lg hover:bg-surface-container-high"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {preparingSummary.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-[40px]">
                    skillet
                  </span>
                  <p className="text-sm text-on-surface-variant mt-2">
                    {locale === 'th' ? 'ไม่มีออเดอร์ที่กำลังเตรียม' : 'No orders preparing right now'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {preparingSummary.map((b, idx) => {
                    const displayName = locale === 'th' ? b.nameTh : (b.nameEn || b.nameTh);
                    return (
                      <div
                        key={b.productId}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-container-low transition-colors"
                      >
                        <span className="w-6 text-center text-xs font-bold text-on-surface-variant tabular-nums shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">
                            {displayName}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">
                            {b.orderCount} {locale === 'th' ? 'ออเดอร์' : 'orders'}
                            {' · '}
                            {b.branches.size} {locale === 'th' ? 'สาขา' : 'branches'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-headline font-bold text-primary text-lg leading-tight">
                            {b.totalQty}
                          </p>
                          <p className="text-[11px] text-on-surface-variant -mt-0.5">{b.unit}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-outline-variant/20 px-5 py-3 shrink-0 flex gap-2">
              <button
                type="button"
                onClick={printPreparingSummary}
                disabled={preparingSummary.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                {locale === 'th' ? 'พิมพ์' : 'Print'}
              </button>
              <button
                type="button"
                onClick={() => setShowPreparingSummary(false)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90"
              >
                {locale === 'th' ? 'ปิด' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
