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
import { getStaffByUid, getStaffByEmail } from "@/lib/firestore";

// localStorage keys for the per-email branch resolution cache. Stores
// the most recent email → branchId pairing so a returning user can render
// the dashboard immediately while Firebase Auth + the branches query are
// still warming up.
const CACHED_EMAIL_KEY = 'branch_cache_email';
const CACHED_BRANCH_KEY = 'branch_cache_id';

function readCachedBranch(email: string | null | undefined): string | null {
  if (typeof window === 'undefined' || !email) return null;
  try {
    const cachedEmail = window.localStorage.getItem(CACHED_EMAIL_KEY);
    if (cachedEmail !== email.toLowerCase()) return null;
    return window.localStorage.getItem(CACHED_BRANCH_KEY);
  } catch {
    return null;
  }
}

function writeCachedBranch(email: string, branchId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHED_EMAIL_KEY, email.toLowerCase());
    window.localStorage.setItem(CACHED_BRANCH_KEY, branchId);
  } catch {}
}

function clearCachedBranch() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHED_EMAIL_KEY);
    window.localStorage.removeItem(CACHED_BRANCH_KEY);
  } catch {}
}

// Remembers the last email we resolved as a factory staff account (a /staff
// profile, no branch). The PWA start_url is "/", so staff land on the branch
// app first — caching this lets us bounce them straight to /admin/ on the
// next launch without two Firestore round-trips (branches query + staff
// lookup). /admin re-verifies via StaffProvider, so a stale flag self-heals.
const CACHED_STAFF_EMAIL_KEY = 'branch_staff_redirect_email';

function isCachedStaff(email: string | null | undefined): boolean {
  if (typeof window === 'undefined' || !email) return false;
  try {
    return window.localStorage.getItem(CACHED_STAFF_EMAIL_KEY) === email.toLowerCase();
  } catch {
    return false;
  }
}

function writeCachedStaff(email: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHED_STAFF_EMAIL_KEY, email.toLowerCase());
  } catch {}
}

function clearCachedStaff() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHED_STAFF_EMAIL_KEY);
  } catch {}
}

function AuthReady({ children }: { children: React.ReactNode }) {
  const { setBranchId } = useBranchContext();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Optimistic paint: if we already have a current Firebase user (from
    // restored session) and a cached branchId for that email, render
    // immediately. The onAuthStateChanged listener below still runs and
    // refreshes the cache against the real branches collection so we
    // catch any reassignment.
    const current = auth.currentUser;
    // Known factory-staff account from a previous session — bounce to
    // /admin/* synchronously before we even paint the spinner.
    if (current && isCachedStaff(current.email)) {
      window.location.href = '/admin/';
      return;
    }
    const optimisticBranch = readCachedBranch(current?.email);
    if (current && optimisticBranch) {
      setBranchId(optimisticBranch);
      setReady(true);
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        clearCachedBranch();
        clearCachedStaff();
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

      const email = user.email.toLowerCase();

      // Known factory-staff account — skip the branches query + staff lookup
      // entirely and bounce straight to /admin/*.
      if (isCachedStaff(email)) {
        window.location.href = '/admin/';
        return;
      }

      // Cache hit on the just-resolved auth user — render now if we
      // didn't already in the synchronous block above.
      const cached = readCachedBranch(email);
      if (cached) {
        setBranchId(cached);
        setReady(true);
      }

      try {
        // Verify against Firestore. Hits the persistent cache instantly
        // when present, network otherwise.
        const q = query(
          collection(db, 'branches'),
          where('ownerEmail', '==', email),
          limit(1),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          clearCachedBranch();
          // Not a branch owner. Before showing the "not linked to a branch"
          // wall, check whether they're a factory staff member (a /staff
          // profile exists). The PWA start_url is "/", so kitchen/packing/
          // delivery staff land here too — bounce them to /admin/* instead,
          // where the admin layout routes them by role. Mirrors how /admin/*
          // bounces branch accounts back to "/".
          const staffProfile =
            (await getStaffByUid(user.uid)) ??
            (await getStaffByEmail(email));
          if (staffProfile) {
            writeCachedStaff(email);
            window.location.href = '/admin/';
            return;
          }
          if (!cached) {
            setError(`บัญชี ${user.email} ยังไม่ได้ผูกกับสาขาใด\nกรุณาติดต่อผู้ดูแลระบบ`);
          }
          return;
        }
        const branchDoc = snap.docs[0];
        writeCachedBranch(email, branchDoc.id);
        clearCachedStaff(); // self-heal: this email is a branch owner, not staff
        setBranchId(branchDoc.id);
        setReady(true);
      } catch (err) {
        console.error('Branch resolve error:', err);
        // Only show the error screen if we couldn't paint from cache.
        if (!cached) setError('โหลดข้อมูลสาขาไม่ได้');
      }
    });
    return () => unsub();
  }, [setBranchId]);

  async function handleSignOut() {
    clearCachedStaff();
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
