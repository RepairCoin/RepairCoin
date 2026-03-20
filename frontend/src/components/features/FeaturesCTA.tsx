"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";
import type { TabType } from "./data";

interface FeaturesCTAProps {
  activeTab: TabType;
}

export default function FeaturesCTA({ activeTab }: FeaturesCTAProps) {
  return (
    <section className="relative overflow-hidden bg-[#0D0D0D] py-16 md:py-28 pb-24 md:pb-28">
      {/* Background wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "contain",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
        <AnimateOnScroll>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white leading-tight">
            Bring smart rewards
            <br />
            <span className="relative inline-block">
              to <span className="relative inline-block text-gold-gradient">your services</span>
              <span className="relative inline-block w-2/3">
                <svg
                  className="absolute bottom-1 md:bottom-5 -left-[3%] w-[106%] h-[12px] md:h-[18px]"
                  viewBox="0 0 311 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="none"
                >
                  <m.path
                    d="M2 5.5C80 1.5 230 1.5 309 5.5"
                    stroke="#ffcc00"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                  />
                </svg>
              </span>
            </span>
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.3}>
          <p className="mt-10 text-white/50 text-base max-w-md leading-relaxed">
            Join RepairCoin and start rewarding customers, managing loyalty,
            and tracking growth&mdash;all in one platform.
          </p>

          <div className="flex justify-center mt-8">
            <Link
              href={activeTab === "shop" ? "/choose?role=shop" : "/choose?role=customer"}
              className="btn-shimmer bg-[#FFCC00] text-black hover:bg-[#e6b800] transition-all duration-200 px-8 py-3 rounded-lg font-semibold"
            >
              {activeTab === "shop" ? "Join as Shop Owner" : "Join as Customer"} &rarr;
            </Link>
          </div>
        </AnimateOnScroll>
      </div>

      {/* RepairCoin logo -- bottom left */}
      <AnimateOnScroll delay={0.5} className="absolute bottom-6 left-4 md:left-8 z-10">
        <div className="relative w-[120px] md:w-[150px] h-[28px] md:h-[34px] opacity-75">
          <Image
            src="/img/nav-logo.png"
            alt="RepairCoin"
            fill
            className="object-contain object-left"
          />
        </div>
      </AnimateOnScroll>
    </section>
  );
}
