"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight, X, Loader2, ArrowLeft } from "lucide-react";
import { useConnect } from "thirdweb/react";
import { inAppWallet, preAuthenticate } from "thirdweb/wallets";
import { baseSepolia } from "thirdweb/chains";
import { toast } from "react-hot-toast";
import { client } from "@/utils/thirdweb";
import {
  getSavedAccounts,
  forgetAccount,
  type SavedAccount,
} from "@/utils/savedAccounts";

/**
 * Facebook-style saved-profiles login. After logging out, the login modal lists the
 * accounts used on this device; clicking one with an email sends a verification code
 * and signs the user straight back in (the app's existing auth flow takes over once
 * the wallet connects). Accounts without an email, and "Use another profile", fall
 * through to the standard connect UI supplied via `renderConnect`.
 *
 * This is purely the LOGIN path — it does not touch session-switching machinery.
 */

interface SavedProfilesLoginProps {
  /** Whether to offer the saved-profiles list (login intent only, not sign-up). */
  enabled: boolean;
  /** The standard Thirdweb connect UI, shown for "Use another profile" / no saved accounts. */
  renderConnect: () => React.ReactNode;
}

const shorten = (addr: string) =>
  addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

export const SavedProfilesLogin: React.FC<SavedProfilesLoginProps> = ({
  enabled,
  renderConnect,
}) => {
  const { connect } = useConnect();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [useAnother, setUseAnother] = useState(false);

  // OTP flow state
  const [selected, setSelected] = useState<SavedAccount | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(getSavedAccounts());
  }, []);

  // No saved accounts, sign-up flow, or user chose another profile → standard connect.
  if (!enabled || useAnother || (accounts.length === 0 && !selected)) {
    return <>{renderConnect()}</>;
  }

  const sendCode = async (account: SavedAccount) => {
    if (!account.email) {
      // No email on file (e.g. an external wallet) — use the normal connect instead.
      setUseAnother(true);
      return;
    }
    setSelected(account);
    setSending(true);
    setError(null);
    try {
      await preAuthenticate({ client, strategy: "email", email: account.email });
      toast.success(`Verification code sent to ${account.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send code";
      setError(msg);
      toast.error(msg);
      setSelected(null);
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!selected?.email || !code.trim()) {
      toast.error("Enter the verification code");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      // Connect into the GLOBAL wallet manager so useActiveAccount updates and the
      // app's existing auth flow authenticates + redirects.
      await connect(async () => {
        const wallet = inAppWallet();
        await wallet.connect({
          client,
          chain: baseSepolia,
          strategy: "email",
          email: selected.email!,
          verificationCode: code.trim(),
        });
        return wallet;
      });
      // Auth + redirect are handled by the wallet-change listeners once connected.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      setError(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const remove = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    setAccounts(forgetAccount(address));
  };

  // ---- OTP step ------------------------------------------------------------
  if (selected) {
    return (
      <div className="w-full text-left">
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setCode("");
            setError(null);
          }}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <p className="text-sm text-gray-700">
          Enter the code sent to{" "}
          <span className="font-semibold text-gray-900">{selected.email}</span>
        </p>

        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          placeholder="Verification code"
          disabled={verifying}
          className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg tracking-widest text-gray-900 focus:border-[#F7CC00] focus:outline-none focus:ring-1 focus:ring-[#F7CC00] disabled:opacity-60"
        />

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <button
          type="button"
          onClick={verify}
          disabled={verifying || !code.trim()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#F7CC00] px-8 py-3 font-semibold text-gray-900 transition-colors hover:bg-[#E5BB00] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>

        <button
          type="button"
          onClick={() => selected && sendCode(selected)}
          disabled={sending || verifying}
          className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-800 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Resend code"}
        </button>
      </div>
    );
  }

  // ---- Profiles list -------------------------------------------------------
  return (
    <div className="w-full text-left">
      <div className="space-y-1.5">
        {accounts.map((account) => (
          <button
            key={account.address}
            type="button"
            onClick={() => sendCode(account)}
            disabled={sending}
            className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {account.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F7CC00] text-sm font-bold text-gray-900">
                {(account.name || account.address).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-900">
                {account.name || shorten(account.address)}
              </span>
              {account.email && (
                <span className="block truncate text-xs text-gray-500">
                  {account.email}
                </span>
              )}
            </span>
            <span
              role="button"
              tabIndex={-1}
              aria-label="Remove profile"
              onClick={(e) => remove(e, account.address)}
              className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setUseAnother(true)}
        className="mt-3 w-full rounded-full border border-gray-300 px-8 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        Use another profile
      </button>
    </div>
  );
};

export default SavedProfilesLogin;
