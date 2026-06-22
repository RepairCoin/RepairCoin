'use client';

import React from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { useWalletDetection } from "@/hooks/useWalletDetection";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/landing-v4/HeroSection";

export default function LandingV4Page() {
  const router = useRouter();
  const account = useActiveAccount();
  const { walletType, isRegistered, isDetecting, isRateLimited, rateLimitMessage } =
    useWalletDetection();
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  const handleGetStarted = React.useCallback(() => {
    if (!account) {
      return;
    }

    if (isRateLimited) {
      alert(
        rateLimitMessage ||
          "Too many requests. Please wait a few minutes and try again."
      );
      return;
    }

    setIsRedirecting(true);

    if (isRegistered) {
      switch (walletType) {
        case "admin":
          router.push("/admin");
          break;
        case "shop":
          router.push("/shop?tab=profile");
          break;
        case "customer":
          router.push("/customer");
          break;
      }
    } else {
      router.push("/choose");
    }
  }, [account, isRegistered, isRateLimited, rateLimitMessage, walletType, router]);

  return (
    <LazyMotion features={domAnimation}>
      <main className="bg-[#0a0a0a] min-h-screen overflow-x-clip">
        <Header />

        <HeroSection
          hasWallet={!!account}
          isDetecting={isDetecting}
          isRedirecting={isRedirecting}
          onGetStartedClick={handleGetStarted}
        />

        <Footer />
      </main>
    </LazyMotion>
  );
}
