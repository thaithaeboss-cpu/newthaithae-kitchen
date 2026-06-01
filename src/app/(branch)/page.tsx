'use client';

import Link from 'next/link';
import {
  announcementCategoryLabels,
} from '@/data/mock-data';
import { useLanguage } from '@/lib/language-context';
import {
  useRecentOrders,
  useAnnouncements,
  useLowStockProducts,
  useDashboardStats,
  useOrderWindow,
  useProducts,
} from '@/lib/useFirestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import type { Announcement } from '@/lib/firestore';
import { effectivePrice, type CustomerType } from '@/lib/firestore';
import { useBranchContext } from '@/lib/branch-context';
import { useBranches } from '@/lib/useFirestore';

// --- page component ----------------------------------------------------

export default function BranchDashboard() {
  const { locale, t } = useLanguage();
  const { branchId } = useBranchContext();

  // Firebase hooks
  const { orders: recentOrders, loading: loadingOrders } = useRecentOrders(3, branchId);
  const { announcements, loading: loadingAnnouncements } = useAnnouncements(true);
  const { products: lowStockProducts, loading: loadingLowStock } = useLowStockProducts();
  const { stats, loading: loadingStats } = useDashboardStats(branchId);
  const { isOpen: orderIsOpen, mode: orderMode, openTime: orderOpenTime, closeTime: orderCloseTime } = useOrderWindow();
  const { products: allProducts } = useProducts();
  const { branches } = useBranches();
  const currentBranch = branches.find((b) => b.id === branchId);
  const customerType: CustomerType =
    currentBranch?.customerType === 'external' ? 'external' : 'internal';

  // Selected announcement for modal
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Featured + bank info from Firestore settings
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'main'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setFeaturedIds(d.featuredProductIds ?? []);
      }
    });
    return () => unsub();
  }, []);

  const seasonalItems = featuredIds.length > 0
    ? featuredIds.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean) as typeof allProducts
    : allProducts.filter((p) => p.isActive).slice(0, 4);

  // --- helpers (need t/locale so defined inside component) ---
  const statusConfig: Record<
    string,
    { icon: string; iconBg: string; badgeBg: string; badgeText: string; labelKey: string }
  > = {
    processing: {
      icon: 'receipt_long',
      iconBg: 'bg-tertiary-fixed',
      badgeBg: 'bg-tertiary-fixed',
      badgeText: 'text-on-tertiary-fixed',
      labelKey: 'status_processing',
    },
    preparing: {
      icon: 'receipt_long',
      iconBg: 'bg-tertiary-fixed',
      badgeBg: 'bg-tertiary-fixed',
      badgeText: 'text-on-tertiary-fixed',
      labelKey: 'status_preparing',
    },
    out_for_delivery: {
      icon: 'local_shipping',
      iconBg: 'bg-secondary-container',
      badgeBg: 'bg-secondary-container',
      badgeText: 'text-on-secondary-container',
      labelKey: 'status_out_for_delivery',
    },
    dispatched: {
      icon: 'local_shipping',
      iconBg: 'bg-secondary-container',
      badgeBg: 'bg-secondary-container',
      badgeText: 'text-on-secondary-container',
      labelKey: 'status_dispatched',
    },
    delivered: {
      icon: 'check_circle',
      iconBg: 'bg-primary-fixed',
      badgeBg: 'bg-primary-fixed',
      badgeText: 'text-on-primary-fixed',
      labelKey: 'status_delivered',
    },
    new: {
      icon: 'receipt_long',
      iconBg: 'bg-tertiary-fixed',
      badgeBg: 'bg-tertiary-fixed',
      badgeText: 'text-on-tertiary-fixed',
      labelKey: 'status_new',
    },
    cancelled: {
      icon: 'cancel',
      iconBg: 'bg-error-container',
      badgeBg: 'bg-error-container',
      badgeText: 'text-on-error-container',
      labelKey: 'status_cancelled',
    },
  };

  // seasonalItems now populated from Firestore (defined above near useOrderWindow)

  // Inventory alerts derived from low-stock products
  const criticalAlerts = lowStockProducts.filter((p) => p.stock <= p.minStock * 0.3);
  const lowAlerts = lowStockProducts.filter((p) => p.stock > p.minStock * 0.3);

  return (
    <div className="space-y-8 py-6">
      {/* ===== Hero Section ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left - Order Window Card */}
        <div className="lg:col-span-2 relative h-64 rounded-xl overflow-hidden bg-primary">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: "url('/images/products/chicken-breast.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/50" />

          <div className="relative z-10 flex flex-col justify-between h-full p-6">
            {/* Status badge */}
            <div className="flex items-center gap-2 self-start">
              <span className="flex h-2.5 w-2.5 relative">
                {orderIsOpen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${orderIsOpen ? 'bg-green-400' : 'bg-red-400'}`} />
              </span>
              <span className={`text-xs font-semibold uppercase tracking-widest ${orderIsOpen ? 'text-green-300' : 'text-red-300'}`}>
                {orderIsOpen ? t('order_open_status') : t('order_closed_status')}
              </span>
            </div>

            {/* Time window */}
            <div>
              <p className="uppercase tracking-[0.2em] text-primary-fixed-dim mb-2" style={{ fontSize: '10px' }}>
                {orderMode === 'always_open'
                  ? (locale === 'th' ? 'เปิดรับออเดอร์ตลอดเวลา' : 'Accepting orders 24/7')
                  : t('order_window')}
              </p>
              {orderMode === 'scheduled' && (
              <div className="flex items-end gap-3 mb-4">
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-white font-headline leading-none">{orderOpenTime}</p>
                  <p className="text-[10px] text-primary-fixed-dim mt-0.5 uppercase tracking-wider">{locale === 'th' ? 'เปิด' : 'Open'}</p>
                </div>
                <span className="text-white/50 text-2xl mb-1">—</span>
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-white font-headline leading-none">{orderCloseTime}</p>
                  <p className="text-[10px] text-primary-fixed-dim mt-0.5 uppercase tracking-wider">{t('order_cutoff')}</p>
                </div>
              </div>
              )}
              {orderMode === 'always_open' && (
                <p className="text-4xl font-extrabold text-white font-headline leading-none mb-4">24 / 7</p>
              )}
              {orderMode === 'always_closed' && (
                <p className="text-lg font-bold text-red-300 mb-4">{locale === 'th' ? 'ปิดรับออเดอร์ชั่วคราว' : 'Temporarily closed'}</p>
              )}
              <Link
                href="/catalog"
                className="inline-flex items-center self-start px-6 py-3 rounded-xl text-sm font-semibold text-primary bg-gradient-to-r from-primary-fixed-dim to-on-primary-container shadow-xl hover:shadow-2xl transition-all"
              >
                {t('place_new_order')}
                <span className="ml-2">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right - Today's Summary */}
        <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
          <div>
            <p
              className="uppercase tracking-[0.2em] text-on-surface-variant mb-4"
              style={{ fontSize: '10px' }}
            >
              {t('todays_summary')}
            </p>

            <div className="mb-4">
              <p className="text-xs text-on-surface-variant mb-1">{t('total_spent')}</p>
              <p className="text-2xl font-bold text-primary font-headline">
                &#3647;{stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs text-on-surface-variant mb-1">{t('active_orders')}</p>
              <p className="text-2xl font-bold text-on-surface font-headline">
                {String(stats.activeOrders).padStart(2, '0')}
              </p>
            </div>
          </div>

          {/* progress dots */}
          <div className="flex gap-2 mt-4">
            <div className="h-1.5 flex-1 rounded-full bg-primary" />
            <div className="h-1.5 flex-1 rounded-full bg-tertiary" />
            <div className="h-1.5 flex-1 rounded-full bg-secondary" />
          </div>
        </div>
      </div>

      {/* ===== Main Content Grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ---- Recent Orders (8 cols) ---- */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-headline text-on-surface">{t('recent_orders')}</h3>
            <Link
              href="/orders"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('view_all')}
            </Link>
          </div>

          <div className="space-y-3">
            {loadingOrders && [1,2,3].map((n) => (
              <div key={n} className="animate-pulse flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <div className="w-12 h-12 rounded-lg bg-surface-container-high" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-surface-container-high rounded" />
                  <div className="h-3 w-32 bg-surface-container-high rounded" />
                </div>
                <div className="h-6 w-20 bg-surface-container-high rounded-full" />
              </div>
            ))}
            {!loadingOrders && recentOrders.map((order) => {
              const cfg = statusConfig[order.status] ?? statusConfig.new;
              // Show who's currently handling the order. Preparing = acceptor,
              // dispatched/out_for_delivery = packer, delivered = final packer.
              // Falls back to acceptor if packer isn't set yet.
              const handlerName =
                order.status === 'preparing' || order.status === 'processing' || order.status === 'new'
                  ? order.acceptedByName
                  : (order.packedByName ?? order.acceptedByName);
              const handlerVerb =
                order.status === 'preparing'
                  ? (locale === 'th' ? 'กำลังเตรียม' : 'preparing')
                  : order.status === 'dispatched' || order.status === 'out_for_delivery'
                    ? (locale === 'th' ? 'แพ็คออเดอร์' : 'packed')
                    : order.status === 'delivered'
                      ? (locale === 'th' ? 'แพ็คโดย' : 'packed by')
                      : order.status === 'processing' || order.status === 'new'
                        ? (locale === 'th' ? 'กำลังเตรียม' : 'preparing')
                        : null;
              return (
                <Link
                  key={order.id}
                  href={`/history/?order=${encodeURIComponent(order.orderId)}`}
                  className="group flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl border border-transparent hover:border-outline-variant hover:bg-surface-bright transition-all"
                >
                  {/* icon */}
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-lg ${cfg.iconBg}`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {cfg.icon}
                    </span>
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-bold text-on-surface">
                      {order.orderId}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {order.items.length} {t('items')} &middot;{' '}
                      {order.estimatedDelivery
                        ? `${t('delivery_on')} ${new Date(order.estimatedDelivery).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' })}`
                        : t('no_delivery_date')}
                    </p>
                    {handlerName && handlerVerb && order.status !== 'cancelled' && (
                      <p className="text-xs text-primary font-medium mt-1 inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">
                          {order.status === 'dispatched' || order.status === 'out_for_delivery' || order.status === 'delivered'
                            ? 'inventory_2'
                            : 'chef_hat'}
                        </span>
                        {locale === 'th'
                          ? <>{handlerName}{handlerVerb === 'แพ็คโดย' ? '' : ''} {handlerVerb}</>
                          : <>{handlerVerb} by <span className="font-semibold">{handlerName}</span></>}
                      </p>
                    )}
                  </div>

                  {/* badge */}
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}
                  >
                    {t(cfg.labelKey as any)}
                  </span>

                  {/* chevron */}
                  <span className="material-symbols-outlined text-on-surface-variant transition-transform group-hover:translate-x-1">
                    chevron_right
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ---- Side Rail (4 cols) ---- */}
        <div className="lg:col-span-4 space-y-6">
          {/* Announcements */}
          <div className="rounded-xl bg-surface-container-low p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">campaign</span>
              <h4 className="font-headline font-bold text-on-surface">{t('announcements')}</h4>
            </div>

            <div className="space-y-3">
              {announcements.slice(0, 3).map((ann, idx) => (
                <button
                  type="button"
                  key={ann.id}
                  onClick={() => setSelectedAnnouncement(ann)}
                  className={`text-left w-full pl-3 py-1 border-l-2 hover:bg-surface-container-high/40 transition-colors rounded-r-md ${
                    idx === 0 ? 'border-primary' : 'border-surface-container-highest'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                    {announcementCategoryLabels[ann.category]?.[locale] ?? ann.category}
                  </p>
                  <p className="text-sm font-medium text-on-surface leading-snug line-clamp-2">
                    {ann.title}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {new Date(ann.createdAt).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Inventory Alerts */}
          <div className="rounded-xl bg-surface-container-low p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-headline font-bold text-on-surface">{t('inventory_alerts')}</h4>
              {criticalAlerts.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-error text-on-error">
                  {criticalAlerts.length} {t('critical')}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* Critical alerts */}
              {criticalAlerts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-error-container"
                >
                  <span className="material-symbols-outlined text-on-error-container text-lg">
                    warning
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-error-container truncate">
                      {locale === 'th' ? product.nameTh : product.nameEn}
                    </p>
                    <p className="text-xs text-on-error-container/70">
                      {product.stock} / {product.minStock} {locale === 'th' ? product.unitTh : product.unit}
                    </p>
                  </div>
                </div>
              ))}

              {/* Low alerts */}
              {lowAlerts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-lowest"
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-lg">
                    inventory_2
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {locale === 'th' ? product.nameTh : product.nameEn}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {product.stock} / {product.minStock} {locale === 'th' ? product.unitTh : product.unit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Seasonal Catalog Highlights ===== */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold font-headline text-on-surface">
          {t('seasonal_highlights')}
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {seasonalItems.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-surface-container-high"
            >
              {item.image ? (
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundImage: `url('${item.image}')` }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/60" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="relative z-10 flex flex-col justify-end h-full p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/70">
                  {item.category}
                </p>
                <p className="text-sm font-bold text-white">
                  {locale === 'th' ? item.nameTh : item.nameEn}
                </p>
                <p className="text-xs text-white/70 mt-0.5">฿{effectivePrice(item, customerType).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="bg-surface rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                {announcementCategoryLabels[selectedAnnouncement.category]?.[locale] ?? selectedAnnouncement.category}
              </span>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                aria-label="Close"
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface">
              {selectedAnnouncement.title}
            </h3>
            <p className="text-xs text-on-surface-variant">
              {new Date(selectedAnnouncement.createdAt).toLocaleDateString(
                locale === 'th' ? 'th-TH' : 'en-GB',
                { day: 'numeric', month: 'short', year: 'numeric' }
              )}
            </p>
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
              {selectedAnnouncement.content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
