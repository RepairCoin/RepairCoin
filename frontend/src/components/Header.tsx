"use client";

import React, { useState, useEffect } from "react";
import { createThirdwebClient } from "thirdweb";
import { useRouter } from "next/navigation";
import { ConnectButton } from "thirdweb/react";
import Section from "./Section";
import { useAuth } from "@/hooks/useAuth";

const Header: React.FC = () => {
  const { account, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => {
    if (account?.address && !isAuthenticated) {
      setIsModalOpen(false);
    }
  }, [account?.address, isAuthenticated]);

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 z-50 w-full transition-all duration-300 ${scrolled
          ? "bg-gray-900/90 backdrop-blur-sm shadow-md"
          : "bg-transparent"
          }`}
      >
        <nav className="py-4">
          <Section>
            <div className="flex flex-wrap justify-between items-center w-full">
              {/* Logo */}
              <a href="/" className="flex items-center">
                <div className="flex items-center">
                  <img src="/nav-logo.png" alt="" />
                </div>
              </a>

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

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center flex-1 justify-between ml-12">
                {/* Navigation Links */}
                <nav className="flex items-center">
                  <ul className="flex space-x-6">
                    {["Pricing", "About"].map((item) => (
                      <li key={item}>
                        <a
                          href={`${item.toLowerCase()}`}
                          className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
                        >
                          {item}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>

                {/* Auth Buttons */}
                {
                  account?.address ? (
                    <div className="flex justify-center items-center">
                      <div className="flex bg-white items-center w-12 h-12 border-2 p-1 border-gray-500 rounded-full space-x-2">
                        <img src="/avatar1.png" className="w-full h-full rounded-full" alt="" />
                      </div>
                      <p className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200">
                        {(() => {
                          const text = "fewfeqhfffwfgweghwei";
                          return text.length > 7 ? text.substring(0, 11) + "..." : text;
                        })()}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleModalOpen}
                        className="text-gray-900 bg-yellow-400 hover:bg-yellow-500 px-5 py-2.5 rounded-full text-sm font-medium border border-white transition-all duration-200 hover:shadow-lg hover:shadow-yellow-500/20"
                      >
                        Log In
                      </button>
                    </div>
                  )
                }
              </div>
            </div>

            {/* Mobile Navigation */}
            {isMenuOpen && (
              <div className="lg:hidden" id="mobile-menu">
                <div className="px-4 py-4 space-y-4">
                  {/* Navigation Links */}
                  <nav className="flex flex-col items-center space-y-3">
                    {["Overview", "Features", "Pricing", "About"].map(
                      (item) => (
                        <a
                          key={`mobile-${item}`}
                          href={`#${item.toLowerCase()}`}
                          className="w-full text-center px-4 py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {item}
                        </a>
                      )
                    )}
                  </nav>

                  {/* Auth Buttons */}
                  <div className="pt-2 space-y-3">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="block w-full px-4 py-3 text-base font-medium text-center text-white hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
                    >
                      Log In
                    </button>
                    <a
                      href="#"
                      className="block w-full px-4 py-3 text-base font-medium text-center text-gray-900 bg-yellow-400 hover:bg-yellow-500 rounded-full border border-white transition-all duration-200 hover:shadow-lg hover:shadow-yellow-500/20"
                    >
                      Sign Up
                    </a>
                  </div>
                </div>
              </div>
            )}
          </Section>
        </nav>
      </header>

      {/* Login Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-gray-100 rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
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
                  src="/connect-modal.png"
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
