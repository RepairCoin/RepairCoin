"use client";

import React from "react";
import { Eye, BrainCircuit, Users, TrendingUp } from "lucide-react";
import AboutStorySection from "./AboutStorySection";

interface MissionCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const CARDS: MissionCard[] = [
  {
    icon: <BrainCircuit className="w-5 h-5" />,
    title: "AI-Powered Efficiency",
    description: "Helping businesses save time through automation and intelligent workflows.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Stronger Customer Relationships",
    description: "Creating meaningful connections through engagement, rewards, and loyalty.",
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: "Sustainable Growth",
    description: "Providing the tools and insights businesses need to grow with confidence.",
  },
];

export default function MissionVision() {
  return (
    <AboutStorySection
      badge="Mission & Vision"
      badgeIcon={<Eye className="w-5 h-5" />}
      title="Empowering Businesses Through AI"
      paragraphs={[
        "Our mission is to simplify the way businesses operate, engage customers, and drive growth.",
        "Our vision is to become the AI-powered platform that connects everything businesses need to succeed in one place.",
      ]}
      image="/img/about/mission-vision.png"
      imageAlt="FixFlow AI assistant connecting business dashboards"
      imageFill
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-8">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/5 py-6 px-4 text-center bg-[#1A1A1A]"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-[#FFCC00] text-black mb-4 mx-auto">
              {card.icon}
            </div>
            <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{card.description}</p>
          </div>
        ))}
      </div>
    </AboutStorySection>
  );
}
