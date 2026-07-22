"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { ArrowLeft, Gift, Mail, User } from "lucide-react";
import { useAuthMethod } from "@/contexts/AuthMethodContext";
import { useCustomer } from "@/hooks/useCustomer";
import { getUserEmail } from "thirdweb/wallets";
import { getProfiles } from "thirdweb/wallets/in-app";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { getApiBaseUrl } from "@/utils/apiUrl";
import { FormField } from "@/components/forms/FormField";
import { CountryPhoneInput } from "@/components/ui/CountryPhoneInput";

type ReferralStatus = "idle" | "checking" | "valid" | "invalid";

type TextFieldName = "first_name" | "last_name" | "email" | "referralCode";

interface FieldErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  referralCode?: string;
  terms?: string;
}

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 text-lg font-bold text-[#FFCC00]">{children}</p>;
}

export default function CustomerRegisterClient() {
  const account = useActiveAccount();
  const { authMethod, walletType } = useAuthMethod();
  const { executeCaptcha } = useRecaptcha();

  const {
    loading,
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

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "email" && emailLocked) return;

    updateRegistrationFormField(name as TextFieldName, value);

    if (name === "referralCode") setReferralStatus("idle");
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

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
        referralCode: isValid
          ? undefined
          : "This referral code isn't valid. Clear it or enter a correct one.",
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
      errors.referralCode =
        "This referral code isn't valid. Clear it or enter a correct one.";
    if (!agreedToTerms)
      errors.terms =
        "Please accept the Terms and Conditions and Privacy Policy to continue.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    if (!validateForm()) return;

    // Execute CAPTCHA before registration
    const captchaToken = await executeCaptcha("register");

    await handleRegistrationSubmit(
      account.address,
      walletType || "external",
      authMethod || "wallet",
      captchaToken
    );
  };

  // Clear messages when component unmounts
  useEffect(() => {
    return () => {
      clearMessages();
    };
  }, [clearMessages]);

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
        {!account ? (
          <div className="mx-auto max-w-md rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-8 text-center shadow-xl">
            <h2 className="mb-4 text-2xl font-bold text-white">
              Connect Your Wallet
            </h2>
            <p className="mb-6 text-[#999999]">
              Please connect your wallet to register as a customer
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Back link */}
            <Link
              href="/choose"
              className="inline-flex items-center gap-3 text-sm text-white transition-colors hover:text-[#FFCC00]"
            >
              <ArrowLeft className="h-4 w-4 text-[#FFCC00]" />
              Back to Choose Page
            </Link>

            <div className="pb-2 pt-4 text-center">
              <h1 className="text-[34px] font-bold leading-tight tracking-[0.5253px] text-white md:text-[48px]">
                Customer Registration
              </h1>
              <p className="mx-auto mt-3 max-w-[560px] text-sm text-[#999999] md:text-base">
                Join FixFlow and start discovering trusted services, exclusive
                rewards, and seamless bookings.
              </p>
            </div>

            {/* Personal Information */}
            <div className={PANEL}>
              <SectionTitle>Personal Information</SectionTitle>

              <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                <FormField
                  label="First Name"
                  name="first_name"
                  value={registrationFormData.first_name}
                  onChange={handleFieldChange}
                  placeholder="Enter your full name"
                  icon={<User className="h-4 w-4" />}
                  error={fieldErrors.first_name}
                  required
                />
                <FormField
                  label="Last Name"
                  name="last_name"
                  value={registrationFormData.last_name}
                  onChange={handleFieldChange}
                  placeholder="Enter your full name"
                  icon={<User className="h-4 w-4" />}
                  error={fieldErrors.last_name}
                  required
                />

                <div>
                  <FormField
                    label="Email"
                    name="email"
                    type="email"
                    value={registrationFormData.email}
                    onChange={handleFieldChange}
                    placeholder="Enter your email"
                    icon={<Mail className="h-4 w-4" />}
                    disabled={emailLocked}
                    error={emailLocked ? undefined : fieldErrors.email}
                    required
                  />
                  {emailLocked && (
                    <p className="-mt-2 mb-4 text-xs text-[#999999]">
                      Verified from your login — can&apos;t be changed here.
                    </p>
                  )}
                </div>

                <div
                  onBlur={() =>
                    validateReferral(registrationFormData.referralCode)
                  }
                >
                  <FormField
                    label="Referral Code (Optional)"
                    name="referralCode"
                    value={registrationFormData.referralCode}
                    onChange={handleFieldChange}
                    placeholder="Enter referral code"
                    icon={<Gift className="h-4 w-4" />}
                    error={fieldErrors.referralCode}
                  />
                  {referralStatus === "checking" ? (
                    <p className="-mt-2 mb-4 text-xs text-[#999999]">
                      Checking code…
                    </p>
                  ) : referralStatus === "valid" ? (
                    <p className="-mt-2 mb-4 text-xs text-green-400">
                      ✓ Valid code — you&apos;ll earn 10 RCN after your first
                      qualifying repair ($50+).
                    </p>
                  ) : (
                    !fieldErrors.referralCode && (
                      <p className="-mt-2 mb-4 text-xs text-[#999999]">
                        🎁 Have a friend&apos;s code? Enter it to earn 10 RCN
                        after your first qualifying repair.
                      </p>
                    )
                  )}
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Phone Number{" "}
                    <span className="text-[#999999]">(Optional)</span>
                  </label>
                  <CountryPhoneInput
                    value={registrationFormData.phone}
                    onChange={(phone) =>
                      updateRegistrationFormField("phone", phone)
                    }
                    disabled={loading}
                    placeholder="Enter phone number"
                  />
                  <p className="mt-2 text-xs text-[#999999]">
                    For appointment reminders and reward updates.
                  </p>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className={PANEL}>
              <SectionTitle>Terms and Conditions</SectionTitle>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    if (fieldErrors.terms)
                      setFieldErrors((p) => ({ ...p, terms: undefined }));
                  }}
                  className="h-4 w-4 shrink-0 accent-[#FFCC00]"
                />
                <span className="text-sm text-white">
                  I confirm that I have read and agree to FixFlow&apos;s{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="underline hover:text-[#FFCC00]"
                  >
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy-policy"
                    target="_blank"
                    className="underline hover:text-[#FFCC00]"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {fieldErrors.terms && (
                <p className="mt-3 text-sm text-red-500">{fieldErrors.terms}</p>
              )}
            </div>

            {/* CTA */}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={loading || !agreedToTerms}
                className="h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Creating Account...
                  </span>
                ) : (
                  "Join FixFlow →"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
