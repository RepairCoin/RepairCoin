"use client";

import React from "react";
import Image from "next/image";
import SectionBadge from "@/components/about/SectionBadge";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";

export default function WhatIsRepairCoin() {
  return (
    <section className="relative bg-[#191919] py-12 sm:py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Content */}
          <AnimateOnScroll>
            <div className="space-y-6">
              {/* Badge */}
              <SectionBadge label="A Smarter Loyalty System" />

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
                What is RepairCoin?
              </h2>

              <p className="text-[#F7CC00] text-lg font-medium">
                Get discovered, get booked, and keep customers coming back.
              </p>

              <div className="space-y-5 text-gray-300 leading-relaxed">
                <p>
                  RepairCoin is a platform for service businesses that combines{" "}
                  <strong className="text-white">marketplace discovery</strong>,{" "}
                  <strong className="text-white">bookings</strong>,{" "}
                  <strong className="text-white">operations</strong>, and{" "}
                  <strong className="text-white">loyalty rewards</strong> into one
                  easy-to-use system. Repair shops are the first launch category,
                  and soon, all service businesses can benefit.
                </p>
                <p>
                  Customers can find nearby services, book instantly, earn
                  fixed-value rewards (RCN), and redeem them at participating
                  businesses.
                </p>
                <p>
                  Businesses can manage appointments, staff, notifications,
                  subscriptions, and reward loyal customers to drive repeat visits.
                </p>
                <p>
                  RepairCoin is more than just a rewards program — it&apos;s a
                  complete system to grow your business, keep customers coming
                  back, and simplify daily operations.
                </p>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Right Content - RepairCoin Logo */}
          <AnimateOnScroll delay={0.2}>
            <div className="flex items-center justify-center">
              <div className="relative w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] lg:w-[420px] lg:h-[420px] animate-[gentleFloat_6s_ease-in-out_infinite]">
                <Image
                  src="/img/landingv2/RepaircoinLogo.png"
                  alt="RepairCoin"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
