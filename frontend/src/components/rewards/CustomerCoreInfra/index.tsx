"use client";

import { ShieldCheck, Database, UserCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface InfraCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

const infraCards: InfraCard[] = [
  {
    icon: ShieldCheck,
    title: "Blockchain Powered",
    description:
      "Built on Base Sepolia with Thirdweb SDK v5 for secure, transparent transactions",
  },
  {
    icon: Database,
    title: "Enterprise Ready",
    description:
      "PostgreSQL database with domain-driven architecture for scalability",
  },
  {
    icon: UserCheck,
    title: "User Focused",
    description: "Next.js 15 + React 19 frontend with mobile-first design",
  },
];

const CustomerCoreInfra = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-[#ffcc00] bg-gradient-to-r from-[#ffcc00]/10 to-transparent text-[#ffcc00] mb-6">
          <Sparkles size={16} className="text-[#ffcc00]" />
          <span className="text-sm font-medium">Core Infrastructure</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Built on Modern Technology
        </h2>
        <p className="text-[#666] text-base">
          Powering RepairCoin with speed, security, and real scalability.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {infraCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="border border-[#2a2a2a] rounded-2xl p-6"
              style={{ background: "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)" }}
            >
              <div className="w-12 h-12 rounded-full bg-[#FFCC00] flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-[#777] leading-relaxed">{card.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default CustomerCoreInfra;
