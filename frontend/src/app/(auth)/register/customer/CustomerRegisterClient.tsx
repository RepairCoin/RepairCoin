"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuth } from "@/hooks/useAuth";
import { useAuthMethod } from "@/contexts/AuthMethodContext";
import { useCustomer } from "@/hooks/useCustomer";
import { getUserEmail } from "thirdweb/wallets";
import { getProfiles } from "thirdweb/wallets/in-app";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { getApiBaseUrl } from "@/utils/apiUrl";
import { CountryPhoneInput } from "@/components/ui/CountryPhoneInput";

type ReferralStatus = "idle" | "checking" | "valid" | "invalid";

interface FieldErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  referralCode?: string;
  terms?: string;
}

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

  // Email is locked (read-only) when it comes from a verified social/email login,
  // so the stored email can't drift from the account's real identity. External
  // wallet logins have no email, so the field stays editable for them.
  const [emailLocked, setEmailLocked] = useState(false);
  const [referralStatus, setReferralStatus] = useState<ReferralStatus>("idle");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Pre-fill email and name from the social/email login profile if available
  useEffect(() => {
    const fetchProfile = async () => {
      if (!account?.address) return;

      const email = await getUserEmail({ client });
      if (email) {
        updateRegistrationFormField("email", email);
        setEmailLocked(true);
      }

      // Pre-fill name from the social (Google/Apple) profile so customers
      // aren't stored as "Anonymous". External wallets have no profile here,
      // which is fine — the user can still type their name manually.
      try {
        const profiles = await getProfiles({ client });
        const social = profiles.find(
          (p) => p.type === "google" || p.type === "apple"
        );
        const details = social?.details as
          | { name?: string; givenName?: string; familyName?: string }
          | undefined;

        if (details) {
          const nameParts = details.name?.trim().split(/\s+/) ?? [];
          const firstName = details.givenName || nameParts[0];
          const lastName = details.familyName || nameParts.slice(1).join(" ");

          if (firstName) updateRegistrationFormField("first_name", firstName);
          if (lastName) updateRegistrationFormField("last_name", lastName);
        }
      } catch {
        // No social profile available (e.g. external wallet) — ignore
      }
    };
    fetchProfile();
  }, [account?.address, updateRegistrationFormField]);

  // Inline-validate the (optional) referral code against the backend, so a bad
  // code is caught here instead of failing the whole registration on submit.
  const validateReferral = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      setReferralStatus("idle");
      setFieldErrors((prev) => ({ ...prev, referralCode: undefined }));
      return;
    }
    setReferralStatus("checking");
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/referrals/validate/${encodeURIComponent(code)}`
      );
      const body = await res.json();
      const isValid = res.ok && body?.data?.valid === true;
      setReferralStatus(isValid ? "valid" : "invalid");
      setFieldErrors((prev) => ({
        ...prev,
        referralCode: isValid ? undefined : "This referral code isn't valid. Clear it or enter a correct one.",
      }));
    } catch {
      // If the check itself fails, don't block signup — just clear the state.
      setReferralStatus("idle");
      setFieldErrors((prev) => ({ ...prev, referralCode: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    if (!registrationFormData.first_name.trim())
      errors.first_name = "First name is required.";
    if (!registrationFormData.last_name.trim())
      errors.last_name = "Last name is required.";
    const email = registrationFormData.email.trim();
    if (!email) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address.";
    }
    if (registrationFormData.referralCode.trim() && referralStatus === "invalid")
      errors.referralCode = "This referral code isn't valid. Clear it or enter a correct one.";
    if (!agreedToTerms)
      errors.terms = "Please accept the Privacy Policy to continue.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    if (!validateForm()) return;

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
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={registrationFormData.first_name}
                    onChange={(e) => {
                      updateRegistrationFormField("first_name", e.target.value);
                      if (fieldErrors.first_name)
                        setFieldErrors((p) => ({ ...p, first_name: undefined }));
                    }}
                    placeholder="Enter first name"
                    className={`w-full px-4 py-3 border bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500 ${
                      fieldErrors.first_name ? "border-red-500" : "border-gray-600"
                    }`}
                  />
                  {fieldErrors.first_name && (
                    <p className="text-xs text-red-400">{fieldErrors.first_name}</p>
                  )}
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={registrationFormData.last_name}
                    onChange={(e) => {
                      updateRegistrationFormField("last_name", e.target.value);
                      if (fieldErrors.last_name)
                        setFieldErrors((p) => ({ ...p, last_name: undefined }));
                    }}
                    placeholder="Enter last name"
                    className={`w-full px-4 py-3 border bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500 ${
                      fieldErrors.last_name ? "border-red-500" : "border-gray-600"
                    }`}
                  />
                  {fieldErrors.last_name && (
                    <p className="text-xs text-red-400">{fieldErrors.last_name}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={registrationFormData.email}
                    onChange={(e) => {
                      if (emailLocked) return;
                      updateRegistrationFormField("email", e.target.value);
                      if (fieldErrors.email)
                        setFieldErrors((p) => ({ ...p, email: undefined }));
                    }}
                    readOnly={emailLocked}
                    placeholder="Enter email address"
                    className={`w-full px-4 py-3 border bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500 ${
                      emailLocked ? "opacity-70 cursor-not-allowed" : ""
                    } ${fieldErrors.email ? "border-red-500" : "border-gray-600"}`}
                  />
                  {emailLocked ? (
                    <p className="text-xs text-gray-500">
                      Verified from your login — can&apos;t be changed here.
                    </p>
                  ) : (
                    fieldErrors.email && (
                      <p className="text-xs text-red-400">{fieldErrors.email}</p>
                    )
                  )}
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Phone Number{" "}
                    <span className="text-gray-600">(Optional)</span>
                  </label>
                  <CountryPhoneInput
                    value={registrationFormData.phone}
                    onChange={(phone) =>
                      updateRegistrationFormField("phone", phone)
                    }
                    placeholder="Enter phone number"
                  />
                  <p className="text-xs text-gray-500">
                    For appointment reminders and reward updates.
                  </p>
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
                    onChange={(e) => {
                      updateRegistrationFormField("referralCode", e.target.value);
                      setReferralStatus("idle");
                      if (fieldErrors.referralCode)
                        setFieldErrors((p) => ({ ...p, referralCode: undefined }));
                    }}
                    onBlur={(e) => validateReferral(e.target.value)}
                    placeholder="Enter referral code"
                    className={`w-full px-4 py-3 border bg-[#2F2F2F] text-white text-sm sm:text-base rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-500 ${
                      referralStatus === "invalid"
                        ? "border-red-500"
                        : referralStatus === "valid"
                        ? "border-green-500"
                        : "border-gray-600"
                    }`}
                  />
                  {referralStatus === "checking" ? (
                    <p className="text-xs text-gray-400">Checking code…</p>
                  ) : referralStatus === "valid" ? (
                    <p className="text-xs text-green-400">
                      ✓ Valid code — you&apos;ll earn 10 RCN after your first qualifying repair ($50+).
                    </p>
                  ) : fieldErrors.referralCode ? (
                    <p className="text-xs text-red-400">{fieldErrors.referralCode}</p>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-400 mt-2">
                      🎁 Have a friend&apos;s code? Enter it to earn 10 RCN after your first qualifying repair.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Privacy consent */}
            <div className="mb-6 sm:mb-8">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    if (fieldErrors.terms)
                      setFieldErrors((p) => ({ ...p, terms: undefined }));
                  }}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-600 bg-[#2F2F2F] text-[#FFCC00] focus:ring-[#FFCC00]"
                />
                <span className="text-sm text-gray-400">
                  I agree to FixFlow&apos;s{" "}
                  <Link
                    href="/privacy-policy"
                    target="_blank"
                    className="text-[#FFCC00] underline hover:text-yellow-400"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {fieldErrors.terms && (
                <p className="text-xs text-red-400 mt-2">{fieldErrors.terms}</p>
              )}
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
                  "Join FixFlow"
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
