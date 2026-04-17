"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { useNotifications, useBranches } from "@/lib/useFirestore";
import { useBranchContext } from "@/lib/branch-context";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

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

export default function Header() {
  const { locale, setLocale, t } = useLanguage();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const { branches } = useBranches();
  const { branchId } = useBranchContext();
  const currentBranch = branches.find((b) => b.id === branchId);
  const branchName = currentBranch ? (locale === "th" ? currentBranch.nameTh : currentBranch.nameEn || currentBranch.nameTh) : "";
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-emerald-950/85 backdrop-blur-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto px-4 h-14">
        {/* Logo + Branch name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center bg-white rounded-xl px-2.5 py-1 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Thai Khae Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
          {branchName && (
            <div className="min-w-0 hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-emerald-300/70 leading-none">
                {locale === "th" ? "สาขา" : "Branch"}
              </p>
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {branchName}
              </p>
            </div>
          )}
          {branchName && (
            <div className="sm:hidden">
              <span className="text-xs font-semibold text-white bg-emerald-800 px-2 py-1 rounded-lg whitespace-nowrap">
                {branchName}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === "th" ? "en" : "th")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
            aria-label="Toggle language"
          >
            {locale === "th" ? "TH" : "EN"}
          </button>

          {/* Logout */}
          <button
            onClick={async () => {
              if (!confirm(locale === "th" ? "ออกจากระบบ?" : "Sign out?")) return;
              await signOut(auth);
              window.location.href = "/login/";
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Sign out"
            title={locale === "th" ? "ออกจากระบบ" : "Sign out"}
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>

          {/* Notification bell */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setShowDropdown(!showDropdown);
                if (!showDropdown && unreadCount > 0) markAllRead();
              }}
              className="relative w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-[22px]">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-emerald-950">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-sm text-gray-900">
                    {locale === "th" ? "การแจ้งเตือน" : "Notifications"}
                  </h3>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      {locale === "th" ? "ล้างทั้งหมด" : "Clear all"}
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <span className="material-symbols-outlined text-gray-300 text-4xl">
                        notifications_off
                      </span>
                      <p className="text-sm text-gray-400 mt-2">
                        {locale === "th" ? "ไม่มีการแจ้งเตือน" : "No notifications"}
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                          !n.read ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-primary text-base">
                              {n.type === "new_order" ? "shopping_bag" : "receipt"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {locale === "th" ? "ออเดอร์ใหม่" : "New Order"}{" "}
                              <span className="font-mono text-primary">#{n.orderNumber}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {n.branchName} · ฿{formatCurrency(n.total || 0)}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {timeAgo(n.timestamp, locale)}
                            </p>
                          </div>
                          {!n.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
