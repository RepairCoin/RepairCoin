"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import axios from "axios";
import { getApiBaseUrl } from "@/utils/apiUrl";
import Link from "next/link";
import Image from "next/image";
import { CampaignConfig } from "@/app/waitlist/[source]/config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WaitlistTemplateProps {
  config: CampaignConfig;
}

export default function WaitlistTemplate({ config }: WaitlistTemplateProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"customer" | "shop" | "">("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Track page visit and prefetch thank you page on mount
  useEffect(() => {
    const thankyouPath = config.source === "direct"
      ? "/waitlist/thankyou"
      : `/waitlist/thankyou/${config.source}`;
    router.prefetch(thankyouPath);

    const trackPageVisit = async () => {
      try {
        await axios.post(
          `${getApiBaseUrl()}/waitlist/track-visit`,
          { source: config.source }
        );
      } catch {
        // Silent fail - don't block user experience
      }
    };
    trackPageVisit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (
    e: React.FormEvent,
    inquiryType: "waitlist" | "demo" = "waitlist"
  ) => {
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
        `${getApiBaseUrl()}/waitlist/submit`,
        {
          email: email.toLowerCase(),
          userType,
          inquiryType,
          source: config.source,
          ...(businessCategory && { businessCategory }),
          ...(city.trim() && { city: city.trim() }),
        }
      );

      if (response.data.success) {
        toast.success(
          inquiryType === "demo"
            ? "Demo request submitted!"
            : "Successfully joined the waitlist!",
          { duration: 5000, icon: inquiryType === "demo" ? "\uD83C\uDFAC" : "\uD83C\uDF89" }
        );

        sessionStorage.setItem("rc_waitlist_thankyou", JSON.stringify({
          type: inquiryType,
          email: email.toLowerCase(),
        }));

        const thankyouPath = config.source === "direct"
          ? "/waitlist/thankyou"
          : `/waitlist/thankyou/${config.source}`;
        router.push(thankyouPath);
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error("This email is already on the waitlist");
      } else {
        toast.error(
          error.response?.data?.error || "Failed to submit. Please try again."
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
        "RCN is designed specifically as a loyalty reward for the repair ecosystem, not as a speculative investment. Tokens can only be redeemed for repair services at partner shops\u2014this keeps the value stable and focused on supporting the repair industry.",
    },
    {
      question: "How is this different from a traditional loyalty program?",
      answer:
        "Traditional programs lock you into one shop. RepairCoin creates a network where you can earn at your favorite shop and redeem anywhere. Plus, blockchain ensures transparency\u2014you can verify every transaction and know your rewards will never disappear due to a program change or business closure.",
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
        "We\u2019re currently accepting launch partner applications. The first 50 approved shops will begin pilot testing in Q2 2026, with wider rollout planned for Q3 2026. Join the waitlist to stay updated on timeline and early access opportunities.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#101010] text-white scroll-smooth">
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

      {/* Hero Section */}
      <section className="relative py-16 md:py-24 px-6 md:px-12 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('/img/waitlist/hero/hero_bg.png')`,
          }}
        />

        <div className="max-w-6xl mx-auto text-center relative z-10 w-full">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-3 rounded-full px-5 py-2.5 mb-10"
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
              className="w-5 h-5 md:w-6 md:h-6"
            />
            <span className="text-sm md:text-base font-semibold text-[#FFCC00]">
              First 50 Shops Receive Elite Tier Status
            </span>
          </div>

          {/* Campaign Headline */}
          <h1 className="relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-8 leading-[1.1] tracking-tight">
            <span className="text-white">{config.headline}</span>
            <svg
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{ bottom: "-10px", width: "311px", height: "14px" }}
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

          {/* Campaign Subtext */}
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
            {config.subtext}
          </p>

          {/* Waitlist Form */}
          <div
            className="max-w-lg mx-auto w-full rounded-2xl p-6 md:p-8 text-left"
            style={{
              background: "#0D0D0D",
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
                  placeholder="Address"
                  className="w-full px-4 py-3.5 text-black placeholder-gray-400 focus:outline-none transition-colors"
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(151, 151, 151, 0.55)",
                    borderRadius: "5px",
                  }}
                  required
                />
              </div>

              {/* User Type Selection */}
              <div className="mb-8">
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
                  I&apos;m joining as
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUserType("shop")}
                    className={`p-5 transition-all text-left flex items-start gap-3 ${
                      userType === "shop" ? "ring-2 ring-[#FFCC00]" : ""
                    }`}
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background:
                        "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                      borderRadius: "16px",
                    }}
                  >
                    <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src="/img/waitlist/section10/store.svg"
                        alt=""
                        className="w-5 h-5"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-white font-semibold block text-sm">
                        Shop Owner
                      </span>
                      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                        Early partner access & onboarding process
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserType("customer")}
                    className={`p-5 transition-all text-left flex items-start gap-3 ${
                      userType === "customer" ? "ring-2 ring-[#FFCC00]" : ""
                    }`}
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background:
                        "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)",
                      borderRadius: "16px",
                    }}
                  >
                    <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src="/img/waitlist/section10/user.svg"
                        alt=""
                        className="w-5 h-5"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-white font-semibold block text-sm">
                        Customer
                      </span>
                      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                        Get notified when rewards go live near you.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Business Category (shown for shop owners) */}
              {userType === "shop" && (
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
                    What type of business? <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <Select value={businessCategory || "all"} onValueChange={(value) => setBusinessCategory(value === "all" ? "" : value)}>
                    <SelectTrigger variant="dark" className="w-full px-4 py-3.5 h-auto rounded-[5px]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent variant="dark">
                      <SelectItem variant="dark" value="all">Select category</SelectItem>
                      <SelectItem variant="dark" value="repair">Auto Repair</SelectItem>
                      <SelectItem variant="dark" value="barber">Barber / Salon</SelectItem>
                      <SelectItem variant="dark" value="nails">Nail Salon</SelectItem>
                      <SelectItem variant="dark" value="gym">Gym / Fitness</SelectItem>
                      <SelectItem variant="dark" value="restaurant">Restaurant</SelectItem>
                      <SelectItem variant="dark" value="retail">Retail</SelectItem>
                      <SelectItem variant="dark" value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* City (optional) */}
              <div className="mb-8">
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
                  City / State <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Los Angeles, CA"
                  className="w-full px-4 py-3.5 text-black placeholder-gray-400 focus:outline-none transition-colors"
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(151, 151, 151, 0.55)",
                    borderRadius: "5px",
                  }}
                />
              </div>

              {/* Submit Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="submit"
                  disabled={loading || !email || !userType}
                  className="py-4 px-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontSize: "16px",
                    lineHeight: "100%",
                    background: "rgba(255, 204, 0, 1)",
                    borderRadius: "8px",
                    color: "#000",
                  }}
                >
                  {loading ? "Joining..." : `${config.ctaText} \u2192`}
                </button>

                <button
                  type="button"
                  disabled={loading || !email || !userType}
                  onClick={(e) => handleSubmit(e as any, "demo")}
                  className="py-4 px-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontSize: "16px",
                    lineHeight: "100%",
                    background: "#fff",
                    borderRadius: "8px",
                    color: "#000",
                  }}
                >
                  {loading ? "Submitting..." : config.demoCtaText}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 5V19L19 12L8 5Z"
                      stroke="#000"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>
              </div>

              <p
                className="mt-4 text-center"
                style={{
                  fontFamily:
                    'var(--font-inria-sans), "Inria Sans", sans-serif',
                  fontWeight: 400,
                  fontSize: "12px",
                  lineHeight: "17px",
                  color: "rgba(232, 232, 232, 1)",
                }}
              >
                We respect your inbox. No spam. Only updates about RepairCoin.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Stats Section */}
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
                  className="text-3xl sm:text-4xl md:text-[44px]"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
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
                  "1 RCN = $0.10, always. No volatility, no speculation\u2014just predictable value.",
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
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
              style={{
                background: "#0D0D0D",
                border: "1px solid #FFCC00",
                boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset",
              }}
            >
              <img src="/img/waitlist/hero/shining.svg" alt="" className="w-5 h-5" />
              <span className="text-sm font-semibold text-[#FFCC00]">From Service to Rewards</span>
            </div>
          </div>

          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "36px", lineHeight: "45px", textAlign: "center", color: "white", marginBottom: "8px" }}>
            How RepairCoin Works
          </h2>
          <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 700, fontSize: "18px", lineHeight: "22px", textAlign: "center", color: "rgba(255, 204, 0, 1)", marginBottom: "48px" }}>
            No extra steps. No complexity. Just smarter rewards.
          </p>

          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {[
              { step: "1", title: "Customer Completes Service", desc: "Service and repair. Rewards are stored.", image: "/img/waitlist/section4/Photo1.png" },
              { step: "2", title: "Shop Issues RCN", desc: "Rewards are sent within after confirmation.", image: "/img/waitlist/section4/Photo2.png" },
              { step: "3", title: "Customer earns RCN", desc: "Transparent rewards. Tracked by both sides.", image: "/img/waitlist/section4/Photo3.png" },
              { step: "4", title: "Redeem Anywhere", desc: "Allow redemption at the shop of your choice.", image: "/img/waitlist/section4/Photo4.png" },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="overflow-hidden" style={{ background: "rgba(16, 16, 16, 1)", border: "1px solid rgba(103, 103, 103, 1)", borderRadius: "20px" }}>
                  <div className="aspect-[4/3] relative">
                    <Image src={item.image} alt={item.title} fill className="object-cover" style={{ borderRadius: "20px 20px 0 0" }} />
                  </div>
                  <div className="flex justify-center" style={{ marginTop: "10px" }}>
                    <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center text-black font-bold text-base shadow-md">{item.step}</div>
                  </div>
                  <div className="px-4 pt-3 pb-5 text-center">
                    <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "15px", lineHeight: "22px", color: "rgba(255, 255, 255, 1)", marginBottom: "4px" }}>{item.title}</h3>
                    <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "15px", lineHeight: "22px", color: "rgba(153, 153, 153, 1)" }}>{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Token Value */}
          <div className="text-center py-12 px-6 max-w-4xl mx-auto" style={{ border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "32px", background: "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)" }}>
            <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "44px", lineHeight: "140%", color: "rgba(255, 204, 0, 1)", marginBottom: "16px" }}>1 RCN = $0.10 USD</h3>
            <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "16px", lineHeight: "140%", textAlign: "center", color: "rgba(151, 151, 151, 1)", maxWidth: "42rem", margin: "0 auto" }}>
              Unlike volatile cryptocurrencies, RepairCoin tokens maintain a fixed, stable value. No speculation, no surprises\u2014just reliable rewards that customers can count on.
            </p>
          </div>
        </div>
      </section>

      {/* Built for Businesses */}
      <section id="when-its-for" className="pt-16 pb-20 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 rounded-full px-5 py-2.5" style={{ background: "#0D0D0D", border: "1px solid #FFCC00", boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset" }}>
              <img src="/img/waitlist/hero/shining.svg" alt="" className="w-5 h-5" />
              <span className="text-sm font-semibold text-[#FFCC00]">Who It&apos;s For</span>
            </div>
          </div>

          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "36px", lineHeight: "45px", textAlign: "center", color: "white", marginBottom: "8px" }}>
            Built for Businesses. Loved by Customers.
          </h2>
          <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 700, fontSize: "18px", lineHeight: "22px", textAlign: "center", color: "rgba(255, 204, 0, 1)", marginBottom: "48px" }}>
            A loyalty system that works seamlessly for both sides of every service.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Shop Owners */}
            <div className="overflow-hidden" style={{ border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", background: "linear-gradient(80.42deg, rgba(0, 0, 0, 0.55) 25.25%, rgba(58, 58, 76, 0.55) 98.05%)" }}>
              <div className="aspect-[16/9] bg-[#252525] relative">
                <Image src="/img/waitlist/section6/shop.png" alt="Shop Owner" fill className="object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-center" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "20px", lineHeight: "140%", color: "white", marginBottom: "24px" }}>For Shop Owners</h3>
                <div className="space-y-4">
                  {[
                    { icon: "/img/waitlist/section6/shop/trending-up.svg", title: "Proven Revenue Growth", desc: "Beta partners saw up to 40% increase in repeat business within 6 months" },
                    { icon: "/img/waitlist/section6/shop/trophy.svg", title: "Tiered Pricing", desc: "Standard ($0.10/RCN), PREMIUM ($0.08/RCN), or ELITE ($0.06/RCN) based on RCG governance holdings" },
                    { icon: "/img/waitlist/section6/shop/sparkles.svg", title: "Issue Instantly", desc: "Reward customers in seconds via dashboard or FixFlow CRM integration" },
                    { icon: "/img/waitlist/section6/shop/layout-dashboard.svg", title: "Analytics Dashboard", desc: "Track rewards issued, redemptions, customer tiers, and ROI in real-time" },
                    { icon: "/img/waitlist/section6/shop/globe.svg", title: "Marketplace Listing", desc: "Get discovered by customers across the network searching for services" },
                    { icon: "/img/waitlist/section6/shop/badge-check.svg", title: "Elite Partner Benefits", desc: "Premium/Elite tiers get governance voting rights and featured marketplace placement" },
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                        <img src={feature.icon} alt="" className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "16px", lineHeight: "140%", color: "white" }}>{feature.title}</h4>
                        <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "14px", lineHeight: "140%", color: "rgba(151, 151, 151, 1)" }}>{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* For Customers */}
            <div className="overflow-hidden" style={{ border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", background: "linear-gradient(80.42deg, rgba(0, 0, 0, 0.55) 25.25%, rgba(58, 58, 76, 0.55) 98.05%)" }}>
              <div className="aspect-[16/9] bg-[#252525] relative">
                <Image src="/img/waitlist/section6/customer.png" alt="Customer" fill className="object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-center" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "20px", lineHeight: "140%", color: "white", marginBottom: "24px" }}>For Customers</h3>
                <div className="space-y-4">
                  {[
                    { icon: "/img/waitlist/section6/customer/trending-up.svg", title: "Instant Rewards", desc: "RCN is issued immediately after you receive service from a RepairCoin shop" },
                    { icon: "/img/waitlist/section6/customer/store.svg", title: "Redeem Everywhere", desc: "Use your RCN at any shop. Redeem up to 20% of your RCN balance at shops other than your home shop." },
                    { icon: "/img/waitlist/section6/customer/trophy.svg", title: "Tier Bonuses", desc: "Earn 2-5% MORE RCN for every friend you refer\u2014they get 10 RCN too!" },
                    { icon: "/img/waitlist/section6/customer/users.svg", title: "Referral Rewards", desc: "Earn 25 RCN ($2.50) for every friend you refer\u2014they get 10 RCN too!" },
                    { icon: "/img/waitlist/section6/customer/globe-lock.svg", title: "You\u2019re in Control", desc: "Every redemption requires your approval. Tokens only move when you say so and confirm." },
                    { icon: "/img/waitlist/section6/customer/infinity.svg", title: "Never Expire", desc: "Your earned RCN tokens stay in your wallet forever, even if you change your wallet address." },
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                        <img src={feature.icon} alt="" className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "16px", lineHeight: "140%", color: "white" }}>{feature.title}</h4>
                        <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "14px", lineHeight: "140%", color: "rgba(151, 151, 151, 1)" }}>{feature.desc}</p>
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
      <section id="trust-security" className="pt-16 pb-20 px-6 md:px-12 bg-[#101010]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 rounded-full px-5 py-2.5" style={{ background: "#0D0D0D", border: "1px solid #FFCC00", boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset" }}>
              <img src="/img/waitlist/hero/shining.svg" alt="" className="w-5 h-5" />
              <span className="text-sm font-semibold text-[#FFCC00]">Trust & Security</span>
            </div>
          </div>

          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "36px", lineHeight: "45px", textAlign: "center", color: "#fff", marginBottom: "8px" }}>
            Built on Security. Designed for Confidence.
          </h2>
          <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "18px", lineHeight: "22px", textAlign: "center", color: "rgba(255, 204, 0, 1)", marginBottom: "48px" }}>
            RepairCoin ensures rewards are secure and transparent, giving everyone confidence in the system.
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: "/img/waitlist/section7/shield-check.svg", title: "Secure by Design", description: "Rewards are protected using blockchain technology. Making every transaction verifiable and tamper resistant." },
              { icon: "/img/waitlist/section7/eye.svg", title: "Transparent & Trackable", description: "Every reward issued and redeemed is recorded clearly, giving full visibility to both businesses and customers." },
              { icon: "/img/waitlist/section7/clock.svg", title: "Reliable for Everyday Use", description: "RepairCoin is built for real-world services, with safeguards that ensure rewards remain accurate and dependable." },
              { icon: "/img/waitlist/section7/settings.svg", title: "Always in Your Control", description: "Track balances, view activity, and redeem with full visibility and confidence." },
            ].map((feature, index) => (
              <div key={index} className="relative pt-8 text-center h-full">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 bg-[#FFCC00] rounded-full flex items-center justify-center z-10">
                  <img src={feature.icon} alt="" className="w-7 h-7" />
                </div>
                <div className="pt-10 pb-6 px-4 h-full flex flex-col" style={{ border: "1px solid rgba(153, 153, 153, 0.33)", borderRadius: "8px" }}>
                  <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "16px", lineHeight: "100%", color: "#fff", marginBottom: "12px" }}>{feature.title}</h3>
                  <p className="flex-grow" style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "14px", lineHeight: "140%", textAlign: "center", color: "rgba(153, 153, 153, 1)" }}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="pt-16 pb-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 rounded-full px-5 py-2.5" style={{ background: "#0D0D0D", border: "1px solid #FFCC00", boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset" }}>
              <img src="/img/waitlist/hero/shining.svg" alt="" className="w-5 h-5" />
              <span className="text-sm font-semibold text-[#FFCC00]">Industries</span>
            </div>
          </div>

          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "36px", lineHeight: "45px", textAlign: "center", color: "white", marginBottom: "8px" }}>
            Designed for businesses that thrive on repeat visits
          </h2>
          <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "18px", lineHeight: "22px", textAlign: "center", color: "rgba(255, 204, 0, 1)", marginBottom: "48px" }}>
            Turn everyday service visits into long-term customer value
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon: "/img/waitlist/section8/wrench.svg", name: "Repair Shops" },
              { icon: "/img/waitlist/section8/scissors.svg", name: "Barbers & Salons" },
              { icon: "/img/waitlist/section8/dumbbell.svg", name: "Gyms & Fitness" },
              { icon: "/img/waitlist/section8/car.svg", name: "Auto Shops" },
              { icon: "/img/waitlist/section8/heart-pulse.svg", name: "Clinics & Wellness" },
              { icon: "/img/waitlist/section8/store.svg", name: "Local Service Businesses" },
            ].map((industry, index) => (
              <div key={index} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                  <img src={industry.icon} alt="" className="w-5 h-5" />
                </div>
                <span className="text-white text-sm font-medium">{industry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="pt-16 pb-20 px-6 md:px-12 bg-[#101010]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 rounded-full px-5 py-2.5" style={{ background: "#0D0D0D", border: "1px solid #FFCC00", boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset" }}>
              <img src="/img/waitlist/hero/shining.svg" alt="" className="w-5 h-5" />
              <span className="text-sm font-semibold text-[#FFCC00]">What You Should Know</span>
            </div>
          </div>

          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "36px", lineHeight: "45px", textAlign: "center", color: "#fff", marginBottom: "48px" }}>
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255, 255, 255, 0.05)", background: "rgba(15, 16, 18, 1)" }}>
                <button
                  onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <img src="/img/waitlist/section9/star.svg" alt="" className="w-5 h-5 flex-shrink-0" />
                    <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "17px", lineHeight: "23.4px", letterSpacing: "-0.4px", color: "#fff" }}>{faq.question}</span>
                  </div>
                  <img src="/img/waitlist/section9/arrow.svg" alt="" className={`w-5 h-5 flex-shrink-0 transition-transform ${faqOpen === index ? "rotate-180" : ""}`} />
                </button>
                {faqOpen === index && (
                  <div className="px-6 pb-4 pl-14">
                    <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 300, fontSize: "17px", lineHeight: "25.2px", letterSpacing: "-0.32px", color: "rgba(239, 239, 235, 1)" }}>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section + Footer */}
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
                <div className="mb-6">
                  <div className="inline-flex items-center gap-3 rounded-full px-5 py-2.5" style={{ background: "#0D0D0D", border: "1px solid #FFCC00", boxShadow: "0px -7px 11px 0px rgba(164, 143, 255, 0.12) inset" }}>
                    <img src="/img/waitlist/hero/shining.svg" alt="" className="w-5 h-5" />
                    <span className="text-sm font-semibold text-[#FFCC00]">Founding Partner Access</span>
                  </div>
                </div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[60px]" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, lineHeight: "120%", color: "#fff", marginBottom: "16px" }}>
                  <span className="relative inline-block whitespace-nowrap">
                    Secure Your
                    <svg className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ bottom: "-10px", width: "90%", height: "14px" }} viewBox="0 0 312 14" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0.333984 11C54.1609 4.96301 191.719 -3.48877 311.334 11" stroke="#FFCC00" strokeWidth="6" />
                    </svg>
                  </span>
                  <br />Founding Partner<br />Status
                </h2>

                <p style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "20px", lineHeight: "32px", color: "#fff" }}>
                  Early partners secure permanent Elite tier status and help shape the RepairCoin ecosystem from the start.
                </p>
              </div>

              {/* Right Form */}
              <div className="rounded-2xl p-8 bg-[#0d0d0d]" style={{ border: "1px solid rgba(221, 221, 221, 0.44)" }}>
                <form onSubmit={handleSubmit}>
                  <div className="mb-6">
                    <label className="block mb-2" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "14px", lineHeight: "22px", color: "#fff" }}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Address" className="w-full px-4 py-3 text-black placeholder-gray-400 focus:outline-none transition-colors" style={{ background: "#fff", border: "1px solid rgba(151, 151, 151, 0.55)", borderRadius: "5px" }} required />
                  </div>

                  <div className="mb-8">
                    <label className="block mb-3" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "14px", lineHeight: "22px", color: "#fff" }}>I&apos;m joining as</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setUserType("shop")} className={`p-5 transition-all text-left flex items-start gap-3 ${userType === "shop" ? "ring-2 ring-[#FFCC00]" : ""}`} style={{ border: "1px solid rgba(255, 255, 255, 0.1)", background: "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)", borderRadius: "16px" }}>
                        <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                          <img src="/img/waitlist/section10/store.svg" alt="" className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-white font-semibold block text-sm">Shop Owner</span>
                          <p className="text-gray-400 text-xs mt-1 leading-relaxed">Early partner access & onboarding process</p>
                        </div>
                      </button>
                      <button type="button" onClick={() => setUserType("customer")} className={`p-5 transition-all text-left flex items-start gap-3 ${userType === "customer" ? "ring-2 ring-[#FFCC00]" : ""}`} style={{ border: "1px solid rgba(255, 255, 255, 0.1)", background: "linear-gradient(80.42deg, rgba(0, 0, 0, 0.16) 25.25%, rgba(58, 58, 76, 0.16) 98.05%)", borderRadius: "16px" }}>
                        <div className="w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                          <img src="/img/waitlist/section10/user.svg" alt="" className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-white font-semibold block text-sm">Customer</span>
                          <p className="text-gray-400 text-xs mt-1 leading-relaxed">Get notified when rewards go live near you.</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Business Category (shown for shop owners) */}
                  {userType === "shop" && (
                    <div className="mb-6">
                      <label className="block mb-2" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "14px", lineHeight: "22px", color: "#fff" }}>
                        What type of business? <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <Select value={businessCategory || "all"} onValueChange={(value) => setBusinessCategory(value === "all" ? "" : value)}>
                        <SelectTrigger variant="dark" className="w-full px-4 py-3.5 h-auto rounded-[5px]">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent variant="dark">
                          <SelectItem variant="dark" value="all">Select category</SelectItem>
                          <SelectItem variant="dark" value="repair">Auto Repair</SelectItem>
                          <SelectItem variant="dark" value="barber">Barber / Salon</SelectItem>
                          <SelectItem variant="dark" value="nails">Nail Salon</SelectItem>
                          <SelectItem variant="dark" value="gym">Gym / Fitness</SelectItem>
                          <SelectItem variant="dark" value="restaurant">Restaurant</SelectItem>
                          <SelectItem variant="dark" value="retail">Retail</SelectItem>
                          <SelectItem variant="dark" value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* City / State */}
                  <div className="mb-8">
                    <label className="block mb-2" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "14px", lineHeight: "22px", color: "#fff" }}>
                      City / State <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Los Angeles, CA"
                      className="w-full px-4 py-3.5 text-black placeholder-gray-400 focus:outline-none transition-colors"
                      style={{ background: "#fff", border: "1px solid rgba(151, 151, 151, 0.55)", borderRadius: "5px" }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="submit" disabled={loading || !email || !userType} className="py-4 px-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold" style={{ fontFamily: "Poppins, sans-serif", fontSize: "16px", lineHeight: "100%", background: "rgba(255, 204, 0, 1)", borderRadius: "8px", color: "#000" }}>
                      {loading ? "Joining..." : `${config.ctaText} \u2192`}
                    </button>
                    <button type="button" disabled={loading || !email || !userType} onClick={(e) => handleSubmit(e as any, "demo")} className="py-4 px-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2" style={{ fontFamily: "Poppins, sans-serif", fontSize: "16px", lineHeight: "100%", background: "#fff", borderRadius: "8px", color: "#000" }}>
                      {loading ? "Submitting..." : config.demoCtaText}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" stroke="#000" strokeWidth="2" strokeLinejoin="round" fill="none" /></svg>
                    </button>
                  </div>

                  <p className="mt-4 text-center" style={{ fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif', fontWeight: 400, fontSize: "12px", lineHeight: "17px", color: "rgba(232, 232, 232, 1)" }}>
                    We respect your inbox. No spam. Only updates about RepairCoin.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 md:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8">
              <Link href="/" className="inline-block">
                <div className="relative w-[185px] h-[50px]">
                  <Image src="/img/nav-logo.png" alt="RepairCoin Logo" fill className="object-contain" sizes="185px" />
                </div>
              </Link>
              <nav className="flex items-center gap-6">
                {[
                  { href: "#when-its-for", label: "Who It\u2019s For" },
                  { href: "#trust-security", label: "Trust & Security" },
                  { href: "#industries", label: "Industries" },
                  { href: "#faq", label: "FAQ Section" },
                ].map((link) => (
                  <a key={link.href} href={link.href} className="hover:opacity-80 transition-opacity" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "14px", lineHeight: "100%", color: "#fff" }}>
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          <div className="border-t border-white/10"></div>

          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
              <div className="hidden md:block w-[100px]"></div>
              <p className="text-center" style={{ fontFamily: "Poppins, sans-serif", fontWeight: 500, fontSize: "14px", lineHeight: "20px", color: "rgba(232, 232, 232, 1)" }}>
                &copy; 2026 &middot; RepairCoin.ai | All Rights Reserved
              </p>
              <div className="flex items-center gap-4">
                <a href="https://x.com/Repaircoin2025" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: "rgba(43, 43, 45, 1)" }}>
                  <img src="/img/waitlist/footer/socialicon2.svg" alt="X" className="w-[17px] h-[17px]" />
                </a>
                <a href="https://www.instagram.com/repaircoin/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: "rgba(43, 43, 45, 1)" }}>
                  <img src="/img/waitlist/footer/socialicon3.svg" alt="Instagram" className="w-[18px] h-[18px]" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: "rgba(43, 43, 45, 1)" }}>
                  <img src="/img/waitlist/footer/socialicon4.svg" alt="Telegram" className="w-[18px] h-[15px]" />
                </a>
                <a href="https://www.facebook.com/repaircoin" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: "rgba(43, 43, 45, 1)" }}>
                  <img src="/img/waitlist/footer/socialicon1.svg" alt="Facebook" className="w-[9px] h-[17px]" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
