"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuth } from "../../../hooks/useAuth";
import { useAuthMethod } from "@/contexts/AuthMethodContext";
import { useCustomer } from "@/hooks/useCustomer";

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
  
  const {
    loading,
    error,
    success,
    registrationFormData,
    updateRegistrationFormField,
    handleRegistrationSubmit,
    clearMessages,
  } = useCustomer();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    // Call the registration handler from the hook
    await handleRegistrationSubmit(
      account.address,
      walletType || 'external',
      authMethod || 'wallet'
    );
    
    // Refresh the auth profile after registration
    await refreshProfile();
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
      className="min-h-screen pb-10 pt-36 bg-[#0D0D0D]"
      style={{
        backgroundImage: `url('/img/dashboard-bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-screen-2xl w-[70%] mx-auto">
        {/* Header */}
        <div className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden mb-12">
          <img src="/img/cus-reg-banner.png" alt="" className="w-full h-full" />
        </div>

        {/* Registration Form */}
        <div className="bg-[#1C1C1C] rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div>
              <p className="text-lg font-bold text-[#FFCC00] mb-4">
                Personal Information
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={registrationFormData.name}
                    onChange={(e) => updateRegistrationFormField('name', e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    name="email"
                    value={registrationFormData.email}
                    onChange={(e) => updateRegistrationFormField('email', e.target.value)}
                    placeholder="Email address"
                    className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-300 mt-2">
                    For notifications and important updates!
                  </p>
                </div>
              </div>
            </div>

            {/* Referral Code */}
            <div>
              <p className="text-lg font-bold text-[#FFCC00] mb-4">
                Referral (Optional)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <input
                    type="text"
                    name="referralCode"
                    value={registrationFormData.referralCode}
                    onChange={(e) => updateRegistrationFormField('referralCode', e.target.value)}
                    placeholder="Enter referral code"
                    className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-300 mt-2">
                    You'll receive 10 RCN bonus after completing your first
                    repair!
                  </p>
                </div>
                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className='bg-[#FFCC00] w-full text-black py-2 xl:py-4 px-4 xl:px-6 rounded-full font-semibold text-sm md:text-base text-center disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Creating Account...</span>
                      </div>
                    ) : 'Join RepairCoin'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden my-12">
          <img src="/img/cus-reg-benefits.png" alt="" className="w-full h-full" />
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/choose")}
            className="w-[200px] mx-auto  px-8 py-4 bg-[#FFCC00] text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}