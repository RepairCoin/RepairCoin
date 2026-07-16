"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { toast } from "react-hot-toast";
import { client } from "@/utils/thirdweb";
import { acceptInvite } from "@/services/api/team";
import { useAuthStore } from "@/stores/authStore";

function AcceptInner() {
  const params = useSearchParams();
  const router = useRouter();
  const account = useActiveAccount();
  const token = params.get("token");

  const [status, setStatus] = useState<"idle" | "accepting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleAccept = async () => {
    if (!token) {
      setMessage("This invitation link is missing its token.");
      setStatus("error");
      return;
    }
    if (!account?.address) return;

    setStatus("accepting");
    try {
      await acceptInvite(token, account.address);
      setStatus("done");
      // The member now has a wallet on record, so login resolves by wallet alone.
      await useAuthStore.getState().login(account.address);
      toast.success("Welcome to the team!");
      router.replace("/shop");
    } catch (e: any) {
      setMessage(e?.message || "Failed to accept the invitation.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101010] p-4">
      <div className="w-full max-w-md bg-[#1a1b1e] border border-[#303236] rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Join your team on RepairCoin</h1>

        {!token ? (
          <p className="text-red-300 mt-4">This invitation link is invalid or incomplete.</p>
        ) : status === "error" ? (
          <>
            <p className="text-red-300 mt-4 mb-6">{message}</p>
            <button
              onClick={() => setStatus("idle")}
              className="px-5 py-2.5 rounded-lg bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700]"
            >
              Try again
            </button>
          </>
        ) : status === "done" ? (
          <p className="text-green-300 mt-4">Invitation accepted — taking you to your dashboard…</p>
        ) : !account ? (
          <>
            <p className="text-gray-400 mb-6">
              Sign in with the email your invitation was sent to. We&apos;ll set up your secure account
              automatically — no technical experience needed.
            </p>
            <div className="flex justify-center">
              <ConnectButton client={client} theme="dark" connectModal={{ size: "compact" }} />
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-400 mb-2">Signed in as</p>
            <p className="text-white font-mono text-sm mb-6 break-all">{account.address}</p>
            <button
              onClick={handleAccept}
              disabled={status === "accepting"}
              className="px-6 py-3 rounded-lg bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] disabled:opacity-50"
            >
              {status === "accepting" ? "Accepting…" : "Accept invitation"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function TeamAcceptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#101010]" />}>
      <AcceptInner />
    </Suspense>
  );
}
