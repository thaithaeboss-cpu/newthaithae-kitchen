'use client';

import { Fragment, useState, useEffect } from 'react';
import { useOrders, useBranches } from '@/lib/useFirestore';
import type { Order, OrderStatus } from '@/lib/firestore';
import { loadSettings, type AppSettings } from '@/lib/firestore';
import { useLanguage } from '@/lib/language-context';
import { useActor } from '@/lib/staff-context';
import Link from 'next/link';
import EditOrderItemsModal from '@/components/EditOrderItemsModal';

function formatCurrency(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ALL_STATUSES: OrderStatus[] = [
  'new',
  'processing',
  'preparing',
  'dispatched',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

export default function OrdersPage() {
  const { t, locale } = useLanguage();
  const { orders, loading } = useOrders();
  const { branches } = useBranches();
  const actor = useActor();

  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'total' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

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
          <tr><td colspan="2" style="padding:6px 12px;text-align:right;font-size:12px;color:#555;">${locale === 'th' ? 'ยอดก่อน GST' : 'Subtotal'}</td><td style="padding:6px 12px;text-align:right;">฿${formatCurrency(order.subtotal)}</td></tr>
          <tr><td colspan="2" style="padding:6px 12px;text-align:right;font-size:12px;color:#555;">GST 10%</td><td style="padding:6px 12px;text-align:right;">฿${formatCurrency(order.vat)}</td></tr>
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

  const filtered = orders
    .filter((o) => {
      const matchBranch = branchFilter === 'all' || o.branchId === branchFilter;
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const createdAtStr = typeof o.createdAt === 'string'
        ? o.createdAt
        : (o.createdAt as unknown as Date).toISOString();
      const matchDateFrom = !dateFrom || createdAtStr >= dateFrom;
      const matchDateTo = !dateTo || createdAtStr <= dateTo + 'T23:59:59Z';
      return matchBranch && matchStatus && matchDateFrom && matchDateTo;
    })
    .sort((a, b) => {
      const aCreated = typeof a.createdAt === 'string'
        ? a.createdAt
        : (a.createdAt as unknown as Date).toISOString();
      const bCreated = typeof b.createdAt === 'string'
        ? b.createdAt
        : (b.createdAt as unknown as Date).toISOString();
      let cmp = 0;
      if (sortField === 'date') cmp = aCreated.localeCompare(bCreated);
      else if (sortField === 'total') cmp = a.total - b.total;
      else cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const handleSort = (field: 'date' | 'total' | 'status') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIcon = (field: string) => {
    if (sortField !== field) return 'unfold_more';
    return sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  };

  const statusLabelMap: Record<OrderStatus, string> = {
    new: t('status_new'),
    processing: t('status_processing'),
    preparing: t('status_preparing'),
    dispatched: t('status_dispatched'),
    out_for_delivery: t('status_out_for_delivery'),
    delivered: t('status_delivered'),
    cancelled: t('status_cancelled'),
  };

  const statusBadge = (status: OrderStatus) => {
    const colorMap: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700',
      processing: 'bg-amber-100 text-amber-700',
      preparing: 'bg-purple-100 text-purple-700',
      dispatched: 'bg-indigo-100 text-indigo-700',
      out_for_delivery: 'bg-orange-100 text-orange-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${colorMap[status]}`}>
        {statusLabelMap[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Print-only header */}
      <div className="print-only hidden mb-6 pb-4 border-b-2 border-gray-800">
        <p className="text-xl font-bold">Thai Thae — {locale === 'th' ? 'ประวัติคำสั่งซื้อ' : 'Order History'}</p>
        <p className="text-sm text-gray-500 mt-1">
          {locale === 'th' ? 'พิมพ์เมื่อ: ' : 'Printed: '}
          {new Date().toLocaleString(locale === 'th' ? 'th-TH' : 'en-AU')}
          {' · '}{filtered.length} {locale === 'th' ? 'รายการ' : 'orders'}
          {' · '}฿{filtered.reduce((s, o) => s + o.total, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h1 className="text-2xl font-headline font-bold text-on-surface">{t('order_history_page')}</h1>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium border border-outline-variant/30 hover:opacity-90">
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t('export')}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium border border-outline-variant/30 hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            {t('print')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">{t('all_branches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} {locale === 'th' ? b.nameTh : (b.nameEn || b.nameTh)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
            className="px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">{t('all_statuses_filter')}</option>
            {ALL_STATUSES.map((key) => (
              <option key={key} value={key}>
                {statusLabelMap[key]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={t('date_from')}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={t('date_to')}
          />
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="flex items-center gap-4 text-sm text-on-surface-variant">
          <span>{t('total_x_items').replace('{count}', String(filtered.length))}</span>
          <span>{t('total_sum')} ฿{filtered.reduce((s, o) => s + o.total, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-high text-on-surface-variant">
                <th className="text-left px-4 py-3 font-semibold">{t('order_number')}</th>
                <th className="text-left px-4 py-3 font-semibold">{t('branch_col')}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('items_col')}</th>
                <th
                  className="text-right px-4 py-3 font-semibold cursor-pointer select-none"
                  onClick={() => handleSort('total')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('amount')}
                    <span className="material-symbols-outlined text-[14px]">{sortIcon('total')}</span>
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 font-semibold cursor-pointer select-none"
                  onClick={() => handleSort('date')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('date_col')}
                    <span className="material-symbols-outlined text-[14px]">{sortIcon('date')}</span>
                  </span>
                </th>
                <th
                  className="text-center px-4 py-3 font-semibold cursor-pointer select-none"
                  onClick={() => handleSort('status')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('status')}
                    <span className="material-symbols-outlined text-[14px]">{sortIcon('status')}</span>
                  </span>
                </th>
                <th className="text-center px-4 py-3 font-semibold">{t('payment_status')}</th>
                <th className="text-center px-4 py-3 font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {/* Loading skeleton rows */}
              {loading && (
                <>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <tr key={n} className="animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 w-24 bg-surface-container-high rounded" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 bg-surface-container-high rounded" /></td>
                      <td className="px-4 py-3 text-center"><div className="h-4 w-6 bg-surface-container-high rounded mx-auto" /></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-20 bg-surface-container-high rounded ml-auto" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-28 bg-surface-container-high rounded" /></td>
                      <td className="px-4 py-3 text-center"><div className="h-5 w-20 bg-surface-container-high rounded-full mx-auto" /></td>
                      <td className="px-4 py-3 text-center"><div className="h-5 w-16 bg-surface-container-high rounded-full mx-auto" /></td>
                      <td className="px-4 py-3 text-center"><div className="h-4 w-4 bg-surface-container-high rounded mx-auto" /></td>
                    </tr>
                  ))}
                </>
              )}

              {!loading && filtered.map((o) => {
                const createdAtStr = typeof o.createdAt === 'string'
                  ? o.createdAt
                  : (o.createdAt as unknown as Date).toISOString();
                return (
                  <Fragment key={o.id}>
                    <tr
                      className="hover:bg-surface-container-low transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-on-surface">{o.orderId}</td>
                      <td className="px-4 py-3 text-on-surface">{o.branchName}</td>
                      <td className="px-4 py-3 text-center text-on-surface-variant">{o.items.length}</td>
                      <td className="px-4 py-3 text-right font-medium text-on-surface">
                        ฿{o.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                        {new Date(createdAtStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(o.status)}</td>
                      <td className="px-4 py-3 text-center">
                        {o.invoiceNumber ? (
                          <Link
                            href="/admin/invoices"
                            onClick={(e) => e.stopPropagation()}
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              o.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                              o.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}
                          >
                            {o.paymentStatus === 'paid' ? t('status_paid') :
                             o.paymentStatus === 'partial' ? t('status_partial') :
                             t('status_unpaid')}
                          </Link>
                        ) : o.status !== 'cancelled' ? (
                          <span className="text-[10px] text-on-surface-variant">{t('uninvoiced')}</span>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                          {expandedId === o.id ? 'expand_less' : 'expand_more'}
                        </span>
                      </td>
                    </tr>
                    {expandedId === o.id && (
                      <tr key={`${o.id}-detail`}>
                        <td colSpan={8} className="px-4 py-4 bg-surface-container">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-on-surface mb-2">{t('order_items')}</h4>
                              <div className="space-y-1.5">
                                {o.items.map((item, idx) => {
                                  const displayName = locale === 'th' ? item.nameTh : (item.nameEn || item.nameTh);
                                  return (
                                    <div key={idx} className="flex justify-between text-sm p-2 bg-surface-container-lowest rounded-lg">
                                      <span className="text-on-surface">{displayName}</span>
                                      <span className="text-on-surface-variant">
                                        {item.quantity} {item.unit} x ฿{item.unitPrice} = <span className="font-medium text-on-surface">฿{item.total.toLocaleString()}</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-on-surface-variant">{t('subtotal_before_vat')}</span>
                                <span className="text-on-surface">฿{o.subtotal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-on-surface-variant">{t('vat_7')}</span>
                                <span className="text-on-surface">฿{o.vat.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-bold pt-2 border-t border-outline-variant/20">
                                <span className="text-on-surface">{t('grand_total')}</span>
                                <span className="text-primary">฿{o.total.toLocaleString()}</span>
                              </div>
                              {o.notes && (
                                <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-800">
                                  <span className="font-medium">{t('note_label')}:</span> {o.notes}
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); printOrderSlip(o); }}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                  <span className="material-symbols-outlined text-[16px]">print</span>
                                  {t('print')}
                                </button>
                                {o.status !== 'delivered' && o.status !== 'cancelled' && actor && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingOrder(o); }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                    {locale === 'th' ? 'แก้ไข/ลดรายการ' : 'Edit / reduce items'}
                                  </button>
                                )}
                                {o.invoiceNumber && (
                                  <Link
                                    href="/admin/invoices"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-surface-container-high transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                                    {o.invoiceNumber}
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Staff action history (audit trail) */}
                          {((o.timeline && o.timeline.length > 0) || o.acceptedByName || o.packedByName) && (
                            <div className="mt-4 pt-4 border-t border-outline-variant/30">
                              <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">history</span>
                                {t('action_history')}
                              </h4>
                              <div className="space-y-2">
                                {(o.timeline ?? [])
                                  .slice()
                                  .sort((a, b) => {
                                    const aDate = a.at instanceof Date ? a.at : new Date(a.at as unknown as string);
                                    const bDate = b.at instanceof Date ? b.at : new Date(b.at as unknown as string);
                                    return aDate.getTime() - bDate.getTime();
                                  })
                                  .map((entry, idx) => {
                                    const entryDate = entry.at instanceof Date ? entry.at : new Date(entry.at as unknown as string);
                                    const validDate = !isNaN(entryDate.getTime());
                                    const actionIcon: Record<string, string> = {
                                      accepted: 'how_to_reg',
                                      packed: 'inventory_2',
                                      dispatched: 'local_shipping',
                                      delivered: 'check_circle',
                                      cancelled: 'cancel',
                                      status_changed: 'sync',
                                      note: 'sticky_note_2',
                                    };
                                    const actionColor: Record<string, string> = {
                                      accepted: 'text-blue-600 bg-blue-50',
                                      packed: 'text-emerald-600 bg-emerald-50',
                                      dispatched: 'text-indigo-600 bg-indigo-50',
                                      delivered: 'text-green-600 bg-green-50',
                                      cancelled: 'text-red-600 bg-red-50',
                                      status_changed: 'text-gray-600 bg-gray-50',
                                      note: 'text-amber-600 bg-amber-50',
                                    };
                                    const actionLabel: Record<string, { th: string; en: string }> = {
                                      accepted: { th: 'รับออเดอร์', en: 'Accepted' },
                                      packed: { th: 'แพ็คเสร็จ', en: 'Packed' },
                                      dispatched: { th: 'จัดส่ง', en: 'Dispatched' },
                                      delivered: { th: 'ส่งถึงแล้ว', en: 'Delivered' },
                                      cancelled: { th: 'ยกเลิก', en: 'Cancelled' },
                                      status_changed: { th: 'เปลี่ยนสถานะ', en: 'Status changed' },
                                      note: { th: 'หมายเหตุ', en: 'Note' },
                                    };
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-start gap-3 text-sm p-2.5 bg-surface-container-lowest rounded-lg"
                                      >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${actionColor[entry.action] ?? 'text-gray-600 bg-gray-50'}`}>
                                          <span className="material-symbols-outlined text-[18px]">
                                            {actionIcon[entry.action] ?? 'circle'}
                                          </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-on-surface">
                                            {actionLabel[entry.action]?.[locale as 'th' | 'en'] ?? entry.action}
                                            {entry.staffName && (
                                              <span className="text-on-surface-variant font-normal"> · {entry.staffName}</span>
                                            )}
                                          </p>
                                          {entry.fromStatus && entry.toStatus && entry.fromStatus !== entry.toStatus && (
                                            <p className="text-xs text-on-surface-variant mt-0.5">
                                              {entry.fromStatus} → {entry.toStatus}
                                            </p>
                                          )}
                                          {entry.note && (
                                            <p className="text-xs text-on-surface-variant mt-0.5">{entry.note}</p>
                                          )}
                                        </div>
                                        {validDate && (
                                          <span className="text-[10px] text-on-surface-variant whitespace-nowrap">
                                            {entryDate.toLocaleString(locale === 'th' ? 'th-TH' : 'en-AU', {
                                              day: '2-digit',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                {(!o.timeline || o.timeline.length === 0) && (o.acceptedByName || o.packedByName) && (
                                  <>
                                    {o.acceptedByName && (
                                      <div className="flex items-center gap-2 text-sm p-2.5 bg-blue-50 rounded-lg text-blue-700">
                                        <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                                        <span className="font-medium">{t('accepted_by')}: {o.acceptedByName}</span>
                                      </div>
                                    )}
                                    {o.packedByName && (
                                      <div className="flex items-center gap-2 text-sm p-2.5 bg-emerald-50 rounded-lg text-emerald-700">
                                        <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                                        <span className="font-medium">{t('packed_by')}: {o.packedByName}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingOrder && actor && (
        <EditOrderItemsModal
          order={editingOrder}
          actor={actor}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}
