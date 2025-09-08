"use client";

import React from "react";
import Section from "@/components/Section";
import { DualAuthConnect } from "@/components/auth/DualAuthConnect";

interface LandingHeroProps {
  // Background images
  backgroundImage: string;
  techBgImage: string;
  hero1BgImage: string;
  
  // State props from parent
  hasWallet: boolean;
  isDetecting: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  showAuthModal: boolean;
  
  // Event handlers from parent
  onGetStartedClick: () => void;
  onAuthModalOpen: () => void;
  onAuthModalClose: () => void;
  onAuthConnect: (address: string, method: string) => void;
  onAuthError: (error: any) => void;
  
  // Display text
  buttonText?: string;
  statusMessage?: React.ReactNode;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  backgroundImage,
  techBgImage,
  hero1BgImage,
  hasWallet,
  isDetecting,
  isRegistered,
  isAuthenticated,
  showAuthModal,
  onGetStartedClick,
  onAuthModalOpen,
  onAuthModalClose,
  onAuthConnect,
  onAuthError,
  buttonText,
  statusMessage,
}) => {
  const getButtonContent = () => {
    if (isDetecting) {
      return "Detecting Wallet...";
    }
    
    if (isRegistered && isAuthenticated) {
      return (
        <div className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-black"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Redirecting to Dashboard...</span>
        </div>
      );
    }
    
    if (buttonText) {
      return buttonText;
    }
    
    if (isRegistered) {
      return (
        <>
          Go to Dashboard{" "}
          <span className="ml-2 text-sm md:text-base xl:text-lg">→</span>
        </>
      );
    }
    
    return (
      <>
        Get Started{" "}
        <span className="ml-2 text-sm md:text-base xl:text-lg">→</span>
      </>
    );
  };

  return (
    <div className="relative h-screen md:h-[70vh] xl:h-screen w-full bg-[#0D0D0D]">
      {/* Mobile View - Two Split Backgrounds */}
      <div className="md:hidden h-full w-full flex flex-col">
        {/* Top half background */}
        <div
          className="h-3/4 w-full"
          style={{
            backgroundImage: `url(${techBgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        {/* Bottom half background */}
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `url(${hero1BgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>

      {/* Desktop Background */}
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Content - Positioned at top with responsive padding */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-28 md:pt-48">
        <Section>
          <div className="flex w-full flex-col">
            <div className="md:w-1/2">
              <p className="text-[#FFCC00] text-base md:text-lg xl:text-lg mb-6">
                THE REPAIR INDUSTRY'S LOYALTY TOKEN
              </p>
              <p className="text-2xl md:text-4xl xl:text-5xl font-bold text-white mb-6">
                Reward your Repairs with RepairCoin
              </p>
              <p className="text-white text-sm md:text-base xl:text-base mb-10">
                Join the revolution in device repair loyalty. Earn RCN tokens
                for every repair, enjoy tier-based bonuses, and redeem across
                our network of participating shops.
              </p>
            </div>

            <div className="flex flex-row gap-6 pt-4 items-center">
              <button
                onClick={hasWallet ? onGetStartedClick : onAuthModalOpen}
                disabled={isDetecting}
                className="bg-[#FFCC00] text-black py-2 xl:py-4 px-4 xl:px-6 rounded-full font-semibold text-sm md:text-base text-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:bg-yellow-500 transition-colors"
              >
                {getButtonContent()}
              </button>
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg w-1/3">
                {statusMessage}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 relative animate-fadeIn">
            <button
              onClick={onAuthModalClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
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

            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Welcome to RepairCoin
            </h2>

            <DualAuthConnect
              onConnect={onAuthConnect}
              onError={onAuthError}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingHero;