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
            Thank you for your interest in RepairCoin. We'll notify you
            at <span className="font-semibold text-gray-900">{email}</span> when we launch new features and updates.
          </p>

          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-3">What's Next?</h3>
            <ul className="text-left text-gray-700 space-y-2">
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span>Receive updates on new features and platform improvements</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span>Early access to upcoming features and beta programs</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span>Exclusive announcements about the RepairCoin ecosystem</span>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1e1f22] to-gray-900 px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Join the <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">RepairCoin</span> Revolution
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Be among the first to experience the future of repair services with blockchain-powered rewards
          </p>
        </div>

        {/* For Customers Section */}
        <div className="mb-12">
          <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-3xl p-8 border border-blue-700/50 mb-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                <span className="text-white text-2xl">👤</span>
              </div>
              <h2 className="text-3xl font-bold text-white">For Customers</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🎁</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Earn RCN Tokens</h3>
                    <p className="text-gray-400 text-sm">
                      Get rewarded with RCN tokens for every repair service you complete at participating shops
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">💰</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Redeem Rewards</h3>
                    <p className="text-gray-400 text-sm">
                      Use your earned tokens to get discounts on future repairs at any shop in the network
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🏆</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Tier System</h3>
                    <p className="text-gray-400 text-sm">
                      Progress through Bronze, Silver, and Gold tiers to unlock bonus rewards and exclusive perks
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">👥</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Referral Bonuses</h3>
                    <p className="text-gray-400 text-sm">
                      Earn 25 RCN when you refer a friend who completes their first repair (they get 10 RCN too!)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🛍️</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Service Marketplace</h3>
                    <p className="text-gray-400 text-sm">
                      Browse verified repair services, book appointments, and read reviews - all in one place
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🔐</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Blockchain Security</h3>
                    <p className="text-gray-400 text-sm">
                      Every transaction is secured and verified on the Base blockchain for complete transparency
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* For Shops Section */}
        <div className="mb-12">
          <div className="bg-gradient-to-br from-orange-900/50 to-yellow-900/50 rounded-3xl p-8 border border-orange-700/50 mb-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-xl flex items-center justify-center mr-4">
                <span className="text-white text-2xl">🏪</span>
              </div>
              <h2 className="text-3xl font-bold text-white">For Shop Owners</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">📈</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Increase Revenue</h3>
                    <p className="text-gray-400 text-sm">
                      Attract more customers with blockchain rewards and boost repeat business by up to 40%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🪙</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Purchase RCN Tokens</h3>
                    <p className="text-gray-400 text-sm">
                      Buy RCN at tiered pricing based on your RCG holdings - more RCG means better rates
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🎯</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Issue Rewards</h3>
                    <p className="text-gray-400 text-sm">
                      Reward customers instantly after repairs with RCN tokens to drive loyalty and referrals
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🏅</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Shop Tiers</h3>
                    <p className="text-gray-400 text-sm">
                      Hold RCG tokens to unlock Standard, Premium, or Elite tier benefits and better pricing
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">📊</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Analytics Dashboard</h3>
                    <p className="text-gray-400 text-sm">
                      Track rewards issued, redemptions, customer activity, and marketplace performance
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white text-xl">🌐</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Marketplace Listing</h3>
                    <p className="text-gray-400 text-sm">
                      List your services on the RepairCoin marketplace and reach customers across the network
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Join Form */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
              Reserve Your Spot
            </h2>
            <p className="text-gray-600 mb-8 text-center">
              Join the waitlist to get early access and exclusive updates
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
                    className={`p-6 rounded-xl border-2 transition-all ${
                      userType === "customer"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 hover:border-gray-400 text-gray-700"
                    }`}
                  >
                    <div className="text-4xl mb-2">👤</div>
                    <div className="font-bold text-lg">Customer</div>
                    <div className="text-xs text-gray-500 mt-1">Earn & redeem rewards</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserType("shop")}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      userType === "shop"
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-300 hover:border-gray-400 text-gray-700"
                    }`}
                  >
                    <div className="text-4xl mb-2">🏪</div>
                    <div className="font-bold text-lg">Shop Owner</div>
                    <div className="text-xs text-gray-500 mt-1">Issue rewards & grow</div>
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
                By joining, you'll receive updates about RepairCoin platform launches and new features.
              </p>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-center text-gray-400 text-sm">
            <span className="mr-2">🚀</span>
            <span>
              Early access and exclusive launch updates will be announced to waitlist members first
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
