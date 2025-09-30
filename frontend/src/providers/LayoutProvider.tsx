"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuthStore } from "@/stores/authStore";

export default function LayoutProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      {!isAuthenticated && <Header />}
      {children}
      {!isAuthenticated && <Footer />}
    </>
  );
}