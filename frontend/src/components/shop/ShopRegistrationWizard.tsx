"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Store,
  User,
} from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { ShopRegistrationFormData } from "@/types/shop";
import { LocationPickerWrapper } from "@/components/maps/LocationPickerWrapper";
import { CountryPhoneInput } from "../ui/CountryPhoneInput";

// Registration is four form steps. Submitting the last step creates the shop.
// (Stripe Connect payout onboarding is a separate, later flow — not wired in here yet.)
const STEPS = [
  { label: "Shop & Personal Information", eta: "2 mins" },
  { label: "Business Information", eta: "7 mins" },
  { label: "Social Media and Wallet Information", eta: "3 mins" },
  { label: "Terms and Conditions", eta: "7 mins" },
] as const;

const TOTAL_STEPS = STEPS.length;

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

const TERMS = [
  "Use FixFlow responsibly and provide accurate account information.",
  "Keep your login credentials secure and confidential.",
  "Comply with the FixFlow Terms of Service and Community Guidelines.",
  "Allow FixFlow to process your information in accordance with our Privacy Policy.",
  "Receive essential account notifications, security alerts, and service updates.",
  "Understand that you are responsible for all activity under your account.",
];

interface ShopRegistrationWizardProps {
  formData: ShopRegistrationFormData;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onPhoneChange?: (phone: string) => void;
  onLocationSelect?: (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => void;
}

function ProgressPanel({ step }: { step: number }) {
  const current = STEPS[step];
  const pct = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className={`${PANEL} py-5 md:py-5`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#999999]">Your progress</p>
          <p className="mt-1 text-sm font-medium text-[#FFCC00]">
            {current.label}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-[#999999]">
          <Clock className="h-3.5 w-3.5" />
          <span>{current.eta}</span>
        </div>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E0E0E0]"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`Step ${step + 1} of ${TOTAL_STEPS}: ${current.label}`}
      >
        <div
          className="h-full rounded-full bg-[#008000] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 text-lg font-bold text-[#FFCC00]">{children}</p>
  );
}

export const ShopRegistrationWizard: React.FC<ShopRegistrationWizardProps> = ({
  formData,
  loading,
  onSubmit,
  onChange,
  onPhoneChange,
  onLocationSelect,
}) => {
  const [step, setStep] = useState(0);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Per-step gating. The hook's validateForm() still runs the authoritative check on submit;
  // this only stops you advancing past a step with obvious gaps.
  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!formData.shopId?.trim()) return "Shop ID is required";
      if (!formData.name?.trim()) return "Company name is required";
      if (!formData.firstName?.trim()) return "First name is required";
      if (!formData.lastName?.trim()) return "Last name is required";
      if (!formData.email?.trim()) return "Email is required";
      if (!formData.phone?.trim()) return "Phone number is required";
    }
    if (index === 1) {
      if (!formData.address?.trim()) return "Street address is required";
      if (!formData.city?.trim()) return "City is required";
      if (!formData.country?.trim()) return "Country is required";
      if (!formData.category) return "Please select a business category";
      if (!formData.companySize) return "Please select a company size";
      if (!formData.monthlyRevenue) return "Please select a monthly revenue range";
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isLast = step === STEPS.length - 1;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLast) {
      goNext();
      return;
    }
    onSubmit(e);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Back link */}
      {step === 0 ? (
        <Link
          href="/choose"
          className="inline-flex items-center gap-3 text-sm text-white transition-colors hover:text-[#FFCC00]"
        >
          <ArrowLeft className="h-4 w-4 text-[#FFCC00]" />
          Back to Choose Page
        </Link>
      ) : (
        <button
          type="button"
          onClick={goBack}
          className="inline-flex cursor-pointer items-center gap-3 text-sm text-white transition-colors hover:text-[#FFCC00]"
        >
          <ArrowLeft className="h-4 w-4 text-[#FFCC00]" />
          Back to Previous Page
        </button>
      )}

      {/* Title only appears on the first screen in the design */}
      {step === 0 && (
        <div className="pb-2 pt-4 text-center">
          <h1 className="text-[34px] font-bold leading-tight tracking-[0.5253px] text-white md:text-[48px]">
            Shop Owner Registration
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-sm text-[#999999] md:text-base">
            Grow your business with AI-powered tools for bookings, customers,
            marketing, payments, and rewards.
          </p>
        </div>
      )}

      <ProgressPanel step={step} />

      {/* Step 1 — Shop & Personal Information */}
      {step === 0 && (
        <>
          <div className={PANEL}>
            <SectionTitle>Shop Information</SectionTitle>
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <FormField
                label="Shop ID"
                name="shopId"
                value={formData.shopId}
                onChange={onChange}
                placeholder="Enter your unique shop identifier"
                icon={<Store className="h-4 w-4" />}
                required
              />
              <FormField
                label="Company Name"
                name="name"
                value={formData.name}
                onChange={onChange}
                placeholder="Enter your business name"
                required
              />
            </div>
          </div>

          <div className={PANEL}>
            <SectionTitle>Personal Information</SectionTitle>
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <FormField
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={onChange}
                placeholder="Enter your first name"
                icon={<User className="h-4 w-4" />}
                required
              />
              <FormField
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={onChange}
                placeholder="Enter your last name"
                icon={<User className="h-4 w-4" />}
                required
              />
              <FormField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={onChange}
                placeholder="Enter your email"
                icon={<Mail className="h-4 w-4" />}
                required
              />
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Phone <span className="text-red-500">*</span>
                </label>
                <CountryPhoneInput
                  value={formData.phone}
                  onChange={(phone) => onPhoneChange?.(phone)}
                  disabled={loading}
                  placeholder="Phone number"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 2 — Business Information */}
      {step === 1 && (
        <div className={PANEL}>
          <SectionTitle>Business Information</SectionTitle>

          <FormField
            label="Street Address"
            name="address"
            value={formData.address}
            onChange={onChange}
            placeholder="Enter your street address"
            icon={<MapPin className="h-4 w-4" />}
            required
          />

          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowLocationPicker((v) => !v)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#FFCC00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#E5BB00]"
            >
              <MapPin className="h-4 w-4" />
              {showLocationPicker ? "Hide Map" : "Pin Location on Map"}
            </button>
          </div>

          {formData.location.lat && formData.location.lng && (
            <p className="mb-4 text-xs text-gray-400">
              Pinned: {parseFloat(formData.location.lat).toFixed(6)},{" "}
              {parseFloat(formData.location.lng).toFixed(6)}
            </p>
          )}

          {showLocationPicker && (
            <div className="mb-6 rounded-xl bg-[#2F2F2F] p-4">
              <LocationPickerWrapper
                initialLocation={
                  formData.location.lat && formData.location.lng
                    ? {
                        latitude: parseFloat(formData.location.lat),
                        longitude: parseFloat(formData.location.lng),
                        address: formData.address,
                      }
                    : undefined
                }
                onLocationSelect={(location) => onLocationSelect?.(location)}
                height="350px"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <FormField
              label="City"
              name="city"
              value={formData.city}
              onChange={onChange}
              placeholder="Enter the city where your business operates"
              required
            />
            <FormField
              label="Country"
              name="country"
              value={formData.country}
              onChange={onChange}
              placeholder="Enter the country where your business operates"
              required
            />
            <FormField
              label="State / Province"
              name="location.state"
              value={formData.location.state}
              onChange={onChange}
              placeholder="Enter the state or province where your business operates"
            />
            <FormField
              label="Zip / Postal Code"
              name="location.zipCode"
              value={formData.location.zipCode}
              onChange={onChange}
              placeholder="Enter your shop's zip or postal code"
            />
          </div>

          <hr className="my-6 border-white/10" />

          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <FormField
              label="Business Category"
              name="category"
              value={formData.category}
              onChange={onChange}
              as="select"
              required
            >
              <option value="">Select your business category</option>
              <option value="Repairs and Tech">Repairs and Tech</option>
              <option value="Health and Wellness">Health and Wellness</option>
              <option value="Beauty and Personal Care">
                Beauty and Personal Care
              </option>
              <option value="Fitness and Lifestyle">
                Fitness and Lifestyle
              </option>
              <option value="Home and Auto Service">
                Home and Auto Service
              </option>
            </FormField>
            <FormField
              label="Company Size"
              name="companySize"
              value={formData.companySize}
              onChange={onChange}
              as="select"
              required
            >
              <option value="">Select your company size</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-100">51-100 employees</option>
              <option value="100+">100+ employees</option>
            </FormField>
            <FormField
              label="Monthly Revenue"
              name="monthlyRevenue"
              value={formData.monthlyRevenue}
              onChange={onChange}
              as="select"
              required
            >
              <option value="">Select monthly revenue</option>
              <option value="<10k">Less than $10,000</option>
              <option value="10k-50k">$10,000 - $50,000</option>
              <option value="50k-100k">$50,000 - $100,000</option>
              <option value="100k+">More than $100,000</option>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <FormField
              label="Business Website"
              name="website"
              type="url"
              value={formData.website}
              onChange={onChange}
              placeholder="Enter your website link"
              icon={<Globe className="h-4 w-4" />}
            />
            <FormField
              label="Referral Code (Optional)"
              name="referral"
              value={formData.referral}
              onChange={onChange}
              placeholder="Enter your referral code (Optional)"
            />
          </div>
        </div>
      )}

      {/* Step 3 — Social Media and Wallet Information */}
      {step === 2 && (
        <>
          <div className={PANEL}>
            <SectionTitle>Social Media</SectionTitle>
            <FormField
              label="Facebook"
              name="facebook"
              type="url"
              value={formData.facebook}
              onChange={onChange}
              placeholder="Link to your shop's Facebook page"
              icon={<Facebook className="h-4 w-4" />}
            />
            <FormField
              label="X (formerly Twitter)"
              name="x"
              type="url"
              value={formData.x}
              onChange={onChange}
              placeholder="Link to your shop's X (formerly Twitter) page"
              icon={<span className="text-sm font-bold">𝕏</span>}
            />
            <FormField
              label="Instagram"
              name="instagram"
              type="url"
              value={formData.instagram}
              onChange={onChange}
              placeholder="Link to your shop's Instagram page"
              icon={<Instagram className="h-4 w-4" />}
            />
            <FormField
              label="LinkedIn"
              name="linkedin"
              type="url"
              value={formData.linkedin}
              onChange={onChange}
              placeholder="Link to your shop's LinkedIn page"
              icon={<Linkedin className="h-4 w-4" />}
            />
          </div>

          <div className={PANEL}>
            <SectionTitle>Wallet Information</SectionTitle>
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <FormField
                label="Reimbursement Address"
                name="reimbursementAddress"
                value={formData.reimbursementAddress}
                onChange={onChange}
                placeholder="0x... (defaults to connected wallet)"
                disabled
              />
              <FormField
                label="FixFlow Shop ID (Optional)"
                name="fixflowShopId"
                value={formData.fixflowShopId}
                onChange={onChange}
                placeholder="Enter your FixFlow Shop ID if any."
                icon={<Building2 className="h-4 w-4" />}
              />
            </div>
          </div>
        </>
      )}

      {/* Step 4 — Terms and Conditions */}
      {step === 3 && (
        <>
          <div className={PANEL}>
            <SectionTitle>Terms and Conditions</SectionTitle>
            <ul className="space-y-3">
              {TERMS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#FFCC00]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-white">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <label className="flex cursor-pointer items-center gap-3 px-1">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={formData.acceptTerms}
              onChange={onChange}
              className="h-4 w-4 shrink-0 accent-[#FFCC00]"
            />
            <span className="text-sm text-white">
              I confirm that I have read and accept the{" "}
              <Link href="/terms" className="underline hover:text-[#FFCC00]">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy-policy"
                className="underline hover:text-[#FFCC00]"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </>
      )}

      {stepError && (
        <p className="text-center text-sm text-red-500">{stepError}</p>
      )}

      {/* CTA */}
      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={loading || (isLast && !formData.acceptTerms)}
          className="h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Registering Shop...
            </span>
          ) : (
            "Proceed to Next Page →"
          )}
        </button>
      </div>
    </form>
  );
};
