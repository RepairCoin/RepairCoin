"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useBlockchainEnabled } from "@/contexts/AppConfigContext";

const faqs: { question: string; answer: string; blockchain?: boolean }[] = [
  {
    question: "What is RepairCoin (RCN)?",
    answer:
      "RepairCoin (RCN) is a digital rewards currency designed specifically for the repair industry. Each RCN has a fixed value of $0.10 USD and can be earned through repairs and referrals, then redeemed at participating shops.",
  },
  {
    question: "How do I earn RCN tokens?",
    answer:
      "You earn RCN tokens by getting repairs done at participating shops (1 RCN per $10 spent), referring friends (25 RCN per successful referral), and through loyalty bonuses based on your tier (Bronze, Silver, or Gold).",
  },
  {
    question: "Where can I redeem my RCN tokens?",
    answer:
      "You can redeem RCN at any verified RepairCoin partner shop. You'll get 100% value at the shop where you earned the tokens, and 20% value at other participating shops nationwide.",
  },
  {
    question: "What is RCG and how is it different from RCN?",
    answer:
      "RCG (RepairCoin Governance) is the governance token with a fixed supply of 100M tokens. While RCN is for customer rewards, RCG is staked by shops to unlock tier benefits (Standard/Premium/Elite) and grants voting rights in the DAO.",
    blockchain: true,
  },
  {
    question: "How does the redemption approval process work?",
    answer:
      "When you want to redeem tokens at a shop, they send a redemption request to your account. You review the details and approve it through your RepairCoin app. Only after your approval are the tokens transferred and deducted from your balance.",
  },
  {
    question: "Do my RCN tokens expire?",
    answer:
      "No, RCN tokens never expire. You can hold them as long as you want and redeem them whenever you need repair services at participating shops.",
  },
  {
    question: "How does the referral program work?",
    answer:
      "Share your unique referral code or link with friends. When they register and complete their first repair, you earn 25 RCN and they receive a 10 RCN welcome bonus. There is no limit to how many people you can refer.",
  },
  {
    question: "How do I gift tokens to someone?",
    answer:
      "Go to the Gift Tokens page, enter the recipient's wallet address (or scan their QR code), specify the amount, and confirm the transfer. Gifted tokens can be redeemed at any participating shop.",
    blockchain: true,
  },
];

export function CustomerFAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const blockchainEnabled = useBlockchainEnabled();
  const visibleFaqs = faqs.filter((f) => blockchainEnabled || !f.blockchain);

  return (
    <div className="w-full">
      <div className="space-y-3">
        {visibleFaqs.map((faq, index) => {
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
                  <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
