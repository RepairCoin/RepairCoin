"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { Building2 } from "lucide-react";
import { useShopRegistration } from '@/hooks/useShopRegistration';
import { ShopRegistrationWizard } from '@/components/shop/ShopRegistrationWizard';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { agencyApi } from '@/services/api/agency';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function ShopRegistration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { executeCaptcha } = useRecaptcha();
  const {
    formData,
    loading,
    checkingApplication,
    existingApplication,
    account,
    handleInputChange,
    handlePhoneChange,
    handleLocationSelect,
    handleSubmit,
  } = useShopRegistration();

  const agencyInviteToken = searchParams.get('agency_invite');
  const [inviteAgencyName, setInviteAgencyName] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyInviteToken) return;
    let active = true;
    agencyApi
      .getInviteInfo(agencyInviteToken)
      .then((res: any) => {
        if (active && res?.data?.valid) setInviteAgencyName(res.data.agencyName ?? 'your agency');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [agencyInviteToken]);

  // Show loading state while checking application
  if (checkingApplication) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191919] p-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-[#FFCC00]"></div>
          <p className="mt-4 text-[#999999]">Checking registration status...</p>
        </div>
      </div>
    );
  }

  // Show existing application status
  if (existingApplication.hasApplication) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191919] p-4">
        <div className="w-full max-w-md rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-8 text-center shadow-xl">
          <h2 className="mb-4 text-2xl font-bold text-white">
            {existingApplication.status === "verified"
              ? "Shop Already Verified"
              : "Application Pending"}
          </h2>

          <p className="mb-6 text-[#999999]">
            {existingApplication.status === "verified"
              ? `Your shop "${existingApplication.shopName}" (ID: ${existingApplication.shopId}) is already verified and active.`
              : `Your application for "${existingApplication.shopName}" (ID: ${existingApplication.shopId}) is currently under review.`}
          </p>

          <button
            onClick={() => router.push('/shop')}
            className="h-12 w-full cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00]"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // Main registration form
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#191919] pb-24 pt-28 md:pt-32">
      {/* Background particle wave pattern */}
      <div
        className="pointer-events-none absolute inset-0 bg-no-repeat bg-right-top opacity-40"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "contain",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-6">
        {/* Wallet Connection Check */}
        {!account ? (
          <div className="mx-auto max-w-md rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-8 text-center shadow-xl">
            <h2 className="mb-4 text-2xl font-bold text-white">
              Connect Your Wallet
            </h2>
            <p className="mb-6 text-[#999999]">
              Please connect your shop wallet to begin registration
            </p>
            <div className="flex justify-center">
              <ConnectButton
                client={client}
                theme="dark"
                connectModal={{ size: "wide" }}
              />
            </div>
          </div>
        ) : (
          <>
            {inviteAgencyName && (
              <div className="mb-6 rounded-2xl border border-[#FFCC00]/30 bg-[#FFCC00]/[0.08] p-4 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-[#FFCC00] flex-shrink-0" />
                <p className="text-sm text-white">
                  You're joining <span className="font-semibold">{inviteAgencyName}</span> as a managed client shop — no
                  separate subscription needed.
                </p>
              </div>
            )}
            {/* Registration Form */}
            <ShopRegistrationWizard
              formData={formData}
              loading={loading}
              onSubmit={async (e) => {
                e.preventDefault();
                const captchaToken = await executeCaptcha('register');
                await handleSubmit(e, captchaToken, agencyInviteToken);
              }}
              onChange={handleInputChange}
              onPhoneChange={handlePhoneChange}
              onLocationSelect={handleLocationSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}