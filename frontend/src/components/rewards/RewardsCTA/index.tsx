"use client";

import Link from "next/link";
import Image from "next/image";

interface RewardsCTAProps {
  activeTab: "shopowner" | "customers";
}

const content = {
  shopowner: {
    line1: "Bring smart rewards",
    line2: "to your services",
    subtitle:
      "Join RepairCoin and start rewarding customers, managing loyalty, and tracking growth—all in one platform.",
    cta: "Join as Shop Owner →",
    href: "/choose?role=shop",
  },
  customers: {
    line1: "Loyalty That Grows",
    line2: "With You",
    subtitle:
      "Earn from your first service and unlock higher RCN rewards as your activity increases.",
    cta: "Join as Customer →",
    href: "/choose?role=customer",
  },
};

const RewardsCTA = ({ activeTab }: RewardsCTAProps) => {
  const { line1, line2, subtitle, cta, href } = content[activeTab];

  return (
    <section className="relative overflow-hidden bg-[#0D0D0D] py-28">
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
        <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          {line1}
          <br />

          <span className="relative inline-block">
            <span className="relative inline-block">{line2}</span>
            <span className="relative inline-block w-2/3">
              {/* Yellow curved underline */}
              <svg
                className="absolute bottom-6 -left-[3%] w-[106%] h-[18px]"
                viewBox="0 0 311 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 5.5C80 1.5 230 1.5 309 5.5"
                  stroke="#ffcc00"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        </h2>

        <p className="mt-10 text-white/50 text-base max-w-md leading-relaxed">
          {subtitle}
        </p>

        <Link
          href={href}
          className="mt-8 bg-[#FFCC00] text-black hover:bg-[#e6b800] transition-all duration-200 px-8 py-3 rounded-lg font-semibold"
        >
          {cta}
        </Link>
      </div>

      {/* RepairCoin logo — bottom left (full nav-logo includes icon + wordmark) */}
      <div className="absolute bottom-6 left-8 z-10">
        <div className="relative w-[150px] h-[34px] opacity-75">
          <Image
            src="/img/nav-logo.png"
            alt="RepairCoin"
            fill
            className="object-contain object-left"
          />
        </div>
      </div>
    </section>
  );
};

export default RewardsCTA;
