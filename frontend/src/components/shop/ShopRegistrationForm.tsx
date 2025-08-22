"use client";

import React from "react";
import { FormField } from "@/components/forms/FormField";
import { ShopRegistrationFormData } from "@/types/shop";

interface ShopRegistrationFormProps {
  formData: ShopRegistrationFormData;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
}

export const ShopRegistrationForm: React.FC<ShopRegistrationFormProps> = ({
  formData,
  loading,
  onSubmit,
  onChange,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Shop Information Section */}
      <div className="bg-[#1C1C1C] p-6 rounded-2xl shadow-sm">
        <p className="text-lg font-bold text-[#FFCC00] mb-4">
          Shop Information
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Shop ID"
            name="shopId"
            value={formData.shopId}
            onChange={onChange}
            placeholder="Enter your unique shop identifier"
            required
          />
          <FormField
            label="Company Name"
            name="name"
            value={formData.name}
            onChange={onChange}
            placeholder="Your business name"
            required
          />
        </div>
      </div>

      {/* Personal Information Section */}
      <div className="bg-[#1C1C1C] p-6 rounded-2xl shadow-sm">
        <p className="text-lg font-bold text-[#FFCC00] mb-4">
          Personal Information
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={onChange}
            placeholder="John"
            required
          />
          <FormField
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={onChange}
            placeholder="Doe"
            required
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={onChange}
            placeholder="john@example.com"
            required
          />
          <FormField
            label="Phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={onChange}
            placeholder="+1 (555) 123-4567"
            required
          />
        </div>
      </div>

      {/* Business Information Section */}
      <div className="bg-[#1C1C1C] p-6 rounded-2xl shadow-sm">
        <p className="text-lg font-bold text-[#FFCC00] mb-4">
          Business Information
        </p>
        <div className="space-y-4">
          <FormField
            label="Street Address"
            name="address"
            value={formData.address}
            onChange={onChange}
            placeholder="123 Main Street"
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="City"
              name="city"
              value={formData.city}
              onChange={onChange}
              placeholder="New York"
              required
            />
            <FormField
              label="Country"
              name="country"
              value={formData.country}
              onChange={onChange}
              placeholder="United States"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="State/Province"
              name="location.state"
              value={formData.location.state}
              onChange={onChange}
              placeholder="NY"
            />
            <FormField
              label="ZIP/Postal Code"
              name="location.zipCode"
              value={formData.location.zipCode}
              onChange={onChange}
              placeholder="9999"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Company Size"
              name="companySize"
              value={formData.companySize}
              onChange={onChange}
              as="select"
              required
            >
              <option value="">Select company size</option>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Website"
              name="website"
              type="url"
              value={formData.website}
              onChange={onChange}
              placeholder="https://example.com"
            />
            <FormField
              label="Referral (Optional)"
              name="referral"
              value={formData.referral}
              onChange={onChange}
              placeholder="Referral Code"
            />
          </div>
        </div>
      </div>

      {/* Location Information Section */}
      <div className="bg-[#1C1C1C] p-6 rounded-2xl shadow-sm">
        <p className="text-lg font-bold text-[#FFCC00] mb-4">
          Wallet Information
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Reimbursement Address"
            name="reimbursementAddress"
            value={formData.reimbursementAddress}
            onChange={onChange}
            placeholder="0x... (defaults to connected wallet)"
            disabled
          />
          <FormField
            label="Fixflow Shop ID"
            name="fixflowShopId"
            value={formData.fixflowShopId}
            onChange={onChange}
            placeholder="shop_123"
          />
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="bg-[#1C1C1C] rounded-2xl shadow-xl p-8">
        <div className="w-full">
          <h2 className="text-3xl font-bold text-[#FFA500] mb-2">
            Terms and Conditions
          </h2>
          <p className="text-white font-bold text-lg mb-6">Your Agreement</p>

          <ul className="space-y-4 mb-6">
            {[
              "Your shop will need admin verification before activation",
              "You'll be able to purchase RCN at $0.10 each",
              "Tier bonuses will be automatically deducted from your RCN Balance",
              "Cross hop redemption can be enabled after verification",
              "All transactions are recorded on the blockchain",
              "You agree to comply with all RepairCoin network policies",
            ].map((item, index) => (
              <li key={index} className="flex items-start">
                <svg
                  className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-white">{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-start">
            <FormField
              label=""
              name="acceptTerms"
              type="checkbox"
              value={formData.acceptTerms}
              onChange={onChange}
              placeholder="I confirm that I have read and accept the terms and conditions and privacy policy."
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center pt-6">
        <button
          type="submit"
          disabled={loading || !formData.acceptTerms}
          className="bg-[#FFCC00] text-black py-2 xl:py-4 px-4 xl:px-6 rounded-full font-semibold text-sm md:text-base text-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-black"
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
              <span>Registering Shop...</span>
            </div>
          ) : (
            "Register Shop"
          )}
        </button>
      </div>
    </form>
  );
};
