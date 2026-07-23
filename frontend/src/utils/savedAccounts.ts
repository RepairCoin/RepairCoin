/**
 * Remembered accounts — the "switch between my accounts" list.
 *
 * We cannot keep two sessions live at once (each account is a separate wallet, and
 * signing in needs that account's own proof — an email OTP or a wallet signature).
 * So this is a *picker*, not a session pool: we remember who you've signed in as on
 * this device, and clicking one takes you straight to its sign-in with the email
 * pre-filled, instead of making you log out and retype it.
 *
 * Stored locally only — addresses, display names and avatars, never credentials.
 */

export const SAVED_ACCOUNTS_KEY = "repaircoin:saved-accounts";
/** Which account the user is on their way to sign in as (read once on the login screen). */
export const PENDING_ACCOUNT_KEY = "repaircoin:pending-account";
/** Set before a redirect to tell the landing page to open the sign-in modal on load. */
export const OPEN_LOGIN_KEY = "repaircoin:open-login";

/** Ask the landing page to auto-open sign-in after the next load. */
export function requestOpenLogin(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(OPEN_LOGIN_KEY, "1");
  } catch {
    /* non-blocking */
  }
}

/** Read + clear the open-login request (one-shot). */
export function consumeOpenLogin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(OPEN_LOGIN_KEY) !== "1") return false;
    sessionStorage.removeItem(OPEN_LOGIN_KEY);
    return true;
  } catch {
    return false;
  }
}

const MAX_SAVED = 5;

export interface SavedAccount {
  address: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  /** 'customer' | 'shop' | 'admin' — used for the badge in the picker. */
  role?: string;
  lastUsedAt: number;
}

function read(key: string, storage: Storage): SavedAccount[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is SavedAccount =>
        !!a && typeof a === "object" && typeof (a as SavedAccount).address === "string"
    );
  } catch {
    return [];
  }
}

/** Most-recently-used first. */
export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  return read(SAVED_ACCOUNTS_KEY, localStorage).sort(
    (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
  );
}

/** Add or refresh an account (deduped by address, case-insensitive). */
export function rememberAccount(
  account: Omit<SavedAccount, "lastUsedAt">
): void {
  if (typeof window === "undefined" || !account.address) return;
  try {
    const address = account.address.toLowerCase();
    const existing = getSavedAccounts().filter(
      (a) => a.address.toLowerCase() !== address
    );
    const next: SavedAccount[] = [
      { ...account, address, lastUsedAt: Date.now() },
      ...existing,
    ].slice(0, MAX_SAVED);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    /* storage full / disabled — the picker just won't remember */
  }
}

/** Remove one account from the picker. */
export function forgetAccount(address: string): SavedAccount[] {
  if (typeof window === "undefined") return [];
  const next = getSavedAccounts().filter(
    (a) => a.address.toLowerCase() !== address.toLowerCase()
  );
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    /* non-blocking */
  }
  return next;
}

/** Stash the account we're about to sign in as, so the login screen can greet/prefill. */
export function setPendingAccount(account: SavedAccount): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    /* non-blocking */
  }
}

/** Read + clear the pending account (one-shot). */
export function consumePendingAccount(): SavedAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ACCOUNT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_ACCOUNT_KEY);
    const parsed = JSON.parse(raw) as SavedAccount;
    return parsed?.address ? parsed : null;
  } catch {
    return null;
  }
}
