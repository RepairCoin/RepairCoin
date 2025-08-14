"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuth } from "../../../hooks/useAuth";
import { useAuthMethod } from "@/contexts/AuthMethodContext";
import CommunityBanner from "@/components/CommunityBanner";

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
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    referralCode: "",
  });

  // Get referral code from URL if present
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      setFormData((prev) => ({
        ...prev,
        referralCode: refCode,
      }));
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const registrationData = {
        ...formData,
        walletAddress: account.address,
        walletType: walletType || 'external',
        authMethod: authMethod || 'wallet',
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(registrationData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        // Handle specific error cases
        if (response.status === 409) {
          // Handle role conflict errors with specific messaging
          if (errorData.conflictingRole) {
            const roleMessage = {
              admin:
                "This wallet is registered as an admin account and cannot be used for customer registration.",
              shop: "This wallet is already registered as a shop account. You cannot register the same wallet as both a shop and a customer.",
              customer: "This wallet is already registered as a customer.",
            };

            const message =
              roleMessage[
                errorData.conflictingRole as keyof typeof roleMessage
              ] || errorData.error;

            // For existing customer, we still redirect, but for other roles we don't
            if (errorData.conflictingRole === "customer") {
              throw new Error(
                "This wallet is already registered. Redirecting to your dashboard..."
              );
            } else {
              throw new Error(message);
            }
          } else {
            throw new Error(
              "This wallet is already registered. Redirecting to your dashboard..."
            );
          }
        }

        throw new Error(errorData.error || "Registration failed");
      }

      const result = await response.json();
      setSuccess("Registration successful! Welcome to RepairCoin!");
      console.log("Customer registered:", result);

      // Refresh the auth profile to update the authentication state
      await refreshProfile();

      // Redirect to customer dashboard after successful registration
      setTimeout(() => {
        router.push("/customer");
      }, 2000);
    } catch (err) {
      console.error("Registration error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage);

      // If user already exists as customer, redirect after a short delay
      // Don't redirect for role conflicts (admin/shop trying to register as customer)
      if (
        errorMessage.includes("already registered") &&
        errorMessage.includes("Redirecting")
      ) {
        setTimeout(() => {
          router.push("/customer");
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Full name"
                    className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                <div>
                  <input
                    type="text"
                    name="referralCode"
                    value={formData.referralCode}
                    onChange={handleInputChange}
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
                    className="w-full  px-8 py-4 bg-[#FFCC00] text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
                  >
                    {loading ? "Creating Account..." : "Join RepairCoin"}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Success Message */}
          {success && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="text-green-400 text-2xl mr-3">✅</div>
                <div>
                  <h3 className="text-sm font-medium text-green-800">
                    Registration Successful!
                  </h3>
                  <div className="mt-2 text-sm text-green-700">{success}</div>
                  <div className="mt-2 text-sm text-green-600">
                    Redirecting to your dashboard...
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="text-red-400 text-2xl mr-3">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Registration Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                  {error.includes("already registered") && (
                    <div className="mt-2 text-sm text-red-600">
                      Redirecting to your dashboard...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
