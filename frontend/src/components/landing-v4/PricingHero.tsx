"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { m, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useModalStore } from "@/stores/modalStore";
import { useAuthStore } from "@/stores/authStore";
import {
  SUBSCRIBE_TIER_STORAGE_KEY,
  SubscriptionTier,
  SUBSCRIPTION_PLANS,
  getPlanByTier,
} from "@/config/subscriptionPlans";
import Badge from "./Badge";

interface Plan {
  name: string;
  description: string;
  price: string;
  tier: SubscriptionTier;
  popular?: boolean;
  robot: string;
  includesLabel: string;
  features: string[];
  aiValue: string;
  aiDescription: string;
}

// Pricing-page-only presentational data, keyed by tier. Plan labels, prices,
// features and includesLabel come from the shared subscriptionPlans config.
const planExtras: Record<
  SubscriptionTier,
  { description: string; robot: string; aiValue: string; aiDescription: string }
> = {
  starter: {
    description: "Perfect for solo operators and new businesses.",
    robot: "/img/landingv4/pricing-robot-starter.png",
    aiValue: "$10/month value",
    aiDescription: "Basic AI features and limited usage.",
  },
  growth: {
    description: "Everything you need to grow & scale.",
    robot: "/img/landingv4/pricing-robot-growth.png",
    aiValue: "$30/month value",
    aiDescription: "More AI power for marketing, content, leads and insights.",
  },
  business: {
    description: "Advanced solutions for growing operations.",
    robot: "/img/landingv4/pricing-robot-business.png",
    aiValue: "$75/month value",
    aiDescription: "Maximum AI power for automation, insights and growth.",
  },
};

const plans: Plan[] = SUBSCRIPTION_PLANS.map((plan) => ({
  name: plan.label,
  price: `$${plan.price}`,
  tier: plan.tier,
  popular: plan.popular,
  includesLabel: plan.includesLabel,
  features: getPlanByTier(plan.tier).features,
  ...planExtras[plan.tier],
}));

export default function PricingHero() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const { openWelcomeModal } = useModalStore();
  const { isShop, userProfile } = useAuthStore();

  const handleSelectPlan = (tier: SubscriptionTier) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SUBSCRIBE_TIER_STORAGE_KEY, tier);
    }
    if (isShop && userProfile?.shopId) {
      router.push(`/shop/subscription-form?tier=${tier}`);
    } else {
      openWelcomeModal();
    }
  };

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 24 },
    whileInView: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.5, delay, ease: "easeOut" as const },
  });

  return (
    <section className="relative bg-[#0a0a0a] overflow-hidden pt-32 pb-24">
      {/* Background pattern (same as hero) — top half only, fades out */}
      <div className="absolute inset-x-0 top-0 h-[820px] pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Image
          src="/img/landingv2/bg-background.png"
          alt=""
          fill
          className="object-cover opacity-70"
          priority
        />
      </div>
      {/* Top-to-bottom gradient overlay — dark at top, gold below */}
      <div className="absolute inset-x-0 top-0 h-[820px] pointer-events-none bg-[linear-gradient(to_bottom,transparent,rgba(247,204,0,0.45))]" />

      <div className="relative max-w-7xl mx-auto w-full px-4 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <m.div {...fadeUp(0)}>
            <Badge label="AI-Powered Plans" />
          </m.div>

          <m.h1
            {...fadeUp(0.1)}
            className="mt-6 font-bold text-white text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight"
          >
            Manage. Grow. Automate.
            <br />
            Powered by FixFlow AI.
          </m.h1>

          <m.p
            {...fadeUp(0.15)}
            className="mt-5 text-gray-300 text-base sm:text-lg max-w-2xl"
          >
            Start free, upgrade when you&apos;re ready, and unlock AI-powered tools
            designed to help you manage, automate, and grow.
          </m.p>
        </div>

        <div className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {plans.map((plan, index) => (
            <m.div
              key={plan.name}
              {...fadeUp(0.1 + index * 0.05)}
              className={`relative flex flex-col rounded-lg bg-white overflow-hidden shadow-xl ${
                plan.popular ? "lg:-mt-8 ring-2 ring-[#F7CC00] shadow-2xl" : ""
              }`}
            >
              {plan.popular && (
                <div className="flex items-center justify-center gap-2 bg-[#F7CC00] text-black font-medium text-sm py-2.5">
                  <Sparkles className="w-4 h-4" />
                  Most Popular
                </div>
              )}

              <div className="p-6">
                {/* Header */}
                <div className="relative">
                  <div className="pr-28">
                    <h3 className="text-gray-900 font-bold text-2xl">
                      {plan.name}
                    </h3>
                    <p className="mt-2 text-gray-500 text-sm">
                      {plan.description}
                    </p>
                  </div>

                  <div className="absolute top-1/2 right-0 -translate-y-1/2 w-32 h-36">
                    <Image
                      src={plan.robot}
                      alt=""
                      fill
                      sizes="128px"
                      unoptimized
                      className="object-contain object-center"
                    />
                  </div>

                  <div className="mt-5 flex items-baseline gap-1 pr-28">
                    <span className="text-gray-900 font-bold text-4xl">
                      {plan.price}
                    </span>
                    <span className="text-gray-900 text-lg">/ month</span>
                  </div>
                  <p className="mt-1 text-gray-400 text-xs tracking-wide uppercase">
                    Billed Monthly
                  </p>
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleSelectPlan(plan.tier)}
                  className="mt-5 w-full bg-[#F7CC00] hover:bg-[#e0b900] text-black font-semibold py-3 rounded-lg transition-colors duration-200"
                >
                  Start Free Trial
                </button>
                <p className="mt-3 pb-5 text-center text-gray-400 text-xs border-b border-gray-200">
                  14 days Free. No Credit Card.
                </p>

                {/* Includes */}
                <h4 className="mt-5 text-gray-900 font-semibold text-sm">
                  {plan.includesLabel}
                </h4>
                <ul className="mt-4 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-5 h-5 flex-shrink-0 rounded-full bg-[#F7CC00]">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* AI Usage */}
                <div className="mt-6 pt-5 border-t border-gray-200 flex items-start gap-5">
                  <span className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src="/img/landingv4/ai-usage-icon.png"
                      alt=""
                      fill
                      sizes="48px"
                      unoptimized
                      className="object-contain"
                    />
                  </span>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">
                      AI Usage Included
                    </p>
                    <p className="text-gray-900 text-sm">{plan.aiValue}</p>
                    <p className="text-gray-500 text-sm">{plan.aiDescription}</p>
                  </div>
                </div>
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
