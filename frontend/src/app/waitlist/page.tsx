"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import axios from "axios";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"customer" | "shop" | "">("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !userType) {
      toast.error("Please fill in all fields");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/waitlist/submit`,
        {
          email: email.toLowerCase(),
          userType,
        }
      );

      if (response.data.success) {
        setSubmitted(true);
        toast.success("Successfully joined the waitlist!", {
          duration: 5000,
          icon: "🎉",
        });
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error("This email is already on the waitlist");
      } else {
        toast.error(
          error.response?.data?.error || "Failed to join waitlist. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1e1f22] to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto flex items-center justify-center">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            You're on the list!
          </h2>

          <p className="text-lg text-gray-600 mb-8">
            Thank you for your interest in RepairCoin's RCG Staking feature. We'll notify you
            at <span className="font-semibold text-gray-900">{email}</span> when it launches.
          </p>

          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-3">What's Next?</h3>
            <ul className="text-left text-gray-700 space-y-2">
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span>We'll send you updates as we prepare for launch</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span>Early access to staking features</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span>Exclusive updates on platform revenue growth</span>
              </li>
            </ul>
          </div>

          <a
            href="/"
            className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1e1f22] to-gray-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Join the <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">RCG Staking</span> Waitlist
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Be among the first to earn passive income from platform revenue when staking launches.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Left: Benefits */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Why Stake RCG?</h2>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                  <span className="text-white text-xl">💰</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Earn Revenue Share</h3>
                  <p className="text-gray-400 text-sm">
                    Receive 10% of all platform RCN sales revenue distributed to stakers
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                  <span className="text-white text-xl">🔒</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Flexible Lock Periods</h3>
                  <p className="text-gray-400 text-sm">
                    Choose your commitment level with rewards scaling by lock duration
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                  <span className="text-white text-xl">📊</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Transparent Returns</h3>
                  <p className="text-gray-400 text-sm">
                    Real-time dashboard showing your share of revenue distribution
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                  <span className="text-white text-xl">🚀</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Early Access</h3>
                  <p className="text-gray-400 text-sm">
                    Waitlist members get priority access when staking goes live
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Reserve Your Spot
            </h2>
            <p className="text-gray-600 mb-6">
              Enter your details to join the waitlist
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 outline-none transition-all text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  I am a...
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setUserType("customer")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      userType === "customer"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-gray-300 hover:border-gray-400 text-gray-700"
                    }`}
                  >
                    <div className="text-3xl mb-2">👤</div>
                    <div className="font-semibold">Customer</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserType("shop")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      userType === "shop"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-gray-300 hover:border-gray-400 text-gray-700"
                    }`}
                  >
                    <div className="text-3xl mb-2">🏪</div>
                    <div className="font-semibold">Shop Owner</div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !userType}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-3"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Joining...
                  </span>
                ) : (
                  "Join Waitlist"
                )}
              </button>

              <p className="text-xs text-center text-gray-500">
                By joining, you'll receive updates about RCG staking launch and platform news.
              </p>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-center text-gray-400 text-sm">
            <span className="mr-2">📅</span>
            <span>
              Staking launch date will be announced to waitlist members first
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
