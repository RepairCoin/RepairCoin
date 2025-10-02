"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Shield,
  Check,
  ArrowRight,
  ArrowLeft,
  Zap,
} from "lucide-react";

export default function SubscriptionForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    shopName: "",
    email: "",
    phone: "",
    address: "",
    acceptTerms: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubscribing(true);
      setError(null);

      // Validate form
      if (!formData.email || !formData.shopName || !formData.phone || !formData.address) {
        setError('Please fill in all required fields');
        setSubscribing(false);
        return;
      }

      const token = localStorage.getItem('shopAuthToken');
      if (!token) {
        setError('Authentication required. Please login first.');
        setTimeout(() => {
          router.push('/shop');
        }, 2000);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          billingMethod: 'credit_card',
          billingEmail: formData.email,
          billingContact: formData.shopName,
          billingPhone: formData.phone,
          billingAddress: formData.address,
          notes: 'Monthly subscription enrollment via subscription form'
        })
      });

      const result = await response.json();
      
      // Check if response is successful
      if (!response.ok && !(response.status >= 200 && response.status < 300)) {
        throw new Error(result.error || 'Failed to create subscription');
      }
      
      // If we get a successful response, check if it's because of existing pending subscription
      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      // Handle pending subscription resume
      if (result.data.isPendingResume) {
        setSuccessMessage(result.data.message || 'Resuming your pending subscription...');
        // Redirect to payment page for pending subscriptions
        if (result.data.paymentUrl) {
          setTimeout(() => {
            window.location.href = result.data.paymentUrl;
          }, 2000);
        }
      } else if (result.data.paymentUrl) {
        // Handle payment redirect for new subscriptions
        setSuccessMessage('Redirecting to secure payment...');
        setTimeout(() => {
          window.location.href = result.data.paymentUrl;
        }, 1500);
      } else {
        // Show success message
        setSuccessMessage(result.data.nextSteps || result.data.message || 'Subscription created successfully!');
        
        // Redirect to dashboard after a delay
        setTimeout(() => {
          router.push('/shop?tab=subscription');
        }, 3000);
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      setError(error instanceof Error ? error.message : 'Failed to create subscription');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0D0D0D] py-12"
      style={{
        backgroundImage: `url(/img/tech-bg.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => router.push('/shop')}
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800/50 border border-gray-700 hover:border-gray-600 rounded-xl text-gray-300 hover:text-white transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content Section */}
          <div className="flex flex-col justify-center space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 rounded-full border border-blue-600/50">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">
                  LIMITED TIME OFFER
                </span>
              </div>

              <h1 className="text-5xl font-bold text-white leading-tight">
                Start Your <span className="text-[#FFCC00]">RepairCoin</span>{" "}
                Journey
              </h1>

              <p className="text-xl text-gray-300">
                Join thousands of repair shops already benefiting from our
                revolutionary rewards platform
              </p>
            </div>

            {/* Pricing Card */}
            <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-2xl p-8 border border-blue-600/50">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-bold text-white">$500</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-gray-300 mb-6">
                Everything you need to start issuing rewards
              </p>

              {/* Features List */}
              <ul className="space-y-3">
                {[
                  "Issue unlimited RCN rewards",
                  "Access to customer dashboard",
                  "Real-time analytics",
                  "Priority support",
                  "No setup fees",
                  "Cancel anytime",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Side - Form Section */}
          <div className="lg:pl-12">
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-3xl p-8 border border-gray-800">
              {/* Form Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Start Your Subscription
                </h2>
                <p className="text-gray-400">
                  Complete the form below to get started
                </p>
              </div>

              {/* Success Message */}
              {successMessage && (
                <div className="mb-6 bg-green-900/20 border border-green-600/50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-400">{successMessage}</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-6 bg-red-900/20 border border-red-600/50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Shop Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Shop Name
                  </label>
                  <input
                    type="text"
                    name="shopName"
                    value={formData.shopName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your shop name"
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none transition-colors"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none transition-colors"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Shop Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    placeholder="123 Main St, City, State ZIP"
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none transition-colors"
                  />
                </div>

                {/* Payment Info Notice */}
                <div className="bg-blue-900/20 border border-blue-600/50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-400 mb-1">
                        Secure Payment
                      </p>
                      <p className="text-xs text-gray-400">
                        You'll be redirected to Stripe for secure payment
                        processing after submission
                      </p>
                    </div>
                  </div>
                </div>

                {/* Terms Checkbox */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    id="acceptTerms"
                    checked={formData.acceptTerms}
                    onChange={handleInputChange}
                    required
                    className="mt-1 w-4 h-4 bg-[#0D0D0D] border border-gray-700 rounded text-[#FFCC00] focus:ring-[#FFCC00] focus:ring-offset-0"
                  />
                  <label
                    htmlFor="acceptTerms"
                    className="text-sm text-gray-400"
                  >
                    I agree to the{" "}
                    <a
                      href="#"
                      className="text-[#FFCC00] hover:text-yellow-400 underline"
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href="#"
                      className="text-[#FFCC00] hover:text-yellow-400 underline"
                    >
                      Privacy Policy
                    </a>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!formData.acceptTerms || subscribing}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFA500] text-black font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-[1.02] disabled:transform-none flex items-center justify-center gap-2"
                >
                  {subscribing ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5"
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
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Payment</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500">
                    256-bit SSL Encrypted • PCI Compliant
                  </span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
