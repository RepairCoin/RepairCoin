"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import axios from "axios";
import Link from "next/link";
import Image from "next/image";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"customer" | "shop" | "">("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !userType) {
      toast.error("Please fill in all fields");
      return;
    }

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
        },
      );

      if (response.data.success) {
        setSubmitted(true);
        setShowModal(false);
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
          error.response?.data?.error ||
            "Failed to join waitlist. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const faqs = [
    {
      question: "What happens when my shop closes?",
      answer:
        "Your RCN tokens remain in your wallet and can still be redeemed at any partner shop in the network. You can also designate a new home shop to unlock 100% redemption there.",
    },
    {
      question: "Can I cash out my RCN Tokens?",
      answer:
        "RCN is designed specifically as a loyalty reward for the repair ecosystem, not as a speculative investment. Tokens can only be redeemed for repair services at partner shops—this keeps the value stable and focused on supporting the repair industry.",
    },
    {
      question: "How is this different from a traditional loyalty program?",
      answer:
        "Traditional programs lock you into one shop. RepairCoin creates a network where you can earn at your favorite shop and redeem anywhere. Plus, blockchain ensures transparency—you can verify every transaction and know your rewards will never disappear due to a program change or business closure.",
    },
    {
      question: "What are RCG governance tokens?",
      answer:
        "RepairCoin Governance (RCG) tokens are held by Premium and Elite partner shops, giving them voting rights on network decisions and access to better pricing tiers. The more RCG you hold, the lower your per-token cost (down to $0.06 for Elite tier).",
    },
    {
      question: "Do I need to understand cryptocurrency to use this?",
      answer:
        "Nope! While RepairCoin uses blockchain technology behind the scenes, the experience for both customers and shop owners is as simple as any loyalty app. Customers see their token balance, shops click a button to issue rewards. No wallets, no gas fees, no crypto jargon required.",
    },
    {
      question: "When does RepairCoin launch?",
      answer:
        "We're currently accepting launch partner applications. The first 50 approved shops will begin pilot testing in Q2 2026, with wider rollout planned for Q3 2026. Join the waitlist to stay updated on timeline and early access opportunities.",
    },
  ];

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#101010] flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] p-8 md:p-12 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-white"
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
            <h2 className="text-3xl font-bold text-white mb-4">
              You're on the list!
            </h2>
            <p className="text-gray-400 mb-8">
              Thank you for joining RepairCoin. We'll notify you at{" "}
              <span className="text-yellow-400">{email}</span> when we launch.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#F5A623] hover:bg-[#E09000] text-black font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101010] text-white">
      {/* Header */}
      <header className="py-6 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="inline-block">
            <div className="relative w-[185px] h-[50px]">
              <Image
                src="/img/nav-logo.png"
                alt="RepairCoin Logo"
                fill
                className="object-contain"
                sizes="185px"
              />
            </div>
          </Link>
        </div>
      </header>

      {/* Hero Section - ends after Join Waitlist button */}
      <section className="relative py-16 md:py-24 px-6 md:px-12 overflow-hidden">
        {/* Background Image - only for hero */}
        <div
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('/img/waitlist/hero/hero_bg.png')`,
          }}
        />

        <div className="max-w-6xl mx-auto text-center relative z-10 w-full">
          {/* Badge with border and inner shadow */}
          <div
            className="inline-flex items-center gap-3 rounded-full px-5 py-2.5 mb-10"
            style={{
              background: "#0D0D0D",
              border: "1px solid #FFCC00",
              boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
            }}
          >
            {/* Shining icon */}
            <img
              src="/img/waitlist/hero/shining.svg"
              alt=""
              className="w-5 h-5 md:w-6 md:h-6"
            />
            <span className="text-sm md:text-base font-semibold text-[#FFCC00]">
              First 50 Shops Receive Elite Tier Status
            </span>
          </div>

          {/* Main Heading - All white with yellow curve under "Service Businesses" */}
          <h1 className="relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-8 leading-[1.1] tracking-tight">
            <span className="text-white">Blockchain Loyalty Built for</span>
            <br />
            <span className="text-white">Modern Service Businesses</span>
            {/* Yellow curve - centered within h1, exact 311x8px */}
            <svg
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                bottom: "-2px",
                width: "311px",
                height: "8px",
              }}
              viewBox="0 0 312 14"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0.333984 11C54.1609 4.96301 191.719 -3.48877 311.334 11"
                stroke="#FFCC00"
                strokeWidth="6"
              />
            </svg>
          </h1>

          {/* Subtext */}
          <p
            className="max-w-2xl mx-auto mb-10"
            style={{
              fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif',
              fontWeight: 400,
              fontSize: "18px",
              lineHeight: "33px",
              textAlign: "center",
              color: "rgba(255, 255, 255, 1)",
            }}
          >
            Be part of the first wave of shops using blockchain rewards to drive
            repeat customers, smarter growth and long-term loyalty.
          </p>

          {/* CTA Button - Last element of hero section */}
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#FFCC00] hover:bg-[#E6B800] text-black font-semibold py-3.5 rounded-lg transition-all text-base hover:scale-105 hover:shadow-lg hover:shadow-[#FFCC00]/20"
            style={{ paddingLeft: "32px", paddingRight: "32px" }}
          >
            Join Waitlist →
          </button>
        </div>
      </section>

      {/* Stats Section - Separate from hero, no hero background */}
      <section className="pt-16 pb-8 px-6 md:px-12 bg-[#101010]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "320", label: "Shops on Waitlist" },
              { value: "40%", label: "Avg. Revenue Increase" },
              { value: "$0.10", label: "Fixed Token Value" },
              { value: "100%", label: "Blockchain Verified" },
            ].map((stat, index) => (
              <div
                key={index}
                className="p-5 md:p-6 text-center"
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background:
                    "linear-gradient(80.42deg, #000000 25.25%, #232327 98.05%)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "44px",
                    color: "rgba(255, 204, 0, 1)",
                    marginBottom: "4px",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontFamily:
                      'var(--font-inria-sans), "Inria Sans", sans-serif',
                    fontWeight: 400,
                    fontSize: "16px",
                    color: "rgba(151, 151, 151, 1)",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="pt-8 pb-20 px-6 md:px-12 bg-[#101010]">
        <div className="max-w-4xl mx-auto">
          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "/img/waitlist/section3/shield-check.svg",
                title: "Blockchain Secured",
                description:
                  "Every transaction is verified on the Base blockchain for maximum transparency.",
              },
              {
                icon: "/img/waitlist/section3/gift.svg",
                title: "Stable Value",
                description:
                  "1 RCN = $0.10, always. No volatility, no speculation—just predictable value.",
              },
              {
                icon: "/img/waitlist/section3/globe.svg",
                title: "Network Effect",
                description:
                  "Customers can redeem across all partner shops nationwide.",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 text-left"
                style={{
                  background:
                    "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "32px",
                }}
              >
                <div className="w-12 h-12 bg-[#FFCC00] rounded-full flex items-center justify-center mb-4">
                  <img src={feature.icon} alt="" className="w-6 h-6" />
                </div>
                <h3
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "20px",
                    lineHeight: "140%",
                    color: "white",
                    marginBottom: "8px",
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontFamily:
                      'var(--font-inria-sans), "Inria Sans", sans-serif',
                    fontWeight: 400,
                    fontSize: "14px",
                    lineHeight: "140%",
                    color: "rgba(151, 151, 151, 1)",
                  }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How RepairCoin Works */}
      <section className="pt-16 pb-20 px-6 md:px-12 bg-[#101010]">
        <div className="max-w-6xl mx-auto">
          {/* Badge - same style as hero */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
              style={{
                background: "#0D0D0D",
                border: "1px solid #FFCC00",
                boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
              }}
            >
              <img
                src="/img/waitlist/hero/shining.svg"
                alt=""
                className="w-5 h-5"
              />
              <span className="text-sm font-semibold text-[#FFCC00]">
                From Service to Rewards
              </span>
            </div>
          </div>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "Poppins, sans-serif",
              fontWeight: 700,
              fontSize: "36px",
              lineHeight: "45px",
              textAlign: "center",
              color: "white",
              marginBottom: "8px",
            }}
          >
            How RepairCoin Works
          </h2>

          {/* Section Subtitle */}
          <p
            style={{
              fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif',
              fontWeight: 700,
              fontSize: "18px",
              lineHeight: "22px",
              textAlign: "center",
              color: "rgba(255, 204, 0, 1)",
              marginBottom: "48px",
            }}
          >
            No extra steps. No complexity. Just smarter rewards.
          </p>

          {/* Steps */}
          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {[
              {
                step: "1",
                title: "Customer Completes Service",
                desc: "Service and repair. Rewards are stored.",
                image: "/img/waitlist/section4/Photo1.png",
              },
              {
                step: "2",
                title: "Shop Issues RCN",
                desc: "Rewards are sent within after confirmation.",
                image: "/img/waitlist/section4/Photo2.png",
              },
              {
                step: "3",
                title: "Customer earns RCN",
                desc: "Transparent rewards. Tracked by both sides.",
                image: "/img/waitlist/section4/Photo3.png",
              },
              {
                step: "4",
                title: "Redeem Anywhere",
                desc: "Allow redemption at the shop of your choice.",
                image: "/img/waitlist/section4/Photo4.png",
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div
                  className="overflow-hidden"
                  style={{
                    background: "rgba(16, 16, 16, 1)",
                    border: "1px solid rgba(103, 103, 103, 1)",
                    borderRadius: "20px",
                  }}
                >
                  {/* Image */}
                  <div className="aspect-[4/3] relative">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"
                      style={{ borderRadius: "20px 20px 0 0" }}
                    />
                  </div>

                  {/* Step number - centered, half overlapping image */}
                  <div
                    className="flex justify-center"
                    style={{ marginTop: "10px" }}
                  >
                    <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center text-black font-bold text-base shadow-md">
                      {item.step}
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="px-4 pt-3 pb-5 text-center">
                    <h3
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 600,
                        fontSize: "15px",
                        lineHeight: "22px",
                        color: "rgba(255, 255, 255, 1)",
                        marginBottom: "4px",
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        fontFamily:
                          'var(--font-inria-sans), "Inria Sans", sans-serif',
                        fontWeight: 400,
                        fontSize: "15px",
                        lineHeight: "22px",
                        color: "rgba(153, 153, 153, 1)",
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Token Value */}
          <div
            className="text-center py-12 px-6 max-w-4xl mx-auto"
            style={{
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "32px",
              background:
                "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
            }}
          >
            <h3
              style={{
                fontFamily: "Poppins, sans-serif",
                fontWeight: 600,
                fontSize: "44px",
                lineHeight: "140%",
                color: "rgba(255, 204, 0, 1)",
                marginBottom: "16px",
              }}
            >
              1 RCN = $0.10 USD
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif',
                fontWeight: 400,
                fontSize: "16px",
                lineHeight: "140%",
                textAlign: "center",
                color: "rgba(151, 151, 151, 1)",
                maxWidth: "42rem",
                margin: "0 auto",
              }}
            >
              Unlike volatile cryptocurrencies, RepairCoin tokens maintain a
              fixed, stable value. No speculation, no surprises—just reliable
              rewards that customers can count on.
            </p>
          </div>
        </div>
      </section>

      {/* Built for Businesses */}
      <section className="pt-16 pb-20 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          {/* Badge - same style as hero */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
              style={{
                background: "#0D0D0D",
                border: "1px solid #FFCC00",
                boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
              }}
            >
              <img
                src="/img/waitlist/hero/shining.svg"
                alt=""
                className="w-5 h-5"
              />
              <span className="text-sm font-semibold text-[#FFCC00]">
                Why It's For
              </span>
            </div>
          </div>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "Poppins, sans-serif",
              fontWeight: 700,
              fontSize: "36px",
              lineHeight: "45px",
              textAlign: "center",
              color: "white",
              marginBottom: "8px",
            }}
          >
            Built for Businesses. Loved by Customers.
          </h2>

          {/* Section Subtitle */}
          <p
            style={{
              fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif',
              fontWeight: 700,
              fontSize: "18px",
              lineHeight: "22px",
              textAlign: "center",
              color: "rgba(255, 204, 0, 1)",
              marginBottom: "48px",
            }}
          >
            A loyalty system that works seamlessly for both sides of every
            service.
          </p>

          {/* Two Columns */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* For Shop Owners */}
            <div
              className="overflow-hidden"
              style={{
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                background:
                  "linear-gradient(80.42deg, rgba(0, 0, 0, 0.55) 25.25%, rgba(58, 58, 76, 0.55) 98.05%)",
              }}
            >
              <div className="aspect-[16/9] bg-[#252525] relative">
                <Image
                  src="/img/waitlist/section6/shop.png"
                  alt="Shop Owner"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "20px",
                    lineHeight: "140%",
                    color: "white",
                    marginBottom: "24px",
                  }}
                >
                  For Shop Owners
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      icon: "/img/waitlist/section6/shop/trending-up.svg",
                      title: "Proven Revenue Growth",
                      desc: "Beta partners saw up to 40% increase in repeat business within 6 months",
                    },
                    {
                      icon: "/img/waitlist/section6/shop/trophy.svg",
                      title: "Tiered Pricing",
                      desc: "Standard ($0.10/RCN), PREMIUM ($0.08/RCN), or ELITE ($0.06/RCN) based on RCG governance holdings",
                    },
                    {
                      icon: "/img/waitlist/section6/shop/sparkles.svg",
                      title: "Issue Instantly",
                      desc: "Reward customers in seconds via dashboard or FixFlow CRM integration",
                    },
                    {
                      icon: "/img/waitlist/section6/shop/layout-dashboard.svg",
                      title: "Analytics Dashboard",
                      desc: "Track rewards issued, redemptions, customer tiers, and ROI in real-time",
                    },
                    {
                      icon: "/img/waitlist/section6/shop/globe.svg",
                      title: "Marketplace Listing",
                      desc: "Get discovered by customers across the network searching for services",
                    },
                    {
                      icon: "/img/waitlist/section6/shop/badge-check.svg",
                      title: "Elite Partner Benefits",
                      desc: "Premium/Elite tiers get governance voting rights and featured marketplace placement",
                    },
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                        <img src={feature.icon} alt="" className="w-5 h-5" />
                      </div>
                      <div>
                        <h4
                          style={{
                            fontFamily: "Poppins, sans-serif",
                            fontWeight: 600,
                            fontSize: "16px",
                            lineHeight: "140%",
                            color: "white",
                          }}
                        >
                          {feature.title}
                        </h4>
                        <p
                          style={{
                            fontFamily:
                              'var(--font-inria-sans), "Inria Sans", sans-serif',
                            fontWeight: 400,
                            fontSize: "14px",
                            lineHeight: "140%",
                            color: "rgba(151, 151, 151, 1)",
                          }}
                        >
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* For Customers */}
            <div
              className="overflow-hidden"
              style={{
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                background:
                  "linear-gradient(80.42deg, rgba(0, 0, 0, 0.55) 25.25%, rgba(58, 58, 76, 0.55) 98.05%)",
              }}
            >
              <div className="aspect-[16/9] bg-[#252525] relative">
                <Image
                  src="/img/waitlist/section6/customer.png"
                  alt="Customer"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "20px",
                    lineHeight: "140%",
                    color: "white",
                    marginBottom: "24px",
                  }}
                >
                  For Customers
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      icon: "/img/waitlist/section6/customer/trending-up.svg",
                      title: "Instant Rewards",
                      desc: "RCN is issued immediately after you receive service from a RepairCoin shop",
                    },
                    {
                      icon: "/img/waitlist/section6/customer/store.svg",
                      title: "Redeem Everywhere",
                      desc: "Use your RCN at any shop. Redeem up to 20% of your RCN balance at shops other than your home shop.",
                    },
                    {
                      icon: "/img/waitlist/section6/customer/trophy.svg",
                      title: "Tier Bonuses",
                      desc: "Earn 2-5% MORE RCN for every friend you refer—they get 10 RCN too!",
                    },
                    {
                      icon: "/img/waitlist/section6/customer/users.svg",
                      title: "Referral Rewards",
                      desc: "Earn 25 RCN ($2.50) for every friend you refer—they get 10 RCN too!",
                    },
                    {
                      icon: "/img/waitlist/section6/customer/globe-lock.svg",
                      title: "You're in Control",
                      desc: "Every redemption requires your approval. Tokens only move when you say so and confirm.",
                    },
                    {
                      icon: "/img/waitlist/section6/customer/infinity.svg",
                      title: "Never Expire",
                      desc: "Your earned RCN tokens stay in your wallet forever, even if you change your wallet address.",
                    },
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                        <img src={feature.icon} alt="" className="w-5 h-5" />
                      </div>
                      <div>
                        <h4
                          style={{
                            fontFamily: "Poppins, sans-serif",
                            fontWeight: 600,
                            fontSize: "16px",
                            lineHeight: "140%",
                            color: "white",
                          }}
                        >
                          {feature.title}
                        </h4>
                        <p
                          style={{
                            fontFamily:
                              'var(--font-inria-sans), "Inria Sans", sans-serif',
                            fontWeight: 400,
                            fontSize: "14px",
                            lineHeight: "140%",
                            color: "rgba(151, 151, 151, 1)",
                          }}
                        >
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="pt-16 pb-20 px-6 md:px-12 bg-[#101010]">
        <div className="max-w-6xl mx-auto">
          {/* Badge - same style as hero */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
              style={{
                background: "#0D0D0D",
                border: "1px solid #FFCC00",
                boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
              }}
            >
              <img
                src="/img/waitlist/hero/shining.svg"
                alt=""
                className="w-5 h-5"
              />
              <span className="text-sm font-semibold text-[#FFCC00]">
                Trust & Security
              </span>
            </div>
          </div>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "Poppins, sans-serif",
              fontWeight: 700,
              fontSize: "36px",
              lineHeight: "45px",
              textAlign: "center",
              color: "#fff",
              marginBottom: "8px",
            }}
          >
            Built on Security. Designed for Confidence.
          </h2>

          {/* Section Subtitle */}
          <p
            style={{
              fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif',
              fontWeight: 400,
              fontSize: "18px",
              lineHeight: "22px",
              textAlign: "center",
              color: "rgba(255, 204, 0, 1)",
              marginBottom: "48px",
            }}
          >
            RepairCoin ensures rewards are secure and transparent, giving
            everyone confidence in the system.
          </p>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                icon: "/img/waitlist/section7/shield-check.svg",
                title: "Secure by Design",
                description:
                  "Rewards are protected using blockchain technology. Making every transaction verifiable and tamper resistant.",
              },
              {
                icon: "/img/waitlist/section7/eye.svg",
                title: "Transparent & Trackable",
                description:
                  "Every reward issued and redeemed is recorded clearly, giving full visibility to both businesses and customers.",
              },
              {
                icon: "/img/waitlist/section7/clock.svg",
                title: "Reliable for Everyday Use",
                description:
                  "RepairCoin is built for real-world services, with safeguards that ensure rewards remain accurate and dependable.",
              },
              {
                icon: "/img/waitlist/section7/settings.svg",
                title: "Always in Your Control",
                description:
                  "Track balances, view activity, and redeem with full visibility and confidence.",
              },
            ].map((feature, index) => (
              <div key={index} className="relative pt-8 text-center h-full">
                {/* Icon floating above card */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 bg-[#FFCC00] rounded-full flex items-center justify-center z-10">
                  <img src={feature.icon} alt="" className="w-7 h-7" />
                </div>

                {/* Card */}
                <div
                  className="pt-10 pb-6 px-4 h-full flex flex-col"
                  style={{
                    border: "1px solid rgba(153, 153, 153, 0.33)",
                    borderRadius: "8px",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      fontWeight: 600,
                      fontSize: "16px",
                      lineHeight: "100%",
                      color: "#fff",
                      marginBottom: "12px",
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="flex-grow"
                    style={{
                      fontFamily:
                        'var(--font-inria-sans), "Inria Sans", sans-serif',
                      fontWeight: 400,
                      fontSize: "14px",
                      lineHeight: "140%",
                      textAlign: "center",
                      color: "rgba(153, 153, 153, 1)",
                    }}
                  >
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="pt-16 pb-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Badge - same style as hero */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
              style={{
                background: "#0D0D0D",
                border: "1px solid #FFCC00",
                boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
              }}
            >
              <img
                src="/img/waitlist/hero/shining.svg"
                alt=""
                className="w-5 h-5"
              />
              <span className="text-sm font-semibold text-[#FFCC00]">
                Industries
              </span>
            </div>
          </div>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "Poppins, sans-serif",
              fontWeight: 700,
              fontSize: "36px",
              lineHeight: "45px",
              textAlign: "center",
              color: "white",
              marginBottom: "8px",
            }}
          >
            Designed for businesses that thrive on repeat visits
          </h2>

          {/* Section Subtitle */}
          <p
            style={{
              fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif',
              fontWeight: 400,
              fontSize: "18px",
              lineHeight: "22px",
              textAlign: "center",
              color: "rgba(255, 204, 0, 1)",
              marginBottom: "48px",
            }}
          >
            Turn everyday service visits into long-term customer value
          </p>

          {/* Industry Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              {
                icon: "/img/waitlist/section8/wrench.svg",
                name: "Repair Shops",
              },
              {
                icon: "/img/waitlist/section8/scissors.svg",
                name: "Barbers & Salons",
              },
              {
                icon: "/img/waitlist/section8/dumbbell.svg",
                name: "Gyms & Fitness",
              },
              { icon: "/img/waitlist/section8/car.svg", name: "Auto Shops" },
              {
                icon: "/img/waitlist/section8/heart-pulse.svg",
                name: "Clinics & Wellness",
              },
              {
                icon: "/img/waitlist/section8/store.svg",
                name: "Local Service Businesses",
              },
            ].map((industry, index) => (
              <div
                key={index}
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background:
                    "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                  <img src={industry.icon} alt="" className="w-5 h-5" />
                </div>
                <span className="text-white text-sm font-medium">
                  {industry.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="pt-16 pb-20 px-6 md:px-12 bg-[#101010]">
        <div className="max-w-3xl mx-auto">
          {/* Badge - same style as hero */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
              style={{
                background: "#0D0D0D",
                border: "1px solid #FFCC00",
                boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
              }}
            >
              <img
                src="/img/waitlist/hero/shining.svg"
                alt=""
                className="w-5 h-5"
              />
              <span className="text-sm font-semibold text-[#FFCC00]">
                What You Should Know
              </span>
            </div>
          </div>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "Poppins, sans-serif",
              fontWeight: 700,
              fontSize: "36px",
              lineHeight: "45px",
              textAlign: "center",
              color: "#fff",
              marginBottom: "48px",
            }}
          >
            Frequently Asked Questions
          </h2>

          {/* FAQ Items */}
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl overflow-hidden"
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  background: "rgba(15, 16, 18, 1)",
                }}
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <img
                      src="/img/waitlist/section9/star.svg"
                      alt=""
                      className="w-5 h-5 flex-shrink-0"
                    />
                    <span
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 600,
                        fontSize: "17px",
                        lineHeight: "23.4px",
                        letterSpacing: "-0.4px",
                        color: "#fff",
                      }}
                    >
                      {faq.question}
                    </span>
                  </div>
                  <img
                    src="/img/waitlist/section9/arrow.svg"
                    alt=""
                    className={`w-5 h-5 flex-shrink-0 transition-transform ${faqOpen === index ? "rotate-180" : ""}`}
                  />
                </button>
                {faqOpen === index && (
                  <div className="px-6 pb-4 pl-14">
                    <p
                      style={{
                        fontFamily:
                          'var(--font-inria-sans), "Inria Sans", sans-serif',
                        fontWeight: 300,
                        fontSize: "17px",
                        lineHeight: "25.2px",
                        letterSpacing: "-0.32px",
                        color: "rgba(239, 239, 235, 1)",
                      }}
                    >
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section + Footer with hero background */}
      <div
        className="relative bg-[#101010]"
        style={{
          backgroundImage: `url('/img/waitlist/hero/hero_bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        <section className="relative pt-16 pb-20 px-6 md:px-12 overflow-hidden">
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div>
                {/* Badge - same style as hero */}
                <div className="mb-6">
                  <div
                    className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
                    style={{
                      background: "#0D0D0D",
                      border: "1px solid #FFCC00",
                      boxShadow:
                        "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
                    }}
                  >
                    <img
                      src="/img/waitlist/hero/shining.svg"
                      alt=""
                      className="w-5 h-5"
                    />
                    <span className="text-sm font-semibold text-[#FFCC00]">
                      Founding Partner Access
                    </span>
                  </div>
                </div>

                {/* Heading */}
                <h2
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "60px",
                    lineHeight: "120%",
                    color: "#fff",
                    marginBottom: "16px",
                  }}
                >
                  S
                  <span className="relative inline-block">
                    ecure You
                    {/* Yellow curve - centered under "ecure You" */}
                    <svg
                      className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                      style={{
                        bottom: "-4px",
                        width: "90%",
                        height: "8px",
                      }}
                      viewBox="0 0 312 14"
                      fill="none"
                      preserveAspectRatio="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M0.333984 11C54.1609 4.96301 191.719 -3.48877 311.334 11"
                        stroke="#FFCC00"
                        strokeWidth="6"
                      />
                    </svg>
                  </span>
                  r
                  <br />
                  Founding Partner
                  <br />
                  Status
                </h2>

                {/* Subtitle */}
                <p
                  style={{
                    fontFamily:
                      'var(--font-inria-sans), "Inria Sans", sans-serif',
                    fontWeight: 400,
                    fontSize: "20px",
                    lineHeight: "32px",
                    color: "#fff",
                  }}
                >
                  Early partners secure permanent Elite tier status and help
                  shape the RepairCoin ecosystem from the start.
                </p>
              </div>

              {/* Right Form */}
              <div
                className="rounded-2xl p-8 bg-[#0d0d0d]"
                style={{
                  border: "1px solid rgba(221, 221, 221, 0.44)",
                }}
              >
                <form onSubmit={handleSubmit}>
                  {/* Email Input */}
                  <div className="mb-6">
                    <label
                      className="block mb-2"
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 600,
                        fontSize: "14px",
                        lineHeight: "22px",
                        color: "#fff",
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 text-black placeholder-gray-400 focus:outline-none transition-colors"
                      style={{
                        background: "#fff",
                        border: "1px solid rgba(151, 151, 151, 0.55)",
                        borderRadius: "5px",
                      }}
                      required
                    />
                  </div>

                  {/* User Type Selection */}
                  <div className="mb-6">
                    <label
                      className="block mb-3"
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 600,
                        fontSize: "14px",
                        lineHeight: "22px",
                        color: "#fff",
                      }}
                    >
                      I'm joining as
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setUserType("shop")}
                        className={`px-4 py-5 transition-all text-left flex items-start gap-3 ${
                          userType === "shop" ? "ring-2 ring-[#FFCC00]" : ""
                        }`}
                        style={{
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          background:
                            "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                          borderRadius: "16px",
                        }}
                      >
                        <div className="w-11 h-11 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                          <img
                            src="/img/waitlist/section10/store.svg"
                            alt=""
                            className="w-5 h-5"
                          />
                        </div>
                        <div>
                          <span className="text-white font-semibold block text-base">
                            Shop Owner
                          </span>
                          <p className="text-gray-400 text-sm mt-1 leading-snug">
                            Early partner access
                            <br />& onboarding process
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUserType("customer")}
                        className={`px-4 py-5 transition-all text-left flex items-start gap-3 ${
                          userType === "customer" ? "ring-2 ring-[#FFCC00]" : ""
                        }`}
                        style={{
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          background:
                            "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                          borderRadius: "16px",
                        }}
                      >
                        <div className="w-11 h-11 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                          <img
                            src="/img/waitlist/section10/user.svg"
                            alt=""
                            className="w-5 h-5"
                          />
                        </div>
                        <div>
                          <span className="text-white font-semibold block text-base">
                            Customer
                          </span>
                          <p className="text-gray-400 text-sm mt-1 leading-snug">
                            Get notified when
                            <br />
                            rewards go live near you.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Helper text */}
                    <p
                      className="mt-6"
                      style={{
                        fontFamily:
                          'var(--font-inria-sans), "Inria Sans", sans-serif',
                        fontWeight: 400,
                        fontSize: "12px",
                        lineHeight: "100%",
                        color: "rgba(232, 232, 232, 1)",
                      }}
                    >
                      We'll tailor updates based on your selection.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("");
                        setUserType("");
                      }}
                      className="py-4 px-6 transition-colors"
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 500,
                        fontSize: "16px",
                        lineHeight: "100%",
                        background: "rgba(232, 232, 232, 1)",
                        borderRadius: "8px",
                        color: "#000",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !email || !userType}
                      className="py-4 px-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 500,
                        fontSize: "16px",
                        lineHeight: "100%",
                        background: "rgba(255, 204, 0, 1)",
                        borderRadius: "8px",
                        color: "#000",
                      }}
                    >
                      {loading ? "Joining..." : "Join Waitlist →"}
                    </button>
                  </div>

                  <p
                    className="text-left"
                    style={{
                      fontFamily:
                        'var(--font-inria-sans), "Inria Sans", sans-serif',
                      fontWeight: 400,
                      fontSize: "12px",
                      lineHeight: "17px",
                      color: "rgba(232, 232, 232, 1)",
                    }}
                  >
                    Your information is secure and will only be used for
                    RepairCoin updates.
                    <br />
                    No spam, unsubscribe anytime.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 md:px-12">
          <div className="max-w-6xl mx-auto">
            {/* Row 1: Logo (left) and Nav Links (right) */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8">
              {/* Logo */}
              <Link href="/" className="inline-block">
                <div className="relative w-[185px] h-[50px]">
                  <Image
                    src="/img/nav-logo.png"
                    alt="RepairCoin Logo"
                    fill
                    className="object-contain"
                    sizes="185px"
                  />
                </div>
              </Link>

              {/* Nav Links */}
              <nav className="flex items-center gap-6">
                <a
                  href="#"
                  className="hover:opacity-80 transition-opacity"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    lineHeight: "100%",
                    color: "#fff",
                  }}
                >
                  When It's For
                </a>
                <a
                  href="#"
                  className="hover:opacity-80 transition-opacity"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    lineHeight: "100%",
                    color: "#fff",
                  }}
                >
                  Trust & Security
                </a>
                <a
                  href="#"
                  className="hover:opacity-80 transition-opacity"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    lineHeight: "100%",
                    color: "#fff",
                  }}
                >
                  Industries
                </a>
                <a
                  href="#"
                  className="hover:opacity-80 transition-opacity"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    lineHeight: "100%",
                    color: "#fff",
                  }}
                >
                  FAQ Section
                </a>
              </nav>
            </div>
          </div>

          {/* Full width border line */}
          <div className="border-t border-white/10"></div>

          <div className="max-w-6xl mx-auto">
            {/* Row 2: Copyright (center) and Social Icons (right) */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
              {/* Empty spacer for left side */}
              <div className="hidden md:block w-[100px]"></div>

              {/* Copyright - centered */}
              <p
                className="text-center"
                style={{
                  fontFamily: "Poppins, sans-serif",
                  fontWeight: 500,
                  fontSize: "14px",
                  lineHeight: "20px",
                  color: "rgba(232, 232, 232, 1)",
                }}
              >
                © 2026 · RepairCoin.ai | All Rights Reserved
              </p>

              {/* Social Icons - right aligned */}
              <div className="flex items-center gap-4">
                <a
                  href="#"
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ background: "rgba(43, 43, 45, 1)" }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="#fff"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ background: "rgba(43, 43, 45, 1)" }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="#fff"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ background: "rgba(43, 43, 45, 1)" }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="#fff"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal for Join Waitlist (triggered by hero button) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowModal(false)}
          ></div>
          <div
            className="relative rounded-2xl p-8 max-w-md w-full"
            style={{
              background: "#0D0D0D",
              border: "1px solid rgba(221, 221, 221, 0.44)",
            }}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h3
              className="mb-6"
              style={{
                fontFamily: "Poppins, sans-serif",
                fontWeight: 600,
                fontSize: "24px",
                lineHeight: "140%",
                color: "#fff",
              }}
            >
              Join the Waitlist
            </h3>

            <form onSubmit={handleSubmit}>
              {/* Email Input */}
              <div className="mb-6">
                <label
                  className="block mb-2"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    lineHeight: "22px",
                    color: "#fff",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 text-black placeholder-gray-400 focus:outline-none transition-colors"
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(151, 151, 151, 0.55)",
                    borderRadius: "5px",
                  }}
                  required
                />
              </div>

              {/* User Type Selection */}
              <div className="mb-6">
                <label
                  className="block mb-3"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    lineHeight: "22px",
                    color: "#fff",
                  }}
                >
                  I'm joining as
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setUserType("shop")}
                    className={`px-4 py-5 transition-all text-left flex items-start gap-3 ${
                      userType === "shop" ? "ring-2 ring-[#FFCC00]" : ""
                    }`}
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background:
                        "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                      borderRadius: "16px",
                    }}
                  >
                    <div className="w-11 h-11 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src="/img/waitlist/section10/store.svg"
                        alt=""
                        className="w-5 h-5"
                      />
                    </div>
                    <div>
                      <span className="text-white font-semibold block text-base">
                        Shop Owner
                      </span>
                      <p className="text-gray-400 text-sm mt-1 leading-snug">
                        Early partner access
                        <br />& onboarding process
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserType("customer")}
                    className={`px-4 py-5 transition-all text-left flex items-start gap-3 ${
                      userType === "customer" ? "ring-2 ring-[#FFCC00]" : ""
                    }`}
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background:
                        "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                      borderRadius: "16px",
                    }}
                  >
                    <div className="w-11 h-11 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src="/img/waitlist/section10/user.svg"
                        alt=""
                        className="w-5 h-5"
                      />
                    </div>
                    <div>
                      <span className="text-white font-semibold block text-base">
                        Customer
                      </span>
                      <p className="text-gray-400 text-sm mt-1 leading-snug">
                        Get notified when
                        <br />
                        rewards go live near you.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Helper text */}
                <p
                  className="mt-6"
                  style={{
                    fontFamily:
                      'var(--font-inria-sans), "Inria Sans", sans-serif',
                    fontWeight: 400,
                    fontSize: "12px",
                    lineHeight: "100%",
                    color: "rgba(232, 232, 232, 1)",
                  }}
                >
                  We'll tailor updates based on your selection.
                </p>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-4 px-6 transition-colors"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 500,
                    fontSize: "16px",
                    lineHeight: "100%",
                    background: "rgba(232, 232, 232, 1)",
                    borderRadius: "8px",
                    color: "#000",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email || !userType}
                  className="py-4 px-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 500,
                    fontSize: "16px",
                    lineHeight: "100%",
                    background: "rgba(255, 204, 0, 1)",
                    borderRadius: "8px",
                    color: "#000",
                  }}
                >
                  {loading ? "Joining..." : "Join Waitlist →"}
                </button>
              </div>

              <p
                className="text-left"
                style={{
                  fontFamily:
                    'var(--font-inria-sans), "Inria Sans", sans-serif',
                  fontWeight: 400,
                  fontSize: "12px",
                  lineHeight: "17px",
                  color: "rgba(232, 232, 232, 1)",
                }}
              >
                Your information is secure and will only be used for RepairCoin
                updates.
                <br />
                No spam, unsubscribe anytime.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
