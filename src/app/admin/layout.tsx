'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import AdminSidebar from "@/components/AdminSidebar";
import { LanguageProvider } from "@/lib/language-context";
import { StaffProvider, useStaff } from "@/lib/staff-context";
import { upsertStaff, getAllStaff, getBranches } from "@/lib/firestore";
import { isOwnerEmail } from "@/lib/owner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // next.config has trailingSlash: true, so the runtime pathname is
  // '/admin/login/'. Normalize before comparing or the login page gets
  // wrapped with AuthGate and loops on the loading spinner after logout.
  const normalizedPath = pathname?.replace(/\/$/, '') ?? '';
  const isLoginPage = normalizedPath === '/admin/login';
  const isDeliveryPage = normalizedPath === '/admin/delivery';

  if (isLoginPage) {
    return <LanguageProvider>{children}</LanguageProvider>;
  }

  // Delivery role gets a single-page UI without the admin sidebar/chrome.
  if (isDeliveryPage) {
    return (
      <LanguageProvider>
        <AuthGate>
          <StaffProvider>
            <StaffProfileGate>{children}</StaffProfileGate>
          </StaffProvider>
        </AuthGate>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <AuthGate>
        <StaffProvider>
          <StaffProfileGate>
            <div className="min-h-screen bg-surface">
              <AdminSidebar />
              <main className="lg:ml-[280px] min-h-screen">
                <div className="p-4 lg:p-8 pt-16 lg:pt-8">{children}</div>
              </main>
            </div>
          </StaffProfileGate>
        </StaffProvider>
      </AuthGate>
    </LanguageProvider>
  );
}

// Shown when a user is authenticated via Firebase but doesn't have a
// matching /staff/{uid} profile yet. Admin needs to add them from /admin/staff
// (or add the profile themselves first).
function StaffProfileGate({ children }: { children: React.ReactNode }) {
  const { staff, loading, missingProfile } = useStaff();
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/$/, '') ?? '';

  // Delivery staff can only see /admin/delivery — bounce them if they land
  // elsewhere under /admin/* (e.g. by typing a URL directly).
  useEffect(() => {
    if (
      staff?.role === 'delivery' &&
      normalizedPath !== '/admin/delivery' &&
      normalizedPath !== '/admin/login'
    ) {
      router.replace('/admin/delivery/');
    }
  }, [staff?.role, normalizedPath, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-on-surface-variant text-[40px] animate-pulse">
          badge
        </span>
      </div>
    );
  }

  if (missingProfile && !staff) {
    return <ProfileBootstrap />;
  }

  // While redirecting, render nothing so the unauthorized page doesn't flash.
  if (
    staff?.role === 'delivery' &&
    normalizedPath !== '/admin/delivery' &&
    normalizedPath !== '/admin/login'
  ) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-on-surface-variant text-[40px] animate-pulse">
          local_shipping
        </span>
      </div>
    );
  }

  return <>{children}</>;
}

