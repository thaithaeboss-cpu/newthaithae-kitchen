'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useDashboardStats, useRecentOrders, useOrders, useAnnouncements, useOrderWindow, useStockAdjustments, useProducts } from '@/lib/useFirestore';
import { useLanguage } from '@/lib/language-context';
import { saveSettings } from '@/lib/firestore';
import type { AppSettings } from '@/lib/firestore';

function timeAgo(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return locale === 'th' ? 'เมื่อสักครู่' : 'Just now';
  if (diffMin < 60) return locale === 'th' ? `${diffMin} นาทีที่แล้ว` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return locale === 'th' ? `${diffHr} ชม. ที่แล้ว` : `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return locale === 'th' ? `${diffDay} วันที่แล้ว` : `${diffDay}d ago`;
}

export default function AdminDashboard() {
  const { t, locale } = useLanguage();
  const { stats, loading: loadingStats } = useDashboardStats();
  const { orders: recentOrders, loading: loadingOrders } = useRecentOrders(5);
  // Announcements available for future use (e.g. banner / notice board)
  const { announcements } = useAnnouncements(true);
  const { orders: allOrders } = useOrders();
  const { adjustments: stockAdjustments } = useStockAdjustments(10);
  const { products } = useProducts();

  const today = new Date();
  const dateStr = today.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Revenue today: sum of today's orders (excluding cancelled) from all orders
  const todayStr = today.toISOString().slice(0, 10);
  const revenueToday = allOrders
    .filter((o) => {
      if (o.status === 'cancelled') return false;
      const orderDateStr = o.createdAt instanceof Date
        ? o.createdAt.toISOString().slice(0, 10)
        : String(o.createdAt).slice(0, 10);
      return orderDateStr === todayStr;
    })
    .reduce((sum, o) => sum + o.total, 0);

  // Build real recent activities from orders, stock adjustments, and low-stock products
  const recentActivities = useMemo(() => {
    const activities: { id: string; action: string; detail: string; time: Date; icon: string; color: string }[] = [];

    // — Order activities —
    const orderStatusConfig: Record<string, { thAction: string; enAction: string; icon: string; color: string }> = {
      new:              { thAction: 'สร้างออเดอร์ใหม่',  enAction: 'New Order',            icon: 'add_circle',    color: 'text-blue-600' },
      processing:       { thAction: 'กำลังดำเนินการ',    enAction: 'Processing',           icon: 'sync',          color: 'text-blue-600' },
      preparing:        { thAction: 'กำลังเตรียมสินค้า', enAction: 'Preparing',            icon: 'inventory_2',   color: 'text-amber-600' },
      dispatched:       { thAction: 'จัดส่งแล้ว',        enAction: 'Dispatched',           icon: 'local_shipping',color: 'text-indigo-600' },
      out_for_delivery: { thAction: 'กำลังจัดส่ง',       enAction: 'Out for Delivery',     icon: 'local_shipping',color: 'text-indigo-600' },
      delivered:        { thAction: 'จัดส่งสำเร็จ',      enAction: 'Delivered',            icon: 'check_circle',  color: 'text-green-600' },
      cancelled:        { thAction: 'ยกเลิกออเดอร์',     enAction: 'Order Cancelled',      icon: 'cancel',        color: 'text-red-600' },
    };

    for (const order of recentOrders) {
      const cfg = orderStatusConfig[order.status] || orderStatusConfig['new'];
      const orderNum = order.orderId || order.id;
      activities.push({
        id: `order-${order.id}`,
        action: locale === 'th' ? cfg.thAction : cfg.enAction,
        detail: `${orderNum} - ${order.branchName}`,
        time: order.updatedAt instanceof Date ? order.updatedAt : new Date(order.updatedAt),
        icon: cfg.icon,
        color: cfg.color,
      });
    }

    // — Stock adjustment activities —
    for (const adj of stockAdjustments) {
      const isAdd = adj.type === 'add';
      const isRemove = adj.type === 'remove';
      activities.push({
        id: `stock-${adj.id}`,
        action: locale === 'th'
          ? (isAdd ? 'เติมสต็อก' : isRemove ? 'ตัดสต็อก' : 'นับสต็อก')
          : (isAdd ? 'Stock Added' : isRemove ? 'Stock Removed' : 'Stock Count'),
        detail: `${adj.productName} ${isAdd ? '+' : isRemove ? '-' : ''}${Math.abs(adj.quantity)}`,
        time: new Date(adj.createdAt),
        icon: isAdd ? 'inventory' : isRemove ? 'remove_circle' : 'fact_check',
        color: isAdd ? 'text-teal-600' : isRemove ? 'text-red-600' : 'text-blue-600',
      });
    }

    // — Low stock alerts —
    const lowStockProducts = products.filter((p) => p.isActive && p.stock > 0 && p.stock <= p.minStock);
    for (const p of lowStockProducts.slice(0, 3)) {
      activities.push({
        id: `lowstock-${p.id}`,
        action: locale === 'th' ? 'สต็อกต่ำ' : 'Low Stock',
        detail: locale === 'th'
          ? `${p.nameTh} - เหลือ ${p.stock} ${p.unitTh}`
          : `${p.nameEn} - ${p.stock} ${p.unit} left`,
        time: new Date(), // current time since it's a live alert
        icon: 'warning',
        color: 'text-amber-600',
      });
    }

    // Sort by time descending, take top 10
    activities.sort((a, b) => b.time.getTime() - a.time.getTime());
    return activities.slice(0, 10);
  }, [recentOrders, stockAdjustments, products, locale]);

  // Compute last 7 days revenue from real orders
  const last7DaysRevenue = useMemo(() => {
    const dayNamesTh = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const days: { day: string; value: number; dateKey: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const dayIdx = d.getDay();
      days.push({
        day: locale === 'th' ? dayNamesTh[dayIdx] : dayNamesEn[dayIdx],
        value: 0,
        dateKey,
      });
    }

    // Sum delivered order totals per day
    for (const order of allOrders) {
      if (order.status === 'cancelled') continue;
      const orderDate = order.createdAt instanceof Date
        ? order.createdAt.toISOString().slice(0, 10)
        : String(order.createdAt).slice(0, 10);
      const dayEntry = days.find((d) => d.dateKey === orderDate);
      if (dayEntry) {
        dayEntry.value += order.total;
      }
    }

    return days;
  }, [allOrders, locale]);

  const maxRevenue = Math.max(...last7DaysRevenue.map((d) => d.value), 1);

  const isLoading = loadingStats || loadingOrders;

  const { mode: orderMode, isOpen: orderIsOpen, openTime, closeTime } = useOrderWindow();
  const [savingMode, setSavingMode] = useState(false);
  const [editOpenTime, setEditOpenTime] = useState('');
  const [editCloseTime, setEditCloseTime] = useState('');

  // Sync local time inputs when Firestore values load
  useEffect(() => {
    setEditOpenTime(openTime);
    setEditCloseTime(closeTime);
  }, [openTime, closeTime]);

  async function setOrderMode(newMode: AppSettings['orderWindowMode']) {
    setSavingMode(true);
    await saveSettings({ orderWindowMode: newMode });
    setSavingMode(false);
  }

  async function saveSchedule() {
    setSavingMode(true);
    await saveSettings({ orderOpenTime: editOpenTime, orderCloseTime: editCloseTime });
    setSavingMode(false);
  }

  const kpis = [
    {
      label: t('revenue_today'),
      value: `฿${revenueToday.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`,
      icon: 'payments',
      trend: '+12.5%',
      trendUp: true,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-700',
    },
    {
      label: t('pending_orders'),
      value: stats.pendingOrders.toString(),
      icon: 'pending_actions',
      trend: '+3',
      trendUp: true,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-700',
    },
    {
      label: t('active_branches'),
      value: stats.activeBranches.toString(),
      icon: 'store',
      trend: `${stats.activeBranches}`,
      trendUp: true,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-700',
    },
    {
      label: t('low_stock_items'),
      value: stats.lowStockCount.toString(),
      icon: 'inventory_2',
      trend: '-2',
      trendUp: false,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface">
          {t('welcome')}, Admin
        </h1>
        <p className="text-on-surface-variant mt-1">{dateStr}</p>
      </div>

      {/* ===== Order Window Control ===== */}
      <div className={`rounded-xl border-2 p-4 ${orderIsOpen ? 'border-green-500/40 bg-green-500/5' : 'border-error/30 bg-error/5'}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-2.5 w-2.5 relative shrink-0">
            {orderIsOpen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${orderIsOpen ? 'bg-green-500' : 'bg-error'}`} />
          </span>
          <p className="font-semibold text-on-surface text-sm">
            {locale === 'th' ? 'สถานะรับออเดอร์ — ' : 'Order Acceptance — '}
            <span className="font-normal text-on-surface-variant">
              {orderMode === 'always_open'
                ? (locale === 'th' ? 'เปิดตลอด 24/7' : 'Always open 24/7')
                : orderMode === 'always_closed'
                ? (locale === 'th' ? 'ปิดรับออเดอร์' : 'Closed')
                : (locale === 'th' ? `ตามเวลา ${openTime} – ${closeTime}` : `Scheduled ${openTime}–${closeTime}`)}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {(['always_open', 'scheduled', 'always_closed'] as const).map((m) => {
            const cfg = {
              always_open:   { th: 'เปิดตลอด', en: 'Always Open', active: 'bg-green-600 text-white' },
              scheduled:     { th: 'ตามเวลา',  en: 'Scheduled',   active: 'bg-primary text-on-primary' },
              always_closed: { th: 'ปิดรับ',   en: 'Close',       active: 'bg-error text-on-error' },
            }[m];
            const isActive = orderMode === m;
            return (
              <button
                key={m}
                onClick={() => setOrderMode(m)}
                disabled={savingMode || isActive}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${isActive ? cfg.active : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'} disabled:opacity-70`}
              >
                {locale === 'th' ? cfg.th : cfg.en}
              </button>
            );
          })}
        </div>

        {/* Time picker — shown only in scheduled mode */}
        {orderMode === 'scheduled' && (
          <div className="mt-3 pt-3 border-t border-outline-variant/30 flex items-center gap-3 flex-wrap">
            <p className="text-xs text-on-surface-variant shrink-0">
              {locale === 'th' ? 'ช่วงเวลา:' : 'Window:'}
            </p>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="time"
                value={editOpenTime}
                onChange={(e) => setEditOpenTime(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-on-surface-variant text-sm">—</span>
              <input
                type="time"
                value={editCloseTime}
                onChange={(e) => setEditCloseTime(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={saveSchedule}
              disabled={savingMode}
              className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              {savingMode ? '...' : (locale === 'th' ? 'บันทึก' : 'Save')}
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 animate-pulse"
              >
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-lg bg-surface-container-high" />
                  <div className="w-14 h-6 rounded-full bg-surface-container-high" />
                </div>
                <div className="h-8 w-24 rounded bg-surface-container-high mt-3" />
                <div className="h-4 w-32 rounded bg-surface-container-high mt-1" />
              </div>
            ))}
          </>
        ) : (
          <>
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined ${kpi.iconColor} text-[24px]`}>
                      {kpi.icon}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      kpi.trendUp
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {kpi.trend}
                  </span>
                </div>
                <p className="text-2xl font-bold text-on-surface mt-3">{kpi.value}</p>
                <p className="text-sm text-on-surface-variant mt-1">{kpi.label}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Revenue Chart + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="xl:col-span-2 bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
          <h2 className="text-lg font-headline font-bold text-on-surface mb-4">
            {t('revenue_7_days')}
          </h2>
          <div className="flex items-end gap-3 h-48">
            {last7DaysRevenue.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-on-surface-variant font-medium">
                  ฿{(d.value / 1000).toFixed(0)}k
                </span>
                <div
                  className="w-full bg-primary rounded-t-md transition-all duration-500"
                  style={{ height: `${(d.value / maxRevenue) * 140}px` }}
                />
                <span className="text-xs text-on-surface-variant font-medium">
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
          <h2 className="text-lg font-headline font-bold text-on-surface mb-4">
            {t('recent_activity')}
          </h2>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6">
                {locale === 'th' ? 'ยังไม่มีกิจกรรม' : 'No recent activity'}
              </p>
            ) : (
              recentActivities.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <span className={`material-symbols-outlined ${a.color} text-[20px] mt-0.5`}>
                    {a.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">{a.action}</p>
                    <p className="text-xs text-on-surface-variant truncate">{a.detail}</p>
                  </div>
                  <span className="text-xs text-on-surface-variant whitespace-nowrap">
                    {timeAgo(a.time, locale)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-headline font-bold text-on-surface mb-4">
          {t('quick_actions')}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            {t('new_product')}
          </Link>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary-container text-on-secondary-container rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            {t('view_orders')}
          </Link>
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-container-high text-on-surface rounded-lg font-medium text-sm hover:opacity-90 transition-opacity border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[20px]">summarize</span>
            {t('generate_report')}
          </Link>
        </div>
      </div>
    </div>
  );
}
