"use client";

import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, account } = useAuth();

  console.log("isLoadingisLoading: ", isLoading)
  console.log("accountaccount: ", account)
  console.log("isAuthenticatedisAuthenticated1: ", isAuthenticated)

  return (
    <>
      {!isAuthenticated && <Header />}
      {children}
      {!isAuthenticated && <Footer />}
    </>
  );
}