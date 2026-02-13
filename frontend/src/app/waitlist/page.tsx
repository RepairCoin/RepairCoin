"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import axios from "axios";
import Link from "next/link";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"customer" | "shop" | "">("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

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

  const faqs = [
    {
      question: "What happens if my home shop closes?",
      answer: "Your RCN tokens remain in your wallet and can still be redeemed at any partner shop in the network. You can also designate a new home shop to unlock 100% redemption there."
    },
    {
      question: "Can I cash out my RCN tokens?",
      answer: "RCN is designed specifically as a loyalty reward for the repair ecosystem, not as a speculative investment. Tokens can only be redeemed for repair services at partner shops—this keeps the value stable and focused on supporting the repair industry."
    },
    {
      question: "How is this different from a traditional loyalty program?",
      answer: "Traditional programs lock you into one shop. RepairCoin creates a network where you can earn at your favorite shop and redeem anywhere. Plus, blockchain ensures transparency—you can verify every transaction and know your rewards will never disappear due to a program change or business closure."
    },
    {
      question: "What are RCG governance tokens?",
      answer: "RepairCoin Governance (RCG) tokens are held by Premium and Elite partner shops, giving them voting rights on network decisions and access to better pricing tiers. The more RCG you hold, the lower your per-token cost (down to $0.06 for Elite tier)."
    },
    {
      question: "Do I need to understand cryptocurrency to use this?",
      answer: "Nope! While RepairCoin uses blockchain technology behind the scenes, the experience for both customers and shop owners is as simple as any loyalty app. Customers see their token balance, shops click a button to issue rewards. No wallets, no gas fees, no crypto jargon required."
    },
    {
      question: "When does RepairCoin launch?",
      answer: "We're currently accepting launch partner applications. The first 50 approved shops will begin pilot testing in Q2 2026, with wider rollout planned for Q3 2026. Join the waitlist to stay updated on timeline and early access opportunities."
    }
  ];

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

              <Link
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
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-[120px] -top-48 -right-48 animate-blob"></div>
        <div className="absolute w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] top-1/2 -left-48 animate-blob animation-delay-2000"></div>
        <div className="absolute w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -bottom-48 right-1/4 animate-blob animation-delay-4000"></div>
      </div>

      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"></div>

      <div className="relative z-10">
        {/* Header with Logo */}
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-white hover:text-yellow-400 transition-colors">
            <span className="text-3xl">🪙</span>
            RepairCoin
          </Link>
        </div>

        {/* Hero Section */}
        <div className="container mx-auto px-4 py-12 text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-full px-6 py-3 mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-yellow-400 font-semibold">Launch Partner Applications Open</span>
          </div>

          {/* Sub-badge */}
          <div className={`inline-block bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40 rounded-full px-6 py-2 mb-6 transition-all duration-1000 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <span className="text-purple-300 font-semibold">⚡ First 50 Launch Partners Get Elite Tier Pricing</span>
          </div>

          {/* Main Heading */}
          <h1 className={`text-5xl md:text-7xl font-bold text-white mb-6 leading-tight transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            Blockchain Loyalty That Rewards{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 animate-gradient">
              Repair Over Replacement
            </span>
          </h1>

          <p className={`text-xl md:text-2xl text-gray-400 max-w-4xl mx-auto mb-12 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            Join the network of repair shops using cryptocurrency rewards to drive customer loyalty, increase revenue, and help save the planet—one repair at a time.
          </p>

          {/* Stats Grid */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto mb-16 transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {[
              { value: "320+", label: "Shops on Waitlist" },
              { value: "40%", label: "Avg. Revenue Increase" },
              { value: "$0.10", label: "Fixed Token Value" },
              { value: "⛓️", label: "Built on Base" }
            ].map((stat, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-yellow-500/50 transition-all duration-300 group">
                <div className="text-4xl font-bold text-yellow-400 mb-2 group-hover:scale-110 transition-transform">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
            {[
              {
                icon: "⛓️",
                title: "Blockchain Secured",
                description: "Zero transaction fees for lightning-fast rewards"
              },
              {
                icon: "💎",
                title: "Stable Value",
                description: "No speculation or volatility. 1 RCN = $0.10, always"
              },
              {
                icon: "🌐",
                title: "Network Effect",
                description: "Customers redeem across all partner shops nationwide"
              }
            ].map((feature, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-yellow-500/50 transition-all duration-300 group text-center">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-xl text-gray-400">Simple blockchain rewards that make sense for everyone</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto mb-12">
            {[
              { step: "1", title: "Customer Gets Repair", desc: "Phone screen, laptop fix, etc." },
              { step: "2", title: "Shop Issues RCN", desc: "Instantly via dashboard" },
              { step: "3", title: "Earn 50 RCN", desc: "Worth exactly $5.00" },
              { step: "4", title: "Redeem Anywhere", desc: "Any partner shop, anytime" }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-yellow-500/50 transition-all duration-300 group">
                  <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-2xl font-bold text-black mb-4 group-hover:scale-110 transition-transform">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 opacity-50"></div>
                )}
              </div>
            ))}
          </div>

          {/* Value Prop */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-8 max-w-4xl mx-auto text-center">
            <div className="text-5xl font-bold text-yellow-400 mb-2">1 RCN = $0.10 USD</div>
            <p className="text-gray-300">
              Unlike volatile cryptocurrencies, RepairCoin tokens maintain a fixed, stable value. No speculation, no surprises—just reliable rewards that customers can count on.
            </p>
          </div>
        </div>

        {/* For Customers / Shop Owners */}
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* For Customers */}
            <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-3xl p-8 border border-blue-500/30">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-5xl">👤</div>
                <h3 className="text-3xl font-bold text-white">For Customers</h3>
              </div>
              <div className="space-y-4">
                {[
                  { icon: "🎁", title: "Instant Rewards", desc: "Earn RCN tokens immediately after every repair—no waiting, no hassle" },
                  { icon: "💰", title: "Redeem Everywhere", desc: "Use 100% at your home shop, or up to 20% of lifetime RCN at any partner shop nationwide" },
                  { icon: "🏆", title: "Tier Bonuses", desc: "Unlock Bronze, Silver, and Gold tiers for exclusive perks and higher rewards" },
                  { icon: "👥", title: "Referral Rewards", desc: "Earn 25 RCN ($2.50) for every friend you refer—they get 10 RCN too!" },
                  { icon: "🔐", title: "You're In Control", desc: "Every redemption requires your approval. Tokens only move when you confirm" },
                  { icon: "♾️", title: "Never Expire", desc: "Your earned RCN tokens stay in your wallet forever—no expiration dates" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-500/5 transition-colors group">
                    <div className="text-3xl group-hover:scale-110 transition-transform">{feature.icon}</div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                      <p className="text-sm text-gray-400">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* For Shop Owners */}
            <div className="bg-gradient-to-br from-orange-500/10 via-yellow-500/10 to-orange-500/10 backdrop-blur-xl rounded-3xl p-8 border border-orange-500/30">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-5xl">🏪</div>
                <h3 className="text-3xl font-bold text-white">For Shop Owners</h3>
              </div>
              <div className="space-y-4">
                {[
                  { icon: "📈", title: "Proven Revenue Growth", desc: "Beta partners saw up to 40% increase in repeat business within 6 months" },
                  { icon: "🪙", title: "Tiered Pricing", desc: "Standard ($0.10/RCN), Premium ($0.08/RCN), or Elite ($0.06/RCN) based on RCG governance holdings" },
                  { icon: "⚡", title: "Issue Instantly", desc: "Reward customers in seconds via dashboard or FixFlow CRM integration" },
                  { icon: "📊", title: "Analytics Dashboard", desc: "Track rewards issued, redemptions, customer tiers, and ROI in real-time" },
                  { icon: "🌐", title: "Marketplace Listing", desc: "Get discovered by customers across the network searching for services" },
                  { icon: "🎯", title: "Elite Partner Benefits", desc: "Premium/Elite tiers get governance voting rights and featured marketplace placement" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-orange-500/5 transition-colors group">
                    <div className="text-3xl group-hover:scale-110 transition-transform">{feature.icon}</div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                      <p className="text-sm text-gray-400">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Environmental Impact */}
        <div className="container mx-auto px-4 py-16">
          <div className="bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-green-500/10 border border-green-500/30 rounded-3xl p-12 max-w-5xl mx-auto text-center">
            <div className="text-6xl mb-6">🌍</div>
            <h2 className="text-4xl font-bold text-white mb-6">Repair the Planet, One Token at a Time</h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              Every repair instead of a replacement keeps e-waste out of landfills and reduces carbon emissions from manufacturing. RepairCoin creates financial incentives that align profit with environmental responsibility—rewarding businesses and customers for making sustainable choices.
            </p>
          </div>
        </div>

        {/* Social Proof Banner */}
        <div className="container mx-auto px-4 py-12">
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50 text-center">
            <p className="text-2xl text-white font-semibold mb-4">Join 320+ repair shops already on the waitlist</p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-gray-400">
              {[
                { icon: "🔒", label: "Blockchain Secured on Base" },
                { icon: "⚡", label: "Zero Gas Fees" },
                { icon: "🔗", label: "FixFlow CRM Integration" },
                { icon: "💎", label: "Stable $0.10 Token Value" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-2xl">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Waitlist Form */}
        <div id="join" className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/50 p-8 md:p-10 relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <div className="text-center mb-8">
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
                    Reserve Your Launch Partner Spot
                  </h2>
                  <p className="text-gray-400 text-lg">
                    First 50 partners lock in Elite tier pricing permanently
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
                        placeholder="you@yourshop.com"
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
                          <span>Join the Waitlist</span>
                          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
                  </button>

                  <p className="text-xs text-center text-gray-500">
                    🔒 Your information is secure and will only be used for RepairCoin updates. No spam, unsubscribe anytime.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-12">Common Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
                  <button
                    onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
                  >
                    <span className="text-lg font-semibold text-white pr-4">{faq.question}</span>
                    <svg
                      className={`w-6 h-6 text-yellow-400 flex-shrink-0 transition-transform ${faqOpen === index ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {faqOpen === index && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="container mx-auto px-4 py-12 border-t border-gray-800">
          <div className="text-center text-gray-500">
            <p>© 2026 RepairCoin. Built on Base. Powered by the repair community.</p>
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
