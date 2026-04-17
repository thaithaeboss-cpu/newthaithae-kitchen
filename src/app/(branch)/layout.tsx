'use client';

import { useEffect, useState } from 'react';
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { CartProvider, useCart } from "@/lib/cart-context";
import { LanguageProvider } from "@/lib/language-context";
import { BranchProvider, useBranchContext } from "@/lib/branch-context";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { isOwnerEmail } from "@/lib/owner";

function AuthReady({ children }: { children: React.ReactNode }) {
  const { setBranchId } = useBranchContext();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        // Not signed in — redirect to login
        window.location.href = '/login/';
        return;
      }

      // Owner emails (admin@thaithae.com etc) never own a branch — they
      // belong on /admin/*. Bounce them over immediately instead of
      // flashing a "ยังไม่ได้ผูกกับสาขา" error screen.
      if (isOwnerEmail(user.email)) {
        window.location.href = '/admin/';
        return;
      }

      try {
        // Find which branch this email owns
        const q = query(
          collection(db, 'branches'),
          where('ownerEmail', '==', user.email.toLowerCase()),
          limit(1),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setError(`บัญชี ${user.email} ยังไม่ได้ผูกกับสาขาใด\nกรุณาติดต่อผู้ดูแลระบบ`);
          return;
        }
        const branchDoc = snap.docs[0];
        setBranchId(branchDoc.id);
        setReady(true);
      } catch (err) {
        console.error('Branch resolve error:', err);
        setError('โหลดข้อมูลสาขาไม่ได้');
      }
    });
    return () => unsub();
  }, [setBranchId]);

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = '/login/';
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <span className="material-symbols-outlined text-error text-[48px]">error</span>
          <h2 className="font-headline font-bold text-lg text-on-surface">ไม่สามารถเข้าใช้งานได้</h2>
          <p className="text-sm text-on-surface-variant whitespace-pre-line">{error}</p>
          <p className="text-xs text-on-surface-variant">
            ถ้าคุณเป็นแอดมิน ให้ไปหน้าแอดมินแทน
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <a
              href="/admin"
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90"
            >
              ไปหน้าแอดมิน
            </a>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-on-surface-variant text-[32px] animate-pulse">
          storefront
        </span>
      </div>
    );
  }

  return <>{children}</>;
}

function BranchLayoutInner({ children }: { children: React.ReactNode }) {
  const { cartCount } = useCart();

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 pt-16 pb-24">{children}</main>
      <BottomNav cartCount={cartCount} />
    </>
  );
}

export default function BranchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <BranchProvider>
        <AuthReady>
          <CartProvider>
            <BranchLayoutInner>{children}</BranchLayoutInner>
          </CartProvider>
        </AuthReady>
      </BranchProvider>
    </LanguageProvider>
  );
}
