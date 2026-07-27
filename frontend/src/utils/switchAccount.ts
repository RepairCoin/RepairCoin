import type { Wallet } from "thirdweb/wallets";
import { authApi } from "@/services/api/auth";
import {
  SAVED_ACCOUNTS_KEY,
  setPendingAccount,
  requestOpenLogin,
  type SavedAccount,
} from "@/utils/savedAccounts";

interface SwitchAccountOptions {
  wallet?: Wallet | null;
  disconnect?: (wallet: Wallet) => void;
  resetAuth: () => void;
  /** Where to land afterwards. Defaults to home. */
  redirectTo?: string;
  /**
   * Switching *to* a specific remembered account — the login screen greets them by
   * name and pre-fills the email instead of starting from a blank sign-in.
   */
  targetAccount?: SavedAccount;
}

/**
 * Log out and go to sign-in — the shared implementation behind "Log out", "Switch
 * account", "Add another account", and the "Switch to <account>" shortcuts.
 *
 * It clears the app session, disconnects the wallet, clears the backend cookie, wipes
 * auth localStorage (preserving the remembered-accounts list, the device id, and
 * accessibility prefs), then reloads to the landing page with the sign-in modal
 * queued to open. When a targetAccount is given, the login screen greets them and
 * pre-fills the email so re-signing-in is quick.
 *
 * Note: this intentionally does NOT try to keep multiple sessions live or bypass
 * re-authentication — connecting the next account is handled by the app's existing
 * wallet-change switch flow (authStore.switchAccount). Instant, no-re-auth switching
 * is a separate, larger piece of work (see docs/updates/FEATURE_MULTI_ACCOUNT_SWITCHING.html).
 */
export async function performSwitchAccount({
  wallet,
  disconnect,
  resetAuth,
  redirectTo = "/",
  targetAccount,
}: SwitchAccountOptions): Promise<void> {
  try {
    resetAuth();

    if (wallet && disconnect) {
      try {
        disconnect(wallet);
      } catch (e) {
        console.warn("Wallet disconnect error (non-blocking):", e);
      }
    }

    // Clear the backend cookie BEFORE wiping storage, so a failure here can't
    // leave us with a live session and no local state.
    try {
      await authApi.logout();
    } catch (e) {
      console.warn("Backend logout error (non-blocking):", e);
    }

    if (typeof window !== "undefined") {
      // Preserve: the remembered-accounts list (it IS the switcher), the device id
      // (stable per-browser id the backend keys sessions on), and accessibility prefs.
      const keysToPreserve = [
        "accessibility-storage",
        SAVED_ACCOUNTS_KEY,
        "repaircoin_device_id",
      ];
      Object.keys(localStorage).forEach((key) => {
        if (!keysToPreserve.includes(key)) localStorage.removeItem(key);
      });
      if (targetAccount) setPendingAccount(targetAccount);
      // Land on the sign-in screen, not the bare landing page.
      requestOpenLogin();
    }
  } finally {
    if (typeof window !== "undefined") window.location.href = redirectTo;
  }
}
