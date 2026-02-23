import Image from "next/image";
import { Target } from "lucide-react";
import SectionBadge from "./SectionBadge";

const trustCards = [
  {
    icon: "/img/about/trust-clearvalue-icon.png",
    title: "Clear value, no surprises",
    description: "Rewards are designed to be stable and easy to understand, not a guessing game.",
  },
  {
    icon: "/img/about/trust-builtforlong-icon.png",
    title: "Built for long-term trust",
    description: "No expiration gimmicks.\nNo confusing point systems.\nJust consistent loyalty.",
  },
  {
    icon: "/img/about/trust-measurable-icon.png",
    title: "Measurable impact",
    description:
      "Track repeat visits, redemptions, and engagement so you can improve confidently.",
  },
];

const credibilityBadges = [
  "Fixed redemption model",
  "Non-public trading focus",
  "Anti-fraud mindset",
  "Operational analytics",
  "Built by service operator",
  "Proven in real service flows",
];

export default function Trust() {
  return (
    <section className="w-full bg-[#0D0D0D] px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <SectionBadge label="Trust" />
          <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Built to earn confidence, not hype
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-gray-400 text-sm sm:text-base leading-relaxed">
            RepairCoin is designed to feel responsible, stable, and practical for everyday
            businesses.
          </p>
        </div>

        {/* Trust cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {trustCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[32px] border border-white/5 p-8 pt-10"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
              }}
            >
              <div className="w-14 h-14 rounded-full bg-[#ffcc00] flex items-center justify-center mb-8">
                <Image
                  src={card.icon}
                  alt={card.title}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                {card.description}
              </p>
            </div>
          ))}
        </div>

        {/* Signals of credibility */}
        <div
          className="rounded-[32px] border border-white/5 p-8 sm:p-10"
          style={{
            background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
          }}
        >
          <h3 className="text-xl font-bold text-white mb-2">Signals of credibility</h3>
          <p className="text-gray-400 text-sm mb-6">
            Designed for early-stage trust before big logos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {credibilityBadges.map((badge) => (
              <div
                key={badge}
                className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl px-5 py-3.5"
              >
                <Target className="w-5 h-5 text-[#ffcc00] flex-shrink-0" />
                <span className="text-white text-sm font-medium">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
