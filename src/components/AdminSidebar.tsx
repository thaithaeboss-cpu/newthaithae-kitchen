"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLanguage } from "@/lib/language-context";
import { useNotifications } from "@/lib/useFirestore";
import { useStaff } from "@/lib/staff-context";

interface NavItemDef {
  labelKey: string;
  icon: string;
  href: string;
}

interface NavSectionDef {
  titleKey: string;
  items: NavItemDef[];
}

const navSectionDefs: NavSectionDef[] = [
  {
    titleKey: "nav_overview",
    items: [
      { labelKey: "nav_dashboard", icon: "home", href: "/admin" },
    ],
  },
  {
    titleKey: "nav_order_management",
    items: [
      { labelKey: "nav_order_fulfillment", icon: "package_2", href: "/admin/fulfillment" },
      { labelKey: "nav_order_history", icon: "receipt_long", href: "/admin/orders" },
    ],
  },
  {
    titleKey: "nav_inventory",
    items: [
      { labelKey: "nav_products", icon: "inventory_2", href: "/admin/products" },
      { labelKey: "nav_stock_management", icon: "warehouse", href: "/admin/stock" },
    ],
  },
  {
    titleKey: "nav_business",
    items: [
      { labelKey: "nav_branches", icon: "store", href: "/admin/branches" },
      { labelKey: "nav_announcements", icon: "campaign", href: "/admin/announcements" },
      { labelKey: "nav_featured", icon: "star", href: "/admin/featured" },
      { labelKey: "nav_invoices", icon: "receipt", href: "/admin/invoices" },
      { labelKey: "nav_expenses", icon: "payments", href: "/admin/expenses" },
      { labelKey: "nav_accounting", icon: "account_balance", href: "/admin/accounting" },
    ],
  },
  {
    titleKey: "nav_analytics",
    items: [
      { labelKey: "nav_reports", icon: "bar_chart", href: "/admin/reports" },
    ],
  },
  {
    titleKey: "nav_settings_section",
    items: [
      { labelKey: "nav_staff", icon: "badge", href: "/admin/staff" },
      { labelKey: "nav_settings", icon: "settings", href: "/admin/settings" },
    ],
  },
];

