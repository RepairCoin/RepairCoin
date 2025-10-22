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
  
  // Public pages that should always show header/footer
  const publicPages = ['/', '/features', '/rewards', '/about', '/choose'];
  const isPublicPage = publicPages.includes(pathname);
  
  // Show header/footer on public pages or when not authenticated
  const shouldShowHeaderFooter = (isPublicPage || !isAuthenticated) && !isStatusPage;

  return (
    <>
      {shouldShowHeaderFooter && <Header />}
      {children}
      {shouldShowHeaderFooter && <Footer />}
    </>
  );
}