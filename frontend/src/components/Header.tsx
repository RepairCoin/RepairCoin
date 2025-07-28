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
      router.push("/");
    }
  }, [account?.address, isAuthenticated]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 z-50 w-full transition-all duration-300 ${
          scrolled
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
                    {["Overview", "Features", "Pricing", "About"].map(
                      (item) => (
                        <li key={item}>
                          <a
                            href={`#${item.toLowerCase()}`}
                            className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
                          >
                            {item}
                          </a>
                        </li>
                      )
                    )}
                  </ul>
                </nav>

                {/* Auth Buttons */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="text-gray-900 bg-yellow-400 hover:bg-yellow-500 px-5 py-2.5 rounded-full text-sm font-medium border border-white transition-all duration-200 hover:shadow-lg hover:shadow-yellow-500/20"
                  >
                    Log In
                  </button>
                </div>
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
          <div className="relative bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
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

            {/* Modal Header */}
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Welcome to Repair Shop
            </h2>

            {/* Connect Wallet Button */}
            <div className="w-full flex items-center justify-center">
              <ConnectButton
                client={client}
                theme="light"
                connectModal={{ size: "wide" }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
