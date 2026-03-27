"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "How do I issue RCN rewards to customers?",
    answer:
      "Navigate to the 'Tools' tab and use the 'Issue Rewards' section. Enter the customer's wallet address and the repair amount. The system automatically calculates RCN rewards (1 RCN per $10 spent) plus any tier bonuses. Confirm the transaction to issue the rewards instantly.",
  },
  {
    question: "How does the redemption process work?",
    answer:
      "When a customer wants to redeem RCN at your shop, go to the 'Tools' tab and use the 'Process Redemption' section. Enter the customer's wallet address and redemption amount. The customer will receive a notification to approve the redemption. Once approved, tokens are transferred and deducted from their balance.",
  },
  {
    question: "What is the difference between RCN and RCG?",
    answer:
      "RCN (RepairCoin) is the utility token used for customer rewards ($0.10 per token). RCG (RepairCoin Governance) is the governance token that shops can stake to unlock tier benefits (Standard/Premium/Elite) and participate in DAO voting. Staking RCG reduces your RCN purchase costs.",
  },
  {
    question: "How do I purchase RCN tokens?",
    answer:
      "Go to the 'Purchase' tab to buy RCN tokens. Pricing is tiered based on your RCG holdings: $0.10/RCN (Standard), $0.09/RCN (Premium), $0.08/RCN (Elite). You can pay via Stripe (credit card) or cryptocurrency. Tokens are added to your balance immediately after payment.",
  },
  {
    question: "What subscription plans are available?",
    answer:
      "RepairCoin offers a $500/month subscription that gives your shop full operational access including reward issuance, redemption processing, customer management, service marketplace, and analytics. Alternatively, shops holding 200K+ RCG tokens qualify for free access via RCG staking.",
  },
  {
    question: "How do customer tiers affect my shop?",
    answer:
      "Customer tiers (Bronze/Silver/Gold) determine bonus rewards. When issuing rewards, Bronze customers get standard 1 RCN per $10, Silver gets +2 RCN bonus, and Gold gets +5 RCN bonus. These bonuses are automatically calculated and deducted from your RCN balance.",
  },
  {
    question: "Can customers redeem RCN earned at other shops?",
    answer:
      "Yes, RepairCoin has universal redemption enabled. Customers can redeem 100% of RCN earned at your shop when they return to you, and 20% of RCN earned at other shops. This increases foot traffic by attracting customers from the entire RepairCoin network.",
  },
  {
    question: "How do I manage my service marketplace listings?",
    answer:
      "Navigate to the 'Services' tab to create, edit, or delete services. Upload images, set pricing, write descriptions, and configure booking settings. You can activate/deactivate services anytime. Customers browse your services on the marketplace and book appointments directly.",
  },
  {
    question: "What happens if my subscription is cancelled?",
    answer:
      "If you cancel your subscription, you'll maintain full access until the end of your current billing period. After that, operational features (reward issuance, redemptions, service bookings) will be disabled. You can reactivate anytime by renewing your subscription or staking 200K+ RCG.",
  },
  {
    question: "How do I handle appointment scheduling?",
    answer:
      "Go to 'Appointments' to configure your shop hours, slot duration, and booking capacity. Set holiday closures and special hours via date overrides. View all bookings in the calendar, click to see details, and mark orders complete when services are finished. Customers receive automatic reminders 24 hours before their appointments.",
  },
  {
    question: "What are affiliate shop groups?",
    answer:
      "Affiliate shop groups let you create coalitions with other shops to issue custom tokens/points. Link your services to groups to offer bonus rewards beyond standard RCN. Customers automatically earn both RCN and group tokens when they book group-linked services.",
  },
  {
    question: "How does the moderation system work?",
    answer:
      "Use the 'Moderation' section in Settings to block problematic customers, report platform issues to admins, and flag inappropriate reviews. Blocked customers cannot book services at your shop. You can track all your reports and manage your blocked customer list.",
  },
  {
    question: "How do I track my shop's performance?",
    answer:
      "The 'Service Analytics' tab provides comprehensive insights including revenue tracking, top performing services, category breakdown, order trends, RCN redemption analytics, and customer rating metrics. Use time period filters (7/30/90 days) to analyze performance over different timeframes.",
  },
  {
    question: "What should I do if my shop is suspended or paused?",
    answer:
      "Suspended shops have violated RepairCoin policies and cannot perform operational actions. Contact support to resolve the issue. Paused subscriptions are temporary holds by admins and can be resumed. Check the 'Subscription' tab for details and contact information.",
  },
];

export function ShopFAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#FFCC00] flex items-center gap-2">
          <HelpCircle className="w-5 h-5" />
          FAQ & Help
        </h2>
        <p className="text-sm text-gray-400 mt-2">
          Frequently asked questions about managing your RepairCoin shop
        </p>
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;

          return (
            <div
              key={index}
              className="bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-base font-medium text-white pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-5">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact Support Section */}
      <div className="mt-8 p-6 bg-gradient-to-r from-[#FFCC00]/10 to-[#FFCC00]/5 border border-[#FFCC00]/20 rounded-xl">
        <h3 className="text-lg font-semibold text-[#FFCC00] mb-2">
          Still need help?
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Can't find the answer you're looking for? Our support team is here to help.
        </p>
        <a
          href="mailto:support@repaircoin.com"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-[#E6B800] transition-all duration-200"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
