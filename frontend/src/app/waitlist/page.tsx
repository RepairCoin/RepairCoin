"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import axios from "axios";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"customer" | "shop" | "">("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

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
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center px-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[500px] h-[500px] bg-green-500/20 rounded-full blur-[120px] -top-48 -right-48 animate-pulse"></div>
          <div className="absolute w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] -bottom-48 -left-48 animate-pulse delay-700"></div>
        </div>

        <div className="max-w-2xl w-full relative z-10 animate-fadeIn">
          <div className="bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/50 p-8 md:p-12">
            <div className="text-center">
              {/* Success Icon */}
              <div className="mb-6 relative">
                <div className="w-24 h-24 bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-green-500/50 animate-scaleIn">
                  <svg
                    className="w-12 h-12 text-white animate-checkmark"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="absolute inset-0 w-24 h-24 bg-green-400 rounded-full mx-auto blur-xl opacity-50 animate-pulse"></div>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 animate-slideUp">
                You're on the list! 🎉
              </h2>

              <p className="text-lg text-gray-300 mb-8 animate-slideUp delay-100">
                Thank you for joining RepairCoin. We'll notify you at{" "}
                <span className="font-semibold text-yellow-400">{email}</span> when we launch.
              </p>

              {/* What's Next Box */}
              <div className="bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8 animate-slideUp delay-200">
                <h3 className="text-xl font-bold text-yellow-400 mb-4 flex items-center justify-center gap-2">
                  <span>✨</span> What's Next?
                </h3>
                <div className="space-y-3">
                  {[
                    "Early access to platform features and beta programs",
                    "Exclusive updates on RepairCoin ecosystem developments",
                    "Priority support and onboarding assistance",
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start text-left text-gray-300 group hover:text-white transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3 flex-shrink-0 group-hover:bg-yellow-500/30 transition-colors">
                        <svg
                          className="w-4 h-4 text-yellow-400"
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
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href="/"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 hover:from-yellow-600 hover:via-orange-600 hover:to-yellow-700 text-black font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/50 animate-slideUp delay-300"
              >
                <svg
                  className="w-5 h-5"
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
                Return to Home
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] px-4 py-12 relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-[120px] -top-48 -right-48 animate-blob"></div>
        <div className="absolute w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] top-1/2 -left-48 animate-blob animation-delay-2000"></div>
        <div className="absolute w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -bottom-48 right-1/4 animate-blob animation-delay-4000"></div>
      </div>

      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Hero Section */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-full px-4 py-2 mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-yellow-400 text-sm font-semibold">Now Accepting Early Access Applications</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Join the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 animate-gradient">
              RepairCoin
            </span>
            <br />
            Revolution
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-8">
            Transform your repair business with blockchain-powered rewards and loyalty
          </p>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span>Blockchain Secured</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span>Instant Rewards</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span>Zero Transaction Fees</span>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {/* For Customers */}
          <div className={`transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
            <div className="h-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-3xl p-8 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 group">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/50 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">For Customers</h2>
                  <p className="text-blue-400">Earn rewards, save money</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4">
                {[
                  { icon: "🎁", title: "Earn RCN Tokens", desc: "Get rewarded instantly for every repair service" },
                  { icon: "💰", title: "Redeem Anywhere", desc: "Use tokens at any shop in the network" },
                  { icon: "🏆", title: "Tier Rewards", desc: "Unlock Bronze, Silver & Gold tier bonuses" },
                  { icon: "👥", title: "Referral Bonuses", desc: "Earn 25 RCN per friend (they get 10 RCN)" },
                  { icon: "🛍️", title: "Service Marketplace", desc: "Browse, book & review services easily" },
                  { icon: "🔐", title: "Blockchain Secure", desc: "Transparent & verifiable on Base network" },
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 rounded-xl bg-gray-900/30 hover:bg-gray-900/50 transition-all duration-300 group/item border border-transparent hover:border-blue-500/30"
                  >
                    <div className="text-3xl flex-shrink-0 group-hover/item:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1 group-hover/item:text-blue-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-400">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* For Shop Owners */}
          <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
            <div className="h-full bg-gradient-to-br from-orange-500/10 via-yellow-500/10 to-orange-500/10 backdrop-blur-xl rounded-3xl p-8 border border-orange-500/30 hover:border-orange-400/50 transition-all duration-300 group">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/50 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">For Shop Owners</h2>
                  <p className="text-orange-400">Grow revenue, retain customers</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4">
                {[
                  { icon: "📈", title: "Increase Revenue", desc: "Boost repeat business by up to 40%" },
                  { icon: "🪙", title: "Purchase RCN", desc: "Tiered pricing based on RCG holdings" },
                  { icon: "🎯", title: "Issue Rewards", desc: "Reward customers instantly after service" },
                  { icon: "🏅", title: "Shop Tiers", desc: "Standard, Premium & Elite benefits" },
                  { icon: "📊", title: "Analytics Dashboard", desc: "Track rewards, redemptions & performance" },
                  { icon: "🌐", title: "Marketplace Listing", desc: "Reach customers across the network" },
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 rounded-xl bg-gray-900/30 hover:bg-gray-900/50 transition-all duration-300 group/item border border-transparent hover:border-orange-500/30"
                  >
                    <div className="text-3xl flex-shrink-0 group-hover/item:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1 group-hover/item:text-orange-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-400">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Join Form */}
        <div className={`max-w-2xl mx-auto transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/50 p-8 md:p-10 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              <div className="text-center mb-8">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
                  Reserve Your Spot
                </h2>
                <p className="text-gray-400 text-lg">
                  Join the waitlist for early access & exclusive updates
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full pl-12 pr-4 py-4 bg-gray-900/50 border-2 border-gray-700 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 outline-none transition-all text-white placeholder-gray-500"
                      required
                    />
                  </div>
                </div>

                {/* User Type Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    I am a...
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setUserType("customer")}
                      className={`relative p-6 rounded-xl border-2 transition-all duration-300 group ${
                        userType === "customer"
                          ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                          : "border-gray-700 hover:border-gray-600 bg-gray-900/30"
                      }`}
                    >
                      <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">👤</div>
                      <div className={`font-bold text-lg mb-1 ${userType === "customer" ? "text-blue-400" : "text-white"}`}>
                        Customer
                      </div>
                      <div className="text-xs text-gray-400">Earn & redeem rewards</div>
                      {userType === "customer" && (
                        <div className="absolute top-3 right-3">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserType("shop")}
                      className={`relative p-6 rounded-xl border-2 transition-all duration-300 group ${
                        userType === "shop"
                          ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20"
                          : "border-gray-700 hover:border-gray-600 bg-gray-900/30"
                      }`}
                    >
                      <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🏪</div>
                      <div className={`font-bold text-lg mb-1 ${userType === "shop" ? "text-orange-400" : "text-white"}`}>
                        Shop Owner
                      </div>
                      <div className="text-xs text-gray-400">Issue rewards & grow</div>
                      {userType === "shop" && (
                        <div className="absolute top-3 right-3">
                          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !email || !userType}
                  className="w-full relative bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 hover:from-yellow-600 hover:via-orange-600 hover:to-yellow-700 disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 disabled:shadow-none overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
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
                        <span>Joining...</span>
                      </>
                    ) : (
                      <>
                        <span>Join Waitlist</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
                </button>

                <p className="text-xs text-center text-gray-500">
                  🔒 Your information is secure. We'll only use it to send you updates about RepairCoin.
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl px-6 py-4 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-gray-300">
                <span className="font-semibold text-white">Limited spots available.</span> Early members get exclusive perks!
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes checkmark {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out;
        }

        .animate-checkmark {
          stroke-dasharray: 100;
          animation: checkmark 0.5s ease-out forwards;
          animation-delay: 0.3s;
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .delay-700 {
          animation-delay: 0.7s;
        }
      `}</style>
    </div>
  );
}
