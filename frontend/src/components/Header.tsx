"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createThirdwebClient } from "thirdweb";
import { ConnectButton, useActiveAccount, useActiveWallet } from "thirdweb/react";
import { getUserEmail } from "thirdweb/wallets/in-app";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Section from "./Section";
import { useAuth } from "@/hooks/useAuth";
import Spinner from "./Spinner";
import { WalletDetectionService } from "@/services/walletDetectionService";
import { useModalStore } from "@/stores/modalStore";
import { authApi } from "@/services/api/auth";
import { useAuthStore } from "@/stores/authStore";

const Header: React.FC = () => {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { isAuthenticated, isLoading, userType } = useAuth();
  const { setUserProfile } = useAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [sessionUserType, setSessionUserType] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isWelcomeModalOpen, openWelcomeModal, closeWelcomeModal } =
    useModalStore();
  const router = useRouter();
  const pathname = usePathname();
  const hasCheckedRef = useRef(false);
  const sessionCheckedRef = useRef(false);
  const previousAccountRef = useRef<string | undefined>(undefined);

  const client = createThirdwebClient({
    clientId:
      process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
      "1969ac335e07ba13ad0f8d1a1de4f6ab",
  });

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Debounced scroll handler for better performance
  const handleScroll = useCallback(() => {
    const isScrolled = window.scrollY > 10;
    if (isScrolled !== scrolled) {
      setScrolled(isScrolled);
    }
  }, [scrolled]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 10);
    };

    window.addEventListener("scroll", debouncedHandleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", debouncedHandleScroll);
    };
  }, [handleScroll]);

  // Check for existing session on mount (for public pages like homepage)
  useEffect(() => {
    // Use ref to prevent multiple calls - more reliable than state
    if (sessionCheckedRef.current) return;
    sessionCheckedRef.current = true;

    const checkSession = async () => {
      try {
        const session = await authApi.getSession();
        if (session.isValid && session.user) {
          const userData = session.user as any;
          setHasValidSession(true);
          setSessionUserType(userData.type || userData.role);

          // Refresh the auth_token cookie so the Next.js middleware
          // won't block navigation to protected routes (the access
          // token cookie has a short 15-min maxAge and may be expired
          // even though the refresh token is still valid).
          await authApi.refreshToken();
        }
      } catch (error) {
        // No valid session - this is normal for logged out users
      } finally {
        setSessionChecked(true);
      }
    };

    checkSession();
  }, []); // Empty dependency - only run once on mount

  // Track when modal opens to mark the start of a sign-in flow
  const signInInitiatedRef = useRef(false);

  useEffect(() => {
    if (isWelcomeModalOpen) {
      // User opened the modal - mark that a sign-in was initiated
      console.log("🟦 [Header] Modal opened - marking sign-in initiated");
      signInInitiatedRef.current = true;
    }
  }, [isWelcomeModalOpen]);

  // Handle wallet connection after sign-in
  useEffect(() => {
    console.log("🟦 [Header] useEffect triggered", {
      hasAccount: !!account?.address,
      address: account?.address,
      previousRef: previousAccountRef.current,
      signInInitiated: signInInitiatedRef.current,
      hasChecked: hasCheckedRef.current,
    });

    if (account?.address) {
      // Check if this is from a user-initiated sign-in (modal was opened)
      const isNewSignIn =
        signInInitiatedRef.current &&
        previousAccountRef.current !== account.address;

      console.log("🟦 [Header] Connection analysis", {
        isNewSignIn,
        currentAddress: account.address,
        previousAddress: previousAccountRef.current,
        signInWasInitiated: signInInitiatedRef.current,
      });

      if (isNewSignIn && !hasCheckedRef.current) {
        console.log(
          "🟦 [Header] ✅ NEW SIGN-IN detected - checking registration"
        );

        // Mark as checked to prevent duplicate checks
        hasCheckedRef.current = true;
        signInInitiatedRef.current = false; // Reset the flag

        // Check wallet registration status and redirect if needed
        const checkAndRedirect = async () => {
          try {
            // Small delay to ensure Thirdweb has fully initialized the wallet
            // This allows getUserEmail to return the email for social login
            await new Promise(resolve => setTimeout(resolve, 500));

            const detector = WalletDetectionService.getInstance();

            // ALWAYS try to get email for social login fallback
            // This allows shops registered with MetaMask to login via Google if their email matches
            let userEmail: string | undefined;
            try {
              // Use Thirdweb v5's official getUserEmail function
              // Try this regardless of wallet type (wallet object might not be ready yet)
              userEmail = await getUserEmail({ client });

              if (userEmail) {
                console.log('🟦 [Header] Found email for social login via getUserEmail:', userEmail);
              } else {
                // Fallback to localStorage for Thirdweb auth data
                const authData = localStorage.getItem('thirdweb:in-app-wallet-user-id');
                if (authData && authData.includes('@')) {
                  userEmail = authData;
                  console.log('🟦 [Header] Found email from localStorage:', userEmail);
                }
              }
            } catch (e) {
              // This is expected for non-embedded wallets, just continue without email
              console.log('🟦 [Header] No email available (expected for external wallets)');
            }

            const result = await detector.detectWalletType(account.address, userEmail);

            console.log("🟦 [Header] Detection result:", result);

            if (!result.isRegistered) {
              // Check if rate limited
              if (result.route === '/rate-limited') {
                console.error('🟦 [Header] ⚠️ Rate limited - please wait and try again');
                closeWelcomeModal();
                // Show error to user via alert (could be improved with toast)
                alert(result.data?.message || 'Too many requests. Please wait a few minutes and try again.');
                // Reset check flags
                hasCheckedRef.current = false;
                return;
              }
              console.log(
                "🟦 [Header] 🔄 New user detected, redirecting to /choose..."
              );
              closeWelcomeModal(); // Close modal before redirect
              setTimeout(() => {
                router.push("/choose");
              }, 100);
            } else {
              console.log(
                "🟦 [Header] ✅ Registered user, authenticating..."
              );

              // IMPORTANT: Create session before redirecting
              // Pass email for social login fallback (shop registered with MetaMask, logging in with Google)
              try {
                const { authApi } = await import('@/services/api/auth');
                const { useAuthStore } = await import('@/stores/authStore');

                if (result.type === 'shop') {
                  const authResult = await authApi.authenticateShop(account.address, userEmail);
                  console.log('🟦 [Header] Shop session created:', authResult);

                  // Update authStore with user profile from authentication response
                  if (authResult && authResult.user) {
                    const userData = authResult.user as any;
                    useAuthStore.getState().setUserProfile({
                      id: userData.id || userData.shopId || account.address,
                      address: userData.walletAddress || userData.address || account.address,
                      type: 'shop',
                      name: userData.name,
                      email: userData.email,
                      isActive: userData.active,
                      shopId: userData.shopId,
                      registrationDate: userData.createdAt,
                    });
                    console.log('🟦 [Header] Auth store updated with shop profile');
                  }
                } else if (result.type === 'customer') {
                  const authResult = await authApi.authenticateCustomer(account.address);
                  console.log('🟦 [Header] Customer session created');

                  // Update authStore with user profile
                  if (authResult && authResult.user) {
                    const userData = authResult.user as any;
                    // Convert tier to lowercase to match UserProfile type
                    const tierLower = userData.tier?.toLowerCase() as 'bronze' | 'silver' | 'gold' | undefined;
                    useAuthStore.getState().setUserProfile({
                      id: userData.id || account.address,
                      address: userData.address || account.address,
                      type: 'customer',
                      name: userData.name,
                      email: userData.email,
                      isActive: userData.active,
                      tier: tierLower,
                      registrationDate: userData.createdAt,
                    });
                    console.log('🟦 [Header] Auth store updated with customer profile');
                  }
                } else if (result.type === 'admin') {
                  const authResult = await authApi.authenticateAdmin(account.address);
                  console.log('🟦 [Header] Admin session created');

                  // Update authStore with user profile
                  if (authResult && authResult.user) {
                    const userData = authResult.user as any;
                    useAuthStore.getState().setUserProfile({
                      id: userData.id || account.address,
                      address: userData.address || account.address,
                      type: 'admin',
                      name: userData.name,
                      email: userData.email,
                      isActive: userData.active,
                      registrationDate: userData.createdAt,
                    });
                    console.log('🟦 [Header] Auth store updated with admin profile');
                  }
                }
              } catch (authError) {
                console.error('🟦 [Header] Failed to create session:', authError);
                // Still try to redirect - they might already have a valid session
              }

              closeWelcomeModal(); // Close modal
              console.log("🟦 [Header] Redirecting to dashboard...");
              setTimeout(() => {
                router.push(result.route);
              }, 100);
            }
          } catch (error) {
            console.error("🟦 [Header] ❌ Error detecting wallet:", error);
          }
        };

        checkAndRedirect();
      } else if (previousAccountRef.current !== account.address) {
        console.log(
          "🟦 [Header] Address changed but not from modal sign-in (page load)"
        );
      }

      // Update tracked address
      previousAccountRef.current = account.address;
    } else if (!account?.address && previousAccountRef.current) {
      // Reset everything when wallet disconnects
      console.log("🟦 [Header] Wallet disconnected - resetting all refs");
      previousAccountRef.current = undefined;
      hasCheckedRef.current = false;
      signInInitiatedRef.current = false;
    }
  }, [account?.address, router, isWelcomeModalOpen, closeWelcomeModal]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 z-50 w-full transition-all duration-300 ${
          scrolled ? "bg-black/90 backdrop-blur-sm shadow-md" : "bg-transparent"
        }`}
      >
        <nav className="py-4">
          <Section>
            <div className="flex flex-wrap justify-between items-center w-full relative">
              {/* Logo */}
              <Link href="/" className="flex items-center flex-shrink-0">
                <div className="flex items-center relative w-[180px] h-[40px]">
                  <Image
                    src="/img/nav-logo.png"
                    alt="RepairCoin Logo"
                    fill
                    priority
                    sizes="180px"
                    className="object-contain"
                  />
                </div>
              </Link>

              {/* Mobile menu button */}
              <div className="flex lg:hidden">
                <button
                  onClick={toggleMenu}
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  aria-controls="mobile-menu"
                  aria-expanded="false"
                >
                  <span className="sr-only">Open main menu</span>
                  {!isMenuOpen ? (
                    <svg
                      className="block h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="block h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Desktop Navigation - Centered */}
              <nav className="hidden lg:flex items-center absolute left-1/2 transform -translate-x-1/2">
                <ul className="flex space-x-6">
                  {["Home", "Features", "Rewards", "About"].map((item) => {
                    const href =
                      item === "Home" ? "/" : `/${item.toLowerCase()}`;
                    const isActive =
                      pathname?.toLowerCase() === href.toLowerCase();

                    return (
                      <li key={item}>
                        <Link
                          href={href}
                          className={`${
                            isActive ? "text-[#F7CC00]" : "text-white"
                          } hover:text-[#F7CC00] px-3 py-2 text-sm font-medium transition-colors duration-200`}
                        >
                          {item}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Auth Buttons */}
              <div className="hidden lg:flex items-center">
                {isLoading || !sessionChecked ? (
                  <button
                    disabled
                    className="text-black bg-[#F7CC00] px-6 py-2 rounded-md text-sm font-semibold opacity-50 cursor-not-allowed flex items-center justify-center min-w-[90px]"
                  >
                    <Spinner className="w-5 h-5" />
                  </button>
                ) : account?.address ? (
                  <div className="flex justify-center items-center">
                    <ConnectButton
                      client={client}
                      connectModal={{ size: "wide" }}
                    />
                  </div>
                ) : (isAuthenticated && userType) || (hasValidSession && sessionUserType) ? (
                  <button
                    onClick={() => router.push(`/${userType || sessionUserType}`)}
                    className="text-black bg-[#F7CC00] hover:bg-[#E5BB00] px-6 py-2 rounded-md text-sm font-semibold transition-all duration-200 flex items-center justify-center min-w-[90px]"
                  >
                    Dashboard
                  </button>
                ) : (
                  <button
                    onClick={openWelcomeModal}
                    className="text-black bg-[#F7CC00] hover:bg-[#E5BB00] px-6 py-2 rounded-md text-sm font-semibold transition-all duration-200 flex items-center justify-center min-w-[90px]"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Navigation */}
            {isMenuOpen && (
              <div className="lg:hidden bg-white" id="mobile-menu">
                <div className="px-4 py-4 space-y-4">
                  {/* Navigation Links */}
                  <nav className="flex flex-col items-center space-y-3">
                    {["Home", "Features", "Rewards", "About"].map((item) => {
                      const href =
                        item === "Home" ? "/" : `/${item.toLowerCase()}`;
                      const isActive =
                        pathname?.toLowerCase() === href.toLowerCase();

                      return (
                        <Link
                          key={`mobile-${item}`}
                          href={href}
                          className={`w-full text-center px-4 py-3 text-base font-medium ${
                            isActive ? "text-[#F7CC00]" : "text-black"
                          } hover:text-[#F7CC00] hover:bg-gray-900/50 rounded-lg transition-colors duration-200`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {item}
                        </Link>
                      );
                    })}
                  </nav>

                  {/* Auth Buttons */}
                  <div className="pt-2 space-y-3">
                    {isLoading || !sessionChecked ? (
                      <button
                        disabled
                        className="w-full px-4 py-3 text-base font-semibold text-center text-black bg-[#F7CC00] rounded-md opacity-50 cursor-not-allowed flex items-center justify-center"
                      >
                        <Spinner className="w-5 h-5" />
                      </button>
                    ) : account?.address ? (
                      <div className="flex justify-center items-center">
                        <ConnectButton
                          client={client}
                          connectModal={{ size: "wide" }}
                        />
                      </div>
                    ) : (isAuthenticated && userType) || (hasValidSession && sessionUserType) ? (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          router.push(`/${userType || sessionUserType}`);
                        }}
                        className="w-full px-4 py-3 text-base font-semibold text-center text-black bg-[#F7CC00] hover:bg-[#E5BB00] rounded-md transition-colors duration-200 flex items-center justify-center"
                      >
                        Dashboard
                      </button>
                    ) : (
                      <button
                        onClick={openWelcomeModal}
                        className="w-full px-4 py-3 text-base font-semibold text-center text-black bg-[#F7CC00] hover:bg-[#E5BB00] rounded-md transition-colors duration-200 flex items-center justify-center"
                      >
                        Login
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Section>
        </nav>
      </header>

      {/* Login Modal */}
      {isWelcomeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeWelcomeModal}
          />

          {/* Modal Content */}
          <div className="relative bg-gray-100 rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl overflow-hidden">
            {/* Close button */}
            <button
              onClick={closeWelcomeModal}
              className="absolute top-6 right-6 text-gray-500 hover:text-gray-700 transition-colors z-10"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="flex flex-col md:flex-row items-center gap-8 h-full">
              {/* Left Content */}
              <div className="flex-1 h-full flex flex-col items-center space-y-10 text-center md:text-left">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                  <h1 className="text-4xl md:text-4xl text-center font-bold text-gray-900 leading-tight">
                    Welcome to
                    <br />
                    RepairCoin
                  </h1>
                  <p className="text-gray-500 text-center text-sm">
                    Earn. Track. Redeem. Log in to manage your rewards and
                    repairs.
                  </p>
                </div>

                {/* Connect Wallet Button */}
                <div className="pt-4 w-full">
                  <ConnectButton
                    client={client}
                    connectModal={{ size: "wide" }}
                    connectButton={{
                      label: "Connect Wallet",
                      className:
                        "!bg-[#F7CC00] hover:!bg-[#E5BB00] !text-gray-900 !justify-center !w-full !font-semibold !px-8 !py-3 !rounded-full !inline-flex !items-center !gap-3 !transition-all !duration-200 !shadow-lg hover:!shadow-xl !border-none",
                      style: {
                        backgroundColor: "#F7CC00",
                        color: "#111827",
                        borderRadius: "9999px",
                        fontWeight: "600",
                        width: "100%",
                        justifyContent: "center",
                        padding: "0.75rem 2rem",
                        boxShadow:
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                      },
                    }}
                  />
                </div>
              </div>

              {/* Right Content - Character Illustrations */}
              <div className="flex-1 relative h-64 md:h-80">
                <Image
                  src="/img/connect-modal.png"
                  alt="RepairCoin Characters"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
