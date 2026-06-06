'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useOrders, useBranches } from '@/lib/useFirestore';
import { useBranchContext } from '@/lib/branch-context';
import type { OrderStatus, Order } from '@/lib/firestore';
import EditOrderItemsModal from '@/components/EditOrderItemsModal';

const statusOrder: OrderStatus[] = ['new', 'processing', 'preparing', 'dispatched', 'out_for_delivery', 'delivered'];

function getStepIndex(status: OrderStatus): number {
  if (status === 'cancelled') return -1;
  return statusOrder.indexOf(status);
}

const ITEMS_PER_PAGE = 5;

function formatCurrency(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HistoryPage() {
  const { t, locale } = useLanguage();
  const { branchId } = useBranchContext();
  const { orders, loading } = useOrders({ branchId });
  const { branches } = useBranches();
  const currentBranch = branches.find((b) => b.id === branchId);
  // Identify the editing actor on the branch side. Branch users don't
  // have a /staff/{uid} record, so we surface the branch name + id.
  const branchActor = currentBranch
    ? { uid: currentBranch.id, name: currentBranch.nameTh || currentBranch.nameEn || currentBranch.code }
    : null;
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Support deep-linking from the home page: /history?order=CK-00015
  // auto-expands the matching card and scrolls to it once orders load.
  const highlightedOrderId = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    if (orderId) highlightedOrderId.current = orderId;
  }, []);

  useEffect(() => {
    const target = highlightedOrderId.current;
    if (!target || loading || orders.length === 0) return;
    const match = orders.find((o) => o.orderId === target);
    if (!match) return;
    setExpandedOrders((prev) => {
      if (prev.has(match.id)) return prev;
      const next = new Set(prev);
      next.add(match.id);
      return next;
    });
    // Scroll after the card re-renders expanded
    const tid = window.setTimeout(() => {
      document.getElementById(`order-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    // Consume the deep-link so revisiting/filtering doesn't re-scroll
    highlightedOrderId.current = null;
    return () => window.clearTimeout(tid);
  }, [loading, orders]);

  const dateLocale = locale === 'th' ? 'th-TH' : 'en-US';

  function formatDate(dateVal: Date | string) {
    const d = new Date(dateVal as string);
    return d.toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatTime(dateVal: Date | string) {
    const d = new Date(dateVal as string);
    return d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
  }

  const statusTabs: { label: string; value: OrderStatus | 'all' }[] = [
    { label: t('all_statuses'), value: 'all' },
    { label: t('status_processing'), value: 'processing' },
    { label: t('status_preparing'), value: 'preparing' },
    { label: t('status_dispatched'), value: 'dispatched' },
    { label: t('status_delivered'), value: 'delivered' },
    { label: t('status_cancelled'), value: 'cancelled' },
  ];

  const statusConfig: Record<OrderStatus, { label: string; bg: string; icon: string }> = {
    new: { label: t('status_new'), bg: 'bg-blue-100 text-blue-800', icon: 'fiber_new' },
    processing: { label: t('status_processing'), bg: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', icon: 'pending' },
    preparing: { label: t('status_preparing'), bg: 'bg-amber-100 text-amber-800', icon: 'skillet' },
    dispatched: { label: t('status_dispatched'), bg: 'bg-secondary-container text-on-secondary-container', icon: 'local_shipping' },
    out_for_delivery: { label: t('status_out_for_delivery'), bg: 'bg-indigo-100 text-indigo-800', icon: 'delivery_truck_speed' },
    delivered: { label: t('status_delivered'), bg: 'bg-primary-fixed text-on-primary-fixed-variant', icon: 'check_circle' },
    cancelled: { label: t('status_cancelled'), bg: 'bg-red-100 text-red-800', icon: 'cancel' },
  };

  const timelineSteps: { status: OrderStatus; label: string; icon: string }[] = [
    { status: 'new', label: t('order_created'), icon: 'add_circle' },
    { status: 'processing', label: t('order_accepted'), icon: 'pending' },
    { status: 'preparing', label: t('preparing_items'), icon: 'skillet' },
    { status: 'dispatched', label: t('dispatched'), icon: 'local_shipping' },
    { status: 'out_for_delivery', label: t('status_out_for_delivery'), icon: 'delivery_truck_speed' },
    { status: 'delivered', label: t('status_delivered'), icon: 'check_circle' },
  ];

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (activeTab !== 'all') {
      result = result.filter((o) => o.status === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((o) => o.orderId.toLowerCase().includes(q));
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((o) => new Date(o.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((o) => new Date(o.createdAt) <= to);
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [orders, activeTab, searchQuery, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTabChange = (value: OrderStatus | 'all') => {
    setActiveTab(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface">
          {t('order_history_title')}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {t('order_history_subtitle')}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest rounded-xl p-4 space-y-4">
        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`
                shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${activeTab === tab.value
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Date Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder={t('search_order_id')}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date From */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-surface-container-lowest px-1 text-[10px] text-on-surface-variant">
              {t('date_from')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date To */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-surface-container-lowest px-1 text-[10px] text-on-surface-variant">
              {t('date_to')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-on-surface-variant">
        {t('showing_results').replace('{x}', String(paginatedOrders.length)).replace('{y}', String(filteredOrders.length))}
      </p>

      {/* Order List */}
      <div className="space-y-4">
        {loading && [1,2,3].map((i) => (
          <div key={i} className="bg-surface-container-lowest rounded-xl p-5 animate-pulse">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-32 bg-surface-container rounded-lg" />
                  <div className="h-5 w-24 bg-surface-container rounded-full" />
                </div>
                <div className="h-4 w-40 bg-surface-container rounded" />
              </div>
              <div className="text-right space-y-1 shrink-0">
                <div className="h-4 w-16 bg-surface-container rounded ml-auto" />
                <div className="h-6 w-24 bg-surface-container rounded ml-auto" />
              </div>
            </div>
          </div>
        ))}
        {!loading && paginatedOrders.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-10 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
              receipt_long
            </span>
            <p className="mt-2 text-on-surface-variant">{t('no_orders_found')}</p>
          </div>
        )}

        {paginatedOrders.map((order) => {
          const expanded = expandedOrders.has(order.id);
          const cfg = statusConfig[order.status];
          const currentStepIdx = getStepIndex(order.status);

          return (
            <div
              key={order.id}
              id={`order-${order.id}`}
              className={`bg-surface-container-lowest rounded-xl p-5 transition-shadow hover:shadow-md ${
                expanded ? 'ring-1 ring-primary/30' : ''
              }`}
            >
              {/* Card Header */}
              <button
                onClick={() => toggleExpand(order.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-headline font-bold text-lg text-on-surface">
                        #{order.orderId}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg}`}>
                        <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                        {cfg.label}
                      </span>
                      {order.invoiceNumber && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          order.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          <span className="material-symbols-outlined text-[14px]">
                            {order.paymentStatus === 'paid' ? 'check_circle' :
                             order.paymentStatus === 'partial' ? 'schedule' : 'pending'}
                          </span>
                          {order.paymentStatus === 'paid' ? t('status_paid') :
                           order.paymentStatus === 'partial' ? t('status_partial') :
                           t('status_unpaid')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1">
                      <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">calendar_today</span>
                      {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm text-on-surface-variant">
                      {order.items.length} {t('items')}
                    </p>
                    <p className="font-headline font-bold text-lg text-on-surface">
                      ฿{formatCurrency(order.total)}
                    </p>
                  </div>

                  <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${expanded ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>
              </button>

              {/* Expanded Detail */}
              {expanded && (
                <div className="mt-5 pt-5 border-t border-outline-variant/50 space-y-6">
                  {/* Items Table */}
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">list_alt</span>
                      {t('order_details')}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant/30">
                            <th className="text-left py-2 font-medium text-on-surface-variant">{t('product_col')}</th>
                            <th className="text-right py-2 font-medium text-on-surface-variant">{t('quantity_col')}</th>
                            <th className="text-right py-2 font-medium text-on-surface-variant">{t('price_per_unit')}</th>
                            <th className="text-right py-2 font-medium text-on-surface-variant">{t('line_total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, i) => (
                            <tr key={i} className="border-b border-outline-variant/20">
                              <td className="py-2.5 text-on-surface">
                                {locale === 'th' ? item.nameTh : item.nameEn}
                              </td>
                              <td className="py-2.5 text-right text-on-surface">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2.5 text-right text-on-surface-variant">
                                ฿{formatCurrency(item.unitPrice)}
                              </td>
                              <td className="py-2.5 text-right font-medium text-on-surface">
                                ฿{formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-outline-variant/50">
                            <td colSpan={3} className="py-2 text-right text-sm text-on-surface-variant">
                              {t('product_subtotal')}
                            </td>
                            <td className="py-2 text-right font-medium text-on-surface">
                              ฿{formatCurrency(order.subtotal)}
                            </td>
                          </tr>
                          <tr className="border-t border-outline-variant/50">
                            <td colSpan={3} className="py-2 text-right font-semibold text-on-surface">
                              {t('grand_total')}
                            </td>
                            <td className="py-2 text-right font-headline font-bold text-on-surface">
                              ฿{formatCurrency(order.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {order.status === 'new' && branchActor && (
                      <button
                        type="button"
                        onClick={() => setEditingOrder(order)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        {locale === 'th' ? 'แก้ไขรายการ' : 'Edit items'}
                      </button>
                    )}
                  </div>

                  {/* Delivery Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                      {t('delivery_info')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-surface-container rounded-lg p-3">
                        <p className="text-on-surface-variant text-xs">{t('branch')}</p>
                        <p className="font-medium text-on-surface">{order.branchName}</p>
                      </div>
                      {order.estimatedDelivery && (
                        <div className="bg-surface-container rounded-lg p-3">
                          <p className="text-on-surface-variant text-xs">{t('estimated_delivery')}</p>
                          <p className="font-medium text-on-surface">
                            {formatDate(order.estimatedDelivery)} {formatTime(order.estimatedDelivery)}
                          </p>
                        </div>
                      )}
                      {order.actualDelivery && (
                        <div className="bg-surface-container rounded-lg p-3">
                          <p className="text-on-surface-variant text-xs">{t('actual_delivery')}</p>
                          <p className="font-medium text-on-surface">
                            {formatDate(order.actualDelivery)} {formatTime(order.actualDelivery)}
                          </p>
                        </div>
                      )}
                      {order.notes && (
                        <div className="bg-surface-container rounded-lg p-3 sm:col-span-2">
                          <p className="text-on-surface-variant text-xs">{t('notes')}</p>
                          <p className="font-medium text-on-surface">{order.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Handled By */}
                  {(order.acceptedByName || order.packedByName) && (
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">badge</span>
                        {locale === 'th' ? 'ผู้รับผิดชอบ' : 'Handled by'}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {order.acceptedByName && (
                          <div className="bg-surface-container rounded-lg p-3 flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">chef_hat</span>
                            <div className="min-w-0">
                              <p className="text-on-surface-variant text-xs">
                                {locale === 'th' ? 'รับออเดอร์ / เตรียม' : 'Accepted / Prepared'}
                              </p>
                              <p className="font-medium text-on-surface truncate">{order.acceptedByName}</p>
                            </div>
                          </div>
                        )}
                        {order.packedByName && (
                          <div className="bg-surface-container rounded-lg p-3 flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">inventory_2</span>
                            <div className="min-w-0">
                              <p className="text-on-surface-variant text-xs">
                                {locale === 'th' ? 'แพ็คโดย' : 'Packed by'}
                              </p>
                              <p className="font-medium text-on-surface truncate">{order.packedByName}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Invoice / Payment Info */}
                  {order.invoiceNumber && (
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">receipt</span>
                        {t('invoice_info')}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-surface-container rounded-lg p-3">
                          <p className="text-on-surface-variant text-xs">{t('invoice_number')}</p>
                          <p className="font-medium text-on-surface font-mono">{order.invoiceNumber}</p>
                        </div>
                        <div className={`rounded-lg p-3 ${
                          order.paymentStatus === 'paid' ? 'bg-green-50' :
                          order.paymentStatus === 'partial' ? 'bg-yellow-50' :
                          'bg-red-50'
                        }`}>
                          <p className="text-on-surface-variant text-xs">{t('payment_status')}</p>
                          <p className={`font-semibold ${
                            order.paymentStatus === 'paid' ? 'text-green-700' :
                            order.paymentStatus === 'partial' ? 'text-yellow-700' :
                            'text-red-700'
                          }`}>
                            {order.paymentStatus === 'paid' ? t('status_paid') :
                             order.paymentStatus === 'partial' ? t('status_partial') :
                             t('status_unpaid')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {order.status !== 'cancelled' ? (
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">timeline</span>
                        {t('tracking_status')}
                      </h4>
                      <div className="flex items-center gap-0">
                        {timelineSteps.map((step, i) => {
                          const reached = i <= currentStepIdx;
                          const isCurrent = i === currentStepIdx;
                          return (
                            <div key={step.status} className="flex items-center flex-1 last:flex-none">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`
                                    w-9 h-9 rounded-full flex items-center justify-center
                                    ${isCurrent
                                      ? 'bg-primary text-on-primary ring-4 ring-primary/20'
                                      : reached
                                        ? 'bg-primary-fixed text-on-primary-fixed-variant'
                                        : 'bg-surface-container text-on-surface-variant/40'
                                    }
                                  `}
                                >
                                  <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                                </div>
                                <p className={`text-[10px] mt-1.5 text-center max-w-[60px] leading-tight ${reached ? 'text-on-surface font-medium' : 'text-on-surface-variant/50'}`}>
                                  {step.label}
                                </p>
                              </div>
                              {i < timelineSteps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 mt-[-18px] ${i < currentStepIdx ? 'bg-primary-fixed' : 'bg-surface-container-high'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      {t('order_cancelled_message')}
                      {order.notes && <span>- {order.notes}</span>}
                    </div>
                  )}

                  {/* Reorder Button */}
                  {order.status === 'delivered' && (
                    <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity">
                      <span className="material-symbols-outlined text-[20px]">replay</span>
                      {t('reorder')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`
                w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-colors
                ${currentPage === page
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }
              `}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      )}

      {editingOrder && branchActor && (
        <EditOrderItemsModal
          order={editingOrder}
          actor={branchActor}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}