// Shown to authenticated Firebase users whose /staff/{uid} profile doesn't
// exist yet. Three cases:
//   - Owner email (whitelist): handled by StaffProvider — auto-provisioned
//     as admin, so this component never shows for them.
//   - First-ever user (zero staff) AND not a branch account: allowed to
//     self-register as 'admin' so we can bootstrap without Firestore Console.
//   - Branch account OR subsequent users: wait for an existing admin to
//     add them. Self-bootstrap is refused.
function ProfileBootstrap() {
  const { refresh } = useStaff();
  const [isFirstUser, setIsFirstUser] = useState<boolean | null>(null);
  const [isBranchAccount, setIsBranchAccount] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const email = (auth.currentUser?.email ?? '').toLowerCase();
    Promise.all([getAllStaff(), getBranches()])
      .then(([list, branches]) => {
        setIsFirstUser(list.length === 0);
        // Check: is this user registered as a branch owner? If yes, they
        // must NOT be able to claim admin from /admin/*.
        const branchMatch = branches.some(
          (b) => (b.ownerEmail ?? '').toLowerCase() === email && !!email,
        );
        setIsBranchAccount(branchMatch);

        // Owner whitelist still wins (admin@thaithae.com etc) — for everyone
        // else who landed on /admin/* with a branch account, just bounce
        // them straight to the branch side instead of showing the warning
        // screen they would have to dismiss every single time.
        if (branchMatch && !isOwnerEmail(email)) {
          window.location.replace('/');
        }
      })
      .catch(() => {
        setIsFirstUser(false);
        setIsBranchAccount(false);
      });
  }, []);

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !name.trim()) return;
    // Double-guard: never allow bootstrap from a branch account.
    if (isBranchAccount) {
      setErr('บัญชีนี้เป็นบัญชีสาขา — ไม่สามารถใช้เป็นผู้ดูแลระบบได้');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await upsertStaff(user.uid, {
        authEmail: (user.email ?? '').toLowerCase(),
        name: name.trim(),
        role: 'admin',
        isActive: true,
      });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const currentEmail = auth.currentUser?.email ?? '';
  const currentIsOwner = isOwnerEmail(currentEmail);
  const canBootstrap = isFirstUser === true && !isBranchAccount;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-amber-600 text-[32px]">badge</span>
        </div>

        {isFirstUser === null || isBranchAccount === null ? (
          <p className="text-sm text-on-surface-variant">กำลังตรวจสอบ…</p>
        ) : isBranchAccount && !currentIsOwner ? (
          // The effect above has already kicked off window.location.replace('/')
          // — just paint a brief loading state so the warning screen never
          // flashes for branch users who land on /admin/* by accident.
          <p className="text-sm text-on-surface-variant">กำลังพาไปหน้าสาขา…</p>
        ) : canBootstrap ? (
          <>
            <h2 className="text-xl font-headline font-bold text-on-surface">ตั้งค่าผู้ดูแลระบบคนแรก</h2>
            <p className="text-sm text-on-surface-variant">
              ยังไม่มีพนักงานในระบบ — กรอกชื่อของคุณเพื่อเริ่มต้นใช้งาน
              <br />
              <span className="text-xs">(คุณจะได้สิทธิ์ admin อัตโนมัติและสามารถเพิ่มพนักงานคนอื่นได้ที่ <code className="bg-surface-container px-1 rounded">/admin/staff</code>)</span>
            </p>
            <p className="text-xs text-on-surface-variant">
              อีเมล: <span className="font-mono">{currentEmail}</span>
            </p>
            <form onSubmit={handleBootstrap} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-medium text-on-surface mb-1">ชื่อที่จะแสดง</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="เช่น แบงค์"
                  className="w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-surface-container text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก…' : 'เริ่มใช้งาน'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-xl font-headline font-bold text-on-surface">ยังไม่มีโปรไฟล์พนักงาน</h2>
            <p className="text-sm text-on-surface-variant">
              บัญชีของคุณเข้าสู่ระบบแล้ว แต่ยังไม่ได้ถูกเพิ่มเป็นพนักงานในระบบ
              <br />
              กรุณาแจ้งแอดมินเพื่อเพิ่มชื่อของคุณในหน้า <code className="bg-surface-container px-1.5 py-0.5 rounded">/admin/staff</code>
            </p>
            <p className="text-xs text-on-surface-variant">
              อีเมลที่เข้าสู่ระบบ: <span className="font-mono">{currentEmail}</span>
            </p>
            <button
              onClick={async () => {
                await signOut(auth);
                window.location.href = '/admin/login/';
              }}
              className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container"
            >
              ออกจากระบบ
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// useLayoutEffect on client, useEffect on server (avoids SSR warning)
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Always start 'checking' — real checks happen in effects (client only)
  const [status, setStatus] = useState<'checking' | 'ok' | 'denied'>('checking');

  // Runs synchronously before paint on client — check localStorage instantly
  useIsomorphicLayoutEffect(() => {
    try {
      if (auth.currentUser || localStorage.getItem('admin_auth') === '1') {
        setStatus('ok');
      }
    } catch {}
  }, []);

  // Then verify with Firebase in background
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        try { localStorage.setItem('admin_auth', '1'); } catch {}
        setStatus('ok');
      } else {
        try { localStorage.removeItem('admin_auth'); } catch {}
        setStatus('denied');
      }
    });

    // Timeout: only if still 'checking' (no localStorage flag found)
    const timer = setTimeout(() => {
      setStatus((prev) => (prev === 'checking' ? 'denied' : prev));
    }, 15000);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (status === 'denied') {
      router.replace('/admin/login');
    }
  }, [status, router]);

  if (status === 'ok') return <>{children}</>;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <span className="material-symbols-outlined text-on-surface-variant text-[40px] animate-pulse">
        admin_panel_settings
      </span>
    </div>
  );
}
