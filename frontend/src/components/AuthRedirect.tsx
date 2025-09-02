'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AuthRedirect() {
  const { isAuthenticated, userType } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  console.log("userType: ", userType)
  console.log("isAuthenticated: ", isAuthenticated)

  useEffect(() => {
    // Only redirect if authenticated and not already on the correct dashboard
    if (isAuthenticated && userType) {
      // Check if already on the correct dashboard
      const isOnCorrectDashboard = 
        (userType === "admin" && pathname.startsWith("/admin")) ||
        (userType === "shop" && pathname.startsWith("/shop")) ||
        (userType === "customer" && pathname.startsWith("/customer"));

      // Only redirect from landing page or if on wrong dashboard
      const shouldRedirect = pathname === "/" || 
        (pathname.startsWith("/admin") && userType !== "admin") ||
        (pathname.startsWith("/shop") && userType !== "shop") ||
        (pathname.startsWith("/customer") && userType !== "customer");

      if (shouldRedirect && !isOnCorrectDashboard) {
        switch (userType) {
          case "admin":
            router.push("/admin");
            break;
          case "shop":
            router.push("/shop");
            break;
          case "customer":
            router.push("/customer");
            break;
          default:
            console.warn("Unknown user type:", userType);
        }
      }
    }
  }, [isAuthenticated, userType, router, pathname]);

  return null;
}