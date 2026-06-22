'use client';

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { useWalletDetection } from "@/hooks/useWalletDetection";
import { useAuthStore } from "@/stores/authStore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/motion/ScrollProgress";

// Critical above-the-fold - imported directly
import HeroSection from "@/components/landing-v4/HeroSection";

// Below-the-fold sections - lazy load with dynamic imports
const ServiceIndustries = dynamic(() => import("@/components/landing-v4/ServiceIndustries"), { ssr: true });
const AllInOne = dynamic(() => import("@/components/landing-v4/AllInOne"), { ssr: true });
const Loyalty = dynamic(() => import("@/components/landing-v4/Loyalty"), { ssr: true });
const Network = dynamic(() => import("@/components/landing-v4/Network"), { ssr: true });
const GetStarted = dynamic(() => import("@/components/landing-v4/GetStarted"), { ssr: true });
const HowItWorks = dynamic(() => import("@/components/landing-v2/HowItWorks"), { ssr: true });
const WhosItFor = dynamic(() => import("@/components/landing-v2/WhosItFor"), { ssr: true });
const Proof = dynamic(() => import("@/components/landing-v2/Proof"), { ssr: true });
const IndustriesAndWhy = dynamic(() => import("@/components/landing-v2/IndustriesAndWhy"), { ssr: true });
const CTASection = dynamic(() => import("@/components/landing-v4/CTASection"), { ssr: true });

export default function LandingPageNew() {
  const router = useRouter();
  const account = useActiveAccount();
  const { isAuthenticated } = useAuthStore();
  const { walletType, isRegistered, isDetecting, isRateLimited, rateLimitMessage } = useWalletDetection();
  const redirectAttemptedRef = React.useRef(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  // Auto-redirect registered users to their dashboard
  React.useEffect(() => {
    if (redirectAttemptedRef.current) {
      return;
    }

    if (account && isRegistered && isAuthenticated && !isDetecting && walletType !== 'unknown') {
      redirectAttemptedRef.current = true;
      setIsRedirecting(true);

      const targetPath = walletType === "admin" ? "/admin" :
                        walletType === "shop" ? "/shop" :
                        "/customer";

      router.push(targetPath);
    }
  }, [account, isRegistered, isAuthenticated, isDetecting, walletType, router]);

  const handleGetStarted = React.useCallback(() => {
    if (!account) {
      return;
    }

    // Don't redirect if rate limited - show error instead
    if (isRateLimited) {
      alert(rateLimitMessage || 'Too many requests. Please wait a few minutes and try again.');
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
        <ScrollProgress />
        <Header />

        {/* Section 1: Hero */}
        <HeroSection
          hasWallet={!!account}
          isDetecting={isDetecting}
          isRedirecting={isRedirecting}
          onGetStartedClick={handleGetStarted}
        />

        {/* Section 2: Service Industries */}
        <ServiceIndustries />

        {/* Section 3: All-In-One Platform */}
        <div id="how-it-works">
          <AllInOne />
        </div>

        {/* Section 4: Loyalty / Rewards */}
        <div id="security">
          <Loyalty />
        </div>

        {/* Section 5: Network */}
        <Network />

        {/* Section 6: Get Started Steps */}
        <div id="why-repaircoin">
          <GetStarted />
        </div>

        {/* Section 7: CTA + Footer */}
        <CTASection />
        <Footer />
      </main>
    </LazyMotion>
  );
}
