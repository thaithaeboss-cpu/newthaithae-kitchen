"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/language-context";

const tabs = [
  { labelKey: "nav_dashboard" as const, icon: "dashboard", href: "/" },
  { labelKey: "nav_catalog" as const, icon: "menu_book", href: "/catalog" },
  { labelKey: "nav_cart" as const, icon: "shopping_cart", href: "/cart" },
  { labelKey: "nav_history" as const, icon: "history", href: "/history" },
];

interface BottomNavProps {
  cartCount?: number;
}

export default function BottomNav({ cartCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const t = useT();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] rounded-t-2xl">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200
                ${active
                  ? "bg-emerald-100 text-emerald-900"
                  : "text-on-surface-variant hover:text-on-surface"
                }
              `}
            >
              <span className="relative">
                <span
                  className={
                    active
                      ? "material-symbols-filled text-[24px]"
                      : "material-symbols-outlined text-[24px]"
                  }
                >
                  {tab.icon}
                </span>
                {tab.icon === "shopping_cart" && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-tertiary text-on-tertiary text-[10px] font-bold px-1">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </span>
              <span
                className="font-bold tracking-widest uppercase"
                style={{ fontSize: "10px" }}
              >
                {t(tab.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
