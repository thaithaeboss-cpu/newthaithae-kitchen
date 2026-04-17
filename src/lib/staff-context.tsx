'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import {
  getStaffByUid,
  getStaffByEmail,
  upsertStaff,
  type Staff,
} from './firestore';
import { isOwnerEmail, OWNER_DEFAULT_NAMES } from './owner';

interface StaffContextValue {
  staff: Staff | null;
  loading: boolean;
  // True when auth is ready but no matching Firestore /staff/{uid} profile exists.
  // Admin should visit /admin/staff to create the profile.
  missingProfile: boolean;
  refresh: () => Promise<void>;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingProfile, setMissingProfile] = useState(false);

  async function load(uid: string | null, email: string | null) {
    if (!uid && !email) {
      setStaff(null);
      setMissingProfile(false);
      setLoading(false);
      return;
    }
    // Try uid first (doc-id lookup, cheap), then fall back to email (query).
    let profile: Staff | null = null;
    if (uid) profile = await getStaffByUid(uid);
    if (!profile && email) profile = await getStaffByEmail(email);

    // Owner fallback: if the authenticated user is on the owner whitelist,
    // always treat them as admin. Auto-create the /staff/{uid} doc if
    // it's missing, so admin@thaithae.com can never be locked out of
    // /admin/* even when the collection is empty or someone deleted them.
    if (!profile && uid && isOwnerEmail(email)) {
      try {
        await upsertStaff(uid, {
          authEmail: (email ?? '').toLowerCase(),
          name: OWNER_DEFAULT_NAMES[uid] ?? 'Admin',
          role: 'admin',
          isActive: true,
        });
        profile = await getStaffByUid(uid);
      } catch (err) {
        console.error('Failed to auto-provision owner profile:', err);
      }
    }

    // Safety net: owner logged in, upsert failed, but we still want them
    // treated as admin so they can access /admin/staff and fix things.
    if (!profile && uid && isOwnerEmail(email)) {
      profile = {
        id: uid,
        authEmail: (email ?? '').toLowerCase(),
        name: OWNER_DEFAULT_NAMES[uid] ?? 'Admin',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Force-promote: owner logged in but their existing doc somehow
    // isn't admin. Heal it in place so they can't be accidentally demoted.
    if (profile && isOwnerEmail(email) && profile.role !== 'admin') {
      try {
        await upsertStaff(profile.id, {
          authEmail: profile.authEmail,
          name: profile.name,
          role: 'admin',
          isActive: true,
        });
        profile = { ...profile, role: 'admin', isActive: true };
      } catch (err) {
        console.error('Failed to re-promote owner to admin:', err);
      }
    }

    setStaff(profile);
    setMissingProfile(!profile);
    setLoading(false);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setLoading(true);
      load(user?.uid ?? null, user?.email ?? null);
    });
    return () => unsub();
  }, []);

  const refresh = async () => {
    const user = auth.currentUser;
    setLoading(true);
    await load(user?.uid ?? null, user?.email ?? null);
  };

  return (
    <StaffContext.Provider value={{ staff, loading, missingProfile, refresh }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff(): StaffContextValue {
  const ctx = useContext(StaffContext);
  if (!ctx) {
    // Called outside the provider — return a safe no-op shape so admin pages
    // that haven't been wrapped yet don't crash during static export.
    return { staff: null, loading: false, missingProfile: false, refresh: async () => {} };
  }
  return ctx;
}

// Convenience: returns { uid, name } in the shape updateOrderStatus expects,
// or null if the logged-in user has no staff profile yet.
export function useActor(): { uid: string; name: string } | null {
  const { staff } = useStaff();
  if (!staff) return null;
  return { uid: staff.id, name: staff.name };
}
