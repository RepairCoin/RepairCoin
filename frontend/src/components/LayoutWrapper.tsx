"use client";

import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {!isAuthenticated && <Header />}
      {children}
      {!isAuthenticated && <Footer />}
    </>
  );
}