"use client";

import React, { useState, useEffect, useRef } from "react";
import { createThirdwebClient } from "thirdweb";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Section from "./Section";
import { useAuth } from "@/hooks/useAuth";
import Spinner from "./Spinner";
import { WalletDetectionService } from "@/services/walletDetectionService";
import { useModalStore } from "@/stores/modalStore";

const Header: React.FC = () => {
  const account = useActiveAccount();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isWelcomeModalOpen, openWelcomeModal, closeWelcomeModal } = useModalStore();
  const router = useRouter();
  const pathname = usePathname();
  const hasCheckedRef = useRef(false);
  const previousAccountRef = useRef<string | undefined>(undefined);

  const client = createThirdwebClient({
    clientId:
      process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
      "1969ac335e07ba13ad0f8d1a1de4f6ab",
  });

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrolled]);

  // Track when modal opens to mark the start of a sign-in flow
  const signInInitiatedRef = useRef(false);

  useEffect(() => {
    if (isWelcomeModalOpen) {
      // User opened the modal - mark that a sign-in was initiated
      console.log('🟦 [Header] Modal opened - marking sign-in initiated');
      signInInitiatedRef.current = true;
    }
  }, [isWelcomeModalOpen]);

  // Handle wallet connection after sign-in
  useEffect(() => {
    console.log('🟦 [Header] useEffect triggered', {
      hasAccount: !!account?.address,
      address: account?.address,
      previousRef: previousAccountRef.current,
      signInInitiated: signInInitiatedRef.current,
      hasChecked: hasCheckedRef.current
    });

    if (account?.address) {
      // Check if this is from a user-initiated sign-in (modal was opened)
      const isNewSignIn = signInInitiatedRef.current && previousAccountRef.current !== account.address;
      
      console.log('🟦 [Header] Connection analysis', {
        isNewSignIn,
        currentAddress: account.address,
        previousAddress: previousAccountRef.current,
        signInWasInitiated: signInInitiatedRef.current
      });

      if (isNewSignIn && !hasCheckedRef.current) {
        console.log('🟦 [Header] ✅ NEW SIGN-IN detected - checking registration');
        
        // Mark as checked to prevent duplicate checks
        hasCheckedRef.current = true;
        signInInitiatedRef.current = false; // Reset the flag
        
        // Check wallet registration status and redirect if needed
        const checkAndRedirect = async () => {
          try {
            const detector = WalletDetectionService.getInstance();
            const result = await detector.detectWalletType(account.address);
            
            console.log('� [Header] Detection result:', result);
            
            if (!result.isRegistered) {
              console.log('🟦 [Header] 🔄 New user detected, redirecting to /choose...');
              closeWelcomeModal(); // Close modal before redirect
              setTimeout(() => {
                router.push('/choose');
              }, 100);
            } else {
              console.log('🟦 [Header] ✅ Registered user, staying on current page');
              closeWelcomeModal(); // Close modal anyway
            }
          } catch (error) {
            console.error('🟦 [Header] ❌ Error detecting wallet:', error);
          }
        };
        
        checkAndRedirect();
      } else if (previousAccountRef.current !== account.address) {
        console.log('🟦 [Header] Address changed but not from modal sign-in (page load)');
      }
      
      // Update tracked address
      previousAccountRef.current = account.address;
      
    } else if (!account?.address && previousAccountRef.current) {
      // Reset everything when wallet disconnects
      console.log('🟦 [Header] Wallet disconnected - resetting all refs');
      previousAccountRef.current = undefined;
      hasCheckedRef.current = false;
      signInInitiatedRef.current = false;
    }
  }, [account?.address, router, isWelcomeModalOpen, closeWelcomeModal]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 z-50 w-full transition-all duration-300 ${scrolled
          ? "bg-black/90 backdrop-blur-sm shadow-md"
          : "bg-transparent"
          }`}
      >
        <nav className="py-4">
          <Section>
            <div className="flex flex-wrap justify-between items-center w-full relative">
              {/* Logo */}
              <Link href="/" className="flex items-center flex-shrink-0">
                <div className="flex items-center">
                  <img src="/img/nav-logo.png" alt="" />
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
                    const href = item === "Home" ? "/" : `/${item.toLowerCase()}`;
                    const isActive = pathname?.toLowerCase() === href.toLowerCase();

                    return (
                      <li key={item}>
                        <Link
                          href={href}
                          className={`${
                            isActive
                              ? "text-[#F7CC00]"
                              : "text-white"
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
                {
                  account?.address && !isLoading ? (
                    <div className="flex justify-center items-center">
                      <ConnectButton
                        client={client}
                        connectModal={{ size: "wide" }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={openWelcomeModal}
                      disabled={isLoading}
                      className="text-black bg-[#F7CC00] hover:bg-[#E5BB00] px-6 py-2 rounded-md text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[90px]"
                    >
                      {isLoading ? <Spinner className="w-5 h-5" /> : "Login"}
                    </button>
                  )
                }
              </div>
            </div>

            {/* Mobile Navigation */}
            {isMenuOpen && (
              <div className="lg:hidden bg-white" id="mobile-menu">
                <div className="px-4 py-4 space-y-4">
                  {/* Navigation Links */}
                  <nav className="flex flex-col items-center space-y-3">
                    {["Home", "Features", "Rewards", "About"].map(
                      (item) => {
                        const href = item === "Home" ? "/" : `/${item.toLowerCase()}`;
                        const isActive = pathname?.toLowerCase() === href.toLowerCase();

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
                      }
                    )}
                  </nav>

                  {/* Auth Buttons */}
                  <div className="pt-2 space-y-3">
                    {account?.address && !isLoading ? (
                      <div className="flex justify-center items-center">
                        <ConnectButton 
                          client={client}
                          connectModal={{ size: "wide" }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={openWelcomeModal}
                        disabled={isLoading}
                        className="w-full px-4 py-3 text-base font-semibold text-center text-black bg-[#F7CC00] hover:bg-[#E5BB00] rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isLoading ? <Spinner className="w-5 h-5" /> : "Login"}
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
                      className: "!bg-[#F7CC00] hover:!bg-[#E5BB00] !text-gray-900 !justify-center !w-full !font-semibold !px-8 !py-3 !rounded-full !inline-flex !items-center !gap-3 !transition-all !duration-200 !shadow-lg hover:!shadow-xl !border-none",
                      style: {
                        backgroundColor: "#F7CC00",
                        color: "#111827",
                        borderRadius: "9999px",
                        fontWeight: "600",
                        width: "100%",
                        justifyContent: "center",
                        padding: "0.75rem 2rem",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                      }
                    }}
                  />
                </div>
              </div>

              {/* Right Content - Character Illustrations */}
              <div className="flex-1 relative h-64 md:h-80">
                <img
                  src="/img/connect-modal.png"
                  alt="RepairCoin Characters"
                  className="absolute inset-0 w-full h-full object-contain"
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
