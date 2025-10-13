"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuthStore } from "@/stores/authStore";
import { usePathname } from "next/navigation";

export default function LayoutProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  
  // Don't show header/footer on status page
  const isStatusPage = pathname === '/status';

  return (
    <>
      {!isAuthenticated && !isStatusPage && <Header />}
      {children}
      {!isAuthenticated && !isStatusPage && <Footer />}
    </>
  );
}