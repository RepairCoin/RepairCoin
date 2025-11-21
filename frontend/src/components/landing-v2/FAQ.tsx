'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
  {
    question: 'What is RepairCoin (RCN)?',
    answer: 'RepairCoin (RCN) is a blockchain-based utility token designed specifically for the repair industry. Each RCN token has a fixed value of $0.10 USD and can be earned through repairs and referrals, then redeemed at participating shops.'
  },
  {
    question: 'How do I earn RCN tokens?',
    answer: 'You earn RCN tokens by getting repairs done at participating shops (1 RCN per $10 spent), referring friends (25 RCN per successful referral), and through loyalty bonuses based on your tier (Bronze, Silver, or Gold).'
  },
  {
    question: 'Where can I redeem my RCN tokens?',
    answer: 'You can redeem RCN at any verified RepairCoin partner shop. You\'ll get 100% value at the shop where you earned the tokens, and 20% value at other participating shops nationwide.'
  },
  {
    question: 'What is RCG and how is it different from RCN?',
    answer: 'RCG (RepairCoin Governance) is the governance token with a fixed supply of 100M tokens. While RCN is for customer rewards, RCG is staked by shops to unlock tier benefits (Standard/Premium/Elite) and grants voting rights in the DAO.'
  },
  {
    question: 'How does the redemption approval process work?',
    answer: 'When you want to redeem tokens at a shop, they send a redemption request to your account. You review the details and approve it through your RepairCoin app. Only after your approval are the tokens transferred and deducted from your balance.'
  },
  {
    question: 'Do my RCN tokens expire?',
    answer: 'No, RCN tokens never expire. You can hold them as long as you want and redeem them whenever you need repair services at participating shops.'
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative bg-[#191919] w-full py-20">
      <div className="max-w-4xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Frequently Asked Questions
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-600 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                )}
              </button>

              {openIndex === index && (
                <div className="px-6 pb-6">
                  <p className="text-gray-700 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
