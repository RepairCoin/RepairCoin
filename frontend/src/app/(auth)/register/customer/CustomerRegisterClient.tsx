"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuth } from "@/hooks/useAuth";
import { useAuthMethod } from "@/contexts/AuthMethodContext";
import { useCustomer } from "@/hooks/useCustomer";
import { getUserEmail } from "thirdweb/wallets";
import { useRecaptcha } from "@/hooks/useRecaptcha";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function CustomerRegisterClient() {
  const account = useActiveAccount();
  const { refreshProfile } = useAuth();
  const { authMethod, walletType } = useAuthMethod();
  const router = useRouter();
  const { executeCaptcha } = useRecaptcha();

  const {
    loading,
    error,
    success,
    registrationFormData,
    updateRegistrationFormField,
    handleRegistrationSubmit,
    clearMessages,
  } = useCustomer();

  // Fetch user email if available
  useEffect(() => {
    const fetchEmail = async () => {
      if (account?.address) {
        const email = await getUserEmail({ client });

        if (email) {
          updateRegistrationFormField("email", email);
        }
      }
    };
    fetchEmail();
  }, [account?.address, updateRegistrationFormField]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    // Execute CAPTCHA before registration
    const captchaToken = await executeCaptcha('register');

    // Call the registration handler from the hook
    await handleRegistrationSubmit(
      account.address,
      walletType || "external",
      authMethod || "wallet",
      captchaToken
    );

    // Refresh the auth profile after registration

  };

  // Clear messages when component unmounts
  useEffect(() => {
    return () => {
      clearMessages();
    };
  }, [clearMessages]);

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">👤</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Customer Registration
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to register as a customer
            </p>
            <ConnectButton
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-6 sm:pb-10 pt-20 sm:pt-28 lg:pt-36 bg-[#0D0D0D] px-4 sm:px-0"
      style={{
        backgroundImage: `url('/img/dashboard-bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-screen-2xl w-full sm:w-[85%] lg:w-[70%] mx-auto">
        {/* Header */}
        <div className="w-full mx-auto bg-black/70 rounded-xl sm:rounded-2xl overflow-hidden mb-6 sm:mb-8 lg:mb-12">
          <img src="/img/cus-reg-banner.png" alt="" className="w-full h-full" />
        </div>

        {/* Registration Form */}
        <div className="bg-[#1C1C1C] rounded-xl sm:rounded-2xl shadow-xl p-5 sm:p-8 lg:p-10">
          <form onSubmit={handleSubmit}>
            {/* Personal Information Section */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-base sm:text-lg font-bold text-[#FFCC00] mb-4 sm:mb-6">
                Personal Information
              </h2>

              {/* Form Grid - Consistent 2-column layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* First Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={registrationFormData.first_name}
                    onChange={(e) =>
                      updateRegistrationFormField("first_name", e.target.value)
                    }
                    placeholder="Enter first name"
                    className="w-full px-4 py-3 border border-gray-600 bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500"
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={registrationFormData.last_name}
                    onChange={(e) =>
                      updateRegistrationFormField("last_name", e.target.value)
                    }
                    placeholder="Enter last name"
                    className="w-full px-4 py-3 border border-gray-600 bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={registrationFormData.email}
                    onChange={(e) =>
                      updateRegistrationFormField("email", e.target.value)
                    }
                    placeholder="Enter email address"
                    className="w-full px-4 py-3 border border-gray-600 bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500"
                  />
                </div>

                {/* Referral Code */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Referral Code <span className="text-gray-600">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="referralCode"
                    value={registrationFormData.referralCode}
                    onChange={(e) =>
                      updateRegistrationFormField("referralCode", e.target.value)
                    }
                    placeholder="Enter referral code"
                    className="w-full px-4 py-3 border border-gray-600 bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500"
                  />
                  <p className="text-xs sm:text-sm text-[#FFCC00] font-medium mt-2">
                    🎁 Get 10 RCN bonus after your first repair!
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button - Centered */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-1/2 lg:w-1/3 bg-[#FFCC00] text-black py-3.5 sm:py-4 px-6 rounded-full font-semibold text-sm sm:text-base text-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-400 active:scale-[0.98] transition-all shadow-lg shadow-yellow-500/20"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-black"
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
                    <span>Creating Account...</span>
                  </div>
                ) : (
                  "Join RepairCoin"
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="w-full mx-auto bg-black/70 rounded-xl sm:rounded-2xl overflow-hidden my-6 sm:my-8 lg:my-12">
          <img
            src="/img/cus-reg-benefits.png"
            alt=""
            className="w-full h-full"
          />
        </div>

        {/* Back to Home */}
        <div className="flex justify-center mt-4 sm:mt-6">
          <button
            onClick={() => router.push("/choose")}
            className="inline-flex items-center gap-2 px-8 py-3 bg-transparent border-2 border-gray-600 text-gray-300 font-medium text-sm sm:text-base rounded-xl hover:border-[#FFCC00] hover:text-[#FFCC00] transition-all duration-200"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