function formatCurrency(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return locale === "th" ? "เมื่อสักครู่" : "Just now";
  if (diffMin < 60) return locale === "th" ? `${diffMin} นาทีที่แล้ว` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return locale === "th" ? `${diffHr} ชม. ที่แล้ว` : `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return locale === "th" ? `${diffDay} วันที่แล้ว` : `${diffDay}d ago`;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, t } = useLanguage();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const { staff } = useStaff();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifRefMobile = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    if (!confirm(locale === "th" ? "ออกจากระบบ?" : "Sign out?")) return;
    await signOut(auth);
    window.location.href = "/admin/login/";
  }

  // Role-based nav filter: only admins see the Staff management page
  const visibleSections = navSectionDefs.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.href === "/admin/staff") return staff?.role === "admin";
      return true;
    }),
  })).filter((s) => s.items.length > 0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inDesktop = notifRef.current?.contains(target);
      const inMobile = notifRefMobile.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setShowNotifDropdown(false);
      }
    }
    if (showNotifDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showNotifDropdown]);

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center justify-center border-b border-emerald-800/40">
        <div className="bg-white rounded-2xl px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Thai Khae Logo"
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {visibleSections.map((section) => (
          <div key={section.titleKey}>
            <p className="px-3 mb-2 text-[10px] font-bold tracking-widest text-emerald-500/60 uppercase">
              {t(section.titleKey as any)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                        ${active
                          ? "bg-emerald-800 text-white"
                          : "text-emerald-200/70 hover:bg-emerald-900/50 hover:text-white"
                        }
                      `}
                    >
                      <span
                        className={
                          active
                            ? "material-symbols-filled text-[20px]"
                            : "material-symbols-outlined text-[20px]"
                        }
                      >
                        {item.icon}
                      </span>
                      {t(item.labelKey as any)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="px-4 py-4 border-t border-emerald-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[20px]">
              person
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {staff?.name ?? (locale === "th" ? "ผู้ดูแล" : "Admin")}
            </p>
            <p className="text-xs text-emerald-400/70 truncate">
              {staff?.role === "admin"
                ? (locale === "th" ? "ผู้ดูแลระบบ" : "Administrator")
                : staff?.role === "kitchen"
                  ? (locale === "th" ? "ครัว" : "Kitchen")
                  : staff?.role === "packer"
                    ? (locale === "th" ? "แพ็ค" : "Packer")
                    : staff?.role === "both"
                      ? (locale === "th" ? "ครัว+แพ็ค" : "Kitchen + Packer")
                      : "Central Kitchen"}
            </p>
          </div>
          <button
            onClick={() => setLocale(locale === "th" ? "en" : "th")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
            aria-label="Toggle language"
          >
            {locale === "th" ? "TH" : "EN"}
          </button>
          <button
            onClick={handleLogout}
            title={locale === "th" ? "ออกจากระบบ" : "Sign out"}
            className="text-emerald-400/70 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              logout
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger (top-left) */}
      <div className="lg:hidden fixed top-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary shadow-lg"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      {/* Mobile notification bell (top-right) */}
      <div className="lg:hidden fixed top-4 right-4 z-50" ref={notifRefMobile}>
        <button
          onClick={() => {
            setShowNotifDropdown(!showNotifDropdown);
            if (!showNotifDropdown && unreadCount > 0) markAllRead();
          }}
          className="relative w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface shadow-lg border border-outline-variant/30"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {showNotifDropdown && (
          <div className="fixed top-16 right-4 left-4 max-w-sm ml-auto bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30">
              <h3 className="font-semibold text-sm text-on-surface">
                {locale === "th" ? "การแจ้งเตือน" : "Notifications"}
              </h3>
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-xs text-on-surface-variant hover:text-on-surface">
                  {locale === "th" ? "ล้างทั้งหมด" : "Clear all"}
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="material-symbols-outlined text-on-surface-variant/30 text-4xl">notifications_off</span>
                  <p className="text-sm text-on-surface-variant mt-2">
                    {locale === "th" ? "ไม่มีการแจ้งเตือน" : "No notifications"}
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-base">shopping_bag</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface">
                          {locale === "th" ? "ออเดอร์ใหม่" : "New Order"}{" "}
                          <span className="font-mono text-primary">#{n.orderNumber}</span>
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {n.branchName} · ฿{formatCurrency(n.total || 0)}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/60 mt-1">
                          {timeAgo(n.timestamp, locale)}
                        </p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification bell (desktop - fixed top right) */}
      <div className="hidden lg:block fixed top-4 right-6 z-40" ref={notifRef}>
        <button
          onClick={() => {
            setShowNotifDropdown(!showNotifDropdown);
            if (!showNotifDropdown && unreadCount > 0) markAllRead();
          }}
          className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high shadow-sm border border-outline-variant/30 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {showNotifDropdown && (
          <div className="absolute right-0 top-12 w-80 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30">
              <h3 className="font-semibold text-sm text-on-surface">
                {locale === "th" ? "การแจ้งเตือน" : "Notifications"}
              </h3>
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-xs text-on-surface-variant hover:text-on-surface">
                  {locale === "th" ? "ล้างทั้งหมด" : "Clear all"}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="material-symbols-outlined text-on-surface-variant/30 text-4xl">notifications_off</span>
                  <p className="text-sm text-on-surface-variant mt-2">
                    {locale === "th" ? "ไม่มีการแจ้งเตือน" : "No notifications"}
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-base">shopping_bag</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface">
                          {locale === "th" ? "ออเดอร์ใหม่" : "New Order"}{" "}
                          <span className="font-mono text-primary">#{n.orderNumber}</span>
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {n.branchName} · ฿{formatCurrency(n.total || 0)}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/60 mt-1">
                          {timeAgo(n.timestamp, locale)}
                        </p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-emerald-950 transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-emerald-400 hover:text-white"
          aria-label="Close menu"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[280px] bg-emerald-950 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
