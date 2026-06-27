"use client";

import React from "react";
import { Bot, Settings, Gift, Network, Pencil, BarChart3, Sparkles } from "lucide-react";
import FeatureShowcase, { FeatureShowcaseProps } from "./FeatureShowcase";

const SHOP_SHOWCASES: FeatureShowcaseProps[] = [
  {
    badge: "AI Assistant",
    badgeIcon: <Bot className="w-5 h-5" />,
    title: "Your AI Assistant for Smart Decisions",
    description:
      "Get answers, insights and recommendations instantly. Your AI Assistant helps you save time, automate tasks, and grow your business.",
    bullets: [
      "Ask anything about your business",
      "Get AI-powered insights and reports",
      "Automate tasks and follow-ups",
      "Receive smart recommendations",
    ],
    image: "/img/features/showcase-ai-assistant.png",
    imageAlt: "FixFlow AI Assistant dashboard",
  },
  {
    badge: "Business Operations",
    badgeIcon: <Settings className="w-5 h-5" />,
    title: "Run Your Business Like a Pro",
    description:
      "Powerful tools to manage your daily operations, appointments and team - all in one place.",
    image: "/img/features/showcase-business-operations.png",
    imageAlt: "FixFlow business operations dashboard",
  },
  {
    badge: "Rewards Hub",
    badgeIcon: <Gift className="w-5 h-5" />,
    title: (
      <>
        Reward Customers.
        <br />
        Build Loyalty.
      </>
    ),
    description:
      "Turn one-time customers into lifelong fans with loyalty programs, referral and perks.",
    bullets: [
      "Loyalty points and rewards",
      "Referral programs",
      "Tiers and exclusive perks",
      "Customer engagement analytics",
    ],
    image: "/img/features/showcase-rewards-hub.png",
    imageAlt: "FixFlow Rewards Hub dashboard",
  },
  {
    badge: "Partner Network",
    badgeIcon: <Network className="w-5 h-5" />,
    title: (
      <>
        Grow Together
        <br />
        With Partners
      </>
    ),
    description:
      "Join a powerful network of businesses. Discover partners, cross promote and attract more customers.",
    bullets: [
      "Find a connect with partner shops",
      "Expand your reach and grow together",
      "Stronger community, more opportunities",
    ],
    image: "/img/features/showcase-partner-network.png",
    imageAlt: "FixFlow partner network map",
  },
  {
    badge: "Branding Studio",
    badgeIcon: <Pencil className="w-5 h-5" />,
    title: (
      <>
        Build a Brand that
        <br />
        Stands Out
      </>
    ),
    description:
      "Create a professional brand identity in minutes with AI-powered tools and templates.",
    bullets: [
      "Logo and brand identity",
      "Marketing materials and templates",
      "Social media content",
    ],
    image: "/img/features/showcase-branding-studio.png",
    imageAlt: "FixFlow Branding Studio",
  },
  {
    badge: "Analytics & Insights",
    badgeIcon: <BarChart3 className="w-5 h-5" />,
    title: (
      <>
        Data Driven Growth
        <br />
        Powered by AI
      </>
    ),
    description:
      "Understand customer behavior, track performance, and uncover growth opportunities with AI-powered insights.",
    bullets: [
      "Revenue and performance tracking",
      "AI-powered business insights",
      "Smart growth recommendations",
      "Business profile builder",
    ],
    image: "/img/features/showcase-analytics-insights.png",
    imageAlt: "FixFlow analytics and insights dashboard",
  },
  {
    badge: "Automation",
    badgeIcon: <Sparkles className="w-5 h-5" />,
    title: (
      <>
        Automate. Save Time.
        <br />
        Focus on Growth.
      </>
    ),
    description:
      "Automate repetitive tasks and workflows so you can focus on what matters most.",
    bullets: [
      "Automated follow-ups",
      "Appointment reminders",
      "Reward triggers",
      "Business profile builder",
    ],
    image: "/img/features/showcase-automation.png",
    imageAlt: "FixFlow automation workflow",
  },
];

export default function ShopFeatureShowcases() {
  return (
    <>
      {SHOP_SHOWCASES.map((showcase) => (
        <FeatureShowcase key={showcase.badge} {...showcase} />
      ))}
    </>
  );
}
