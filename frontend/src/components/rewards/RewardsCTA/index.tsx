"use client";

import Link from "next/link";
import Image from "next/image";
import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";

interface RewardsCTAProps {
  activeTab: "shopowner" | "customers";
}

const content = {
  shopowner: {
    line1: "Bring smart rewards",
    line2: "your services",
    subtitle:
      "Join RepairCoin and start rewarding customers, managing loyalty, and tracking growth—all in one platform.",
    cta: "Join as Shop Owner",
    href: "/choose?role=shop",
  },
  customers: {
    line1: "Loyalty That Grows",
    line2: "With You",
    subtitle:
      "Earn from your first service and unlock higher RCN rewards as your activity increases.",
    cta: "Join as Customer",
    href: "/choose?role=customer",
  },
};

const RewardsCTA = ({ activeTab }: RewardsCTAProps) => {
  const { line1, line2, subtitle, cta, href } = content[activeTab];

  return (
    <section className="relative overflow-hidden bg-[#0D0D0D] py-16 md:py-28">
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
          <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">
            {line1}
            <br />
            <span className="relative inline-block">
              {activeTab === "shopowner" ? "to " : ""}
              <span className="relative inline-block">
                <span className="text-gold-gradient">{line2}</span>
                <svg
                  className="absolute -bottom-2 md:-bottom-4 -left-[3%] w-[106%] h-[10px] md:h-[14px]"
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
            {subtitle}
          </p>

          <div className="flex justify-center mt-8">
            <Link
              href={href}
              className="btn-shimmer bg-[#FFCC00] text-black hover:bg-[#e6b800] transition-all duration-200 px-8 py-3 rounded-lg font-semibold"
            >
              {cta} &rarr;
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
};

export default RewardsCTA;
