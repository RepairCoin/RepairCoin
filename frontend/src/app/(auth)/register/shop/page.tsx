"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useShopRegistration } from '@/hooks/useShopRegistration';
import { ShopRegistrationForm } from '@/components/shop/ShopRegistrationForm';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function ShopRegistration() {
  const router = useRouter();
  const {
    formData,
    loading,
    checkingApplication,
    existingApplication,
    account,
    handleInputChange,
    handleLocationSelect,
    handleSubmit,
  } = useShopRegistration();

  // Show loading state while checking application
  if (checkingApplication) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking registration status...</p>
        </div>
      </div>
    );
  }

  // Show existing application status
  if (existingApplication.hasApplication) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            {existingApplication.status === "verified" ? (
              <div className="text-6xl">✅</div>
            ) : (
              <div className="text-6xl">⏳</div>
            )}
          </div>
          
          <h2 className="text-2xl font-bold mb-4">
            {existingApplication.status === "verified" 
              ? "Shop Already Verified" 
              : "Application Pending"}
          </h2>
          
          <p className="text-gray-600 mb-6">
            {existingApplication.status === "verified" 
              ? `Your shop "${existingApplication.shopName}" (ID: ${existingApplication.shopId}) is already verified and active.`
              : `Your application for "${existingApplication.shopName}" (ID: ${existingApplication.shopId}) is currently under review.`}
          </p>
          
          <button
            onClick={() => router.push('/shop')}
            className="bg-[#FFCC00] text-black px-6 py-3 rounded-full font-semibold hover:bg-yellow-500 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Main registration form
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        {/* Header */}
        <div className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden mb-12">
          <img src="/img/cus-reg-banner.png" alt="" className="w-full h-full" />
        </div>

        {/* Wallet Connection Check */}
        {!account ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-6">🔗</div>
            <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Please connect your shop wallet to begin registration
            </p>
            <ConnectButton
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        ) : (
          <>
            {/* Registration Form */}
            <ShopRegistrationForm
              formData={formData}
              loading={loading}
              onSubmit={handleSubmit}
              onChange={handleInputChange}
              onLocationSelect={handleLocationSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}