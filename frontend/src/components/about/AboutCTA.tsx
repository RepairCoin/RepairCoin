"use client";

import { m } from "framer-motion";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";

export default function AboutCTA() {
  return (
    <section className="relative w-full bg-[#0D0D0D] overflow-hidden">
      {/* Background particle wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-30"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "60%",
        }}
      />

      <div className="relative z-10 px-4 sm:px-6 lg:px-8">
        {/* CTA Section */}
        <div className="max-w-6xl mx-auto text-center pt-20 pb-20 lg:pt-28 lg:pb-28">
          <AnimateOnScroll>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white !leading-[1.3]">
              Join RepairCoin as an
              <br />
              <span className="relative inline-block">
                <span className="text-gold-gradient">early partner</span>
                {/* Yellow underline curve */}
                <svg
                  className="absolute -bottom-[25%] -left-[-4%] w-[92%] h-[18px]"
                  viewBox="0 0 311 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="none"
                >
                  <m.path
                    d="M2 5.5C80 1.5 230 1.5 309 5.5"
                    stroke="#ffcc00"
                    className="stroke-[2] sm:stroke-[3] md:stroke-[4]"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.8, delay: 0.6, ease: "easeOut", opacity: { duration: 0.01, delay: 0.6 } }}
                  />
                </svg>
              </span>
            </h2>
          </AnimateOnScroll>

          <AnimateOnScroll delay={0.3}>
            <p className="mt-10 mx-auto text-gray-400 text-base leading-relaxed whitespace-nowrap">
              Be among the first to launch, test, and grow with RepairCoin from day one.
            </p>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
