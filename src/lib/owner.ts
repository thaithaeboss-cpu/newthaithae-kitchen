// ============================================================
// Owner whitelist
// ============================================================
//
// Hardcoded owner account(s). These emails are ALWAYS treated as admin,
// regardless of the /staff collection state. This protects against two
// failure modes:
//
//   1. Accidental lockout — the owner cannot be deleted or demoted from
//      the UI, so they always have a path back into /admin/*.
//   2. Bootstrap hijack — if the staff collection is empty, only an
//      owner can self-register as admin. A branch account that wanders
//      into /admin/* cannot claim the admin role anymore.
//
// Owner profile is auto-created on first login (if missing) via
// staff-context.tsx.

export const OWNER_EMAILS: readonly string[] = [
  'admin@thaithae.com',
];

/** Optional well-known uid -> display name map, used only when we need a
 *  sensible default for the auto-created /staff/{uid} doc. */
export const OWNER_DEFAULT_NAMES: Record<string, string> = {
  'IdrhAcXoqKXl3I6oUJuh4GFSxgi2': 'Admin',
};

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase());
}
