"use client";

import React from "react";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import SectionBadge from "@/components/about/SectionBadge";

export default function Proof() {
  return (
    <section className="relative bg-[#191919] py-12 sm:py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4 mb-10 sm:mb-16">
          <div className="flex justify-center">
            <SectionBadge label="Proof" />
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
            Built inside a $40K/month repair business
          </h2>

          <p className="text-[#F7CC00] italic mx-auto">
            Created and tested in a real service business before becoming a platform.
          </p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3">
                <BadgeCheck className="w-6 h-6 text-[#F7CC00] flex-shrink-0" />
                <h3 className="text-white font-bold text-xl">
                  Operator-built, not theory-built
                </h3>
              </div>
              <p className="text-gray-500 italic text-sm mt-1">
                &quot;Designed the way a real shop actually runs — not the way
                software thinks it should.&quot;
              </p>
            </div>

            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                RepairCoin was designed from inside real, day-to-day service
                operations where speed, clarity, and consistency matter. The
                flows, language, and incentives are shaped by how shops actually
                operate, not by theory or assumptions.
              </p>
              <p>
                Every decision was made with business owners in mind: minimizing
                extra steps for staff, avoiding disruption at the counter, and
                focusing on what truly drives repeat visits and revenue over
                time.
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-3">
              {["Retention-first", "Simple rollout", "Real workflows"].map(
                (tag) => (
                  <span
                    key={tag}
                    className="px-4 py-1.5 bg-[#1a1a1a] text-gray-300 text-sm rounded-full border border-gray-700"
                  >
                    {tag}
                  </span>
                )
              )}
            </div>

            {/* CTA */}
            <button className="bg-[#F7CC00] hover:bg-[#E5BB00] text-black font-semibold px-8 py-3.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
              Join Waitlist &rarr;
            </button>
          </div>

          {/* Right Content - Image */}
          <div className="relative h-[300px] sm:h-[400px] rounded-2xl overflow-hidden">
            <Image
              src="/img/landingv2/proofImage1.png"
              alt="Real repair business"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
