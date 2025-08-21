"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { useAuthStore } from "@/stores/authStore";

export default function LogoutPage() {
  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Clear auth store state
        logout();
        
        // Clear any localStorage/sessionStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth-token");
          sessionStorage.clear();
        }
        
        // Disconnect wallet
        if (wallet && disconnect) {
          await disconnect(wallet);
        }
        
        // Redirect to home page
        router.push("/");
      } catch (error) {
        console.error("Error during logout:", error);
        // Even if there's an error, redirect to home
        router.push("/");
      }
    };

    handleLogout();
  }, [disconnect, logout, router, wallet]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto"></div>
        <p className="mt-4 text-gray-300">Logging out...</p>
      </div>
    </div>
  );
}