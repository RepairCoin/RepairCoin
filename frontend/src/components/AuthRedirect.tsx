'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AuthRedirect() {
  const { isAuthenticated, userType } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && userType) {
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
  }, [isAuthenticated, userType, router]);

  return null;
}