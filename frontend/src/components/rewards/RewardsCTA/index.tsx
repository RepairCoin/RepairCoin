"use client";

import Link from "next/link";
import Image from "next/image";

const RewardsCTA = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div className="relative overflow-hidden rounded-3xl min-h-[300px]">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/img/community-chain.png')" }}
        />
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Content */}
        <div className="relative flex flex-col lg:flex-row items-center justify-between h-full">
          {/* Text content */}
          <div className="px-8 md:px-16 py-12 lg:max-w-[60%]">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to plug into RepairCoin rewards?
            </h2>
            <p className="text-base text-[#E8E8E8] mb-8 max-w-xl leading-relaxed">
              Whether you are a customer or a shop owner, your next repair or purchase could already
              be earning RCN. Create your account and see your tier in action inside the dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/choose?role=customer"
                className="bg-[#FFCC00] text-black px-8 py-3 rounded-lg font-medium hover:bg-[#e6b800] transition-colors inline-flex items-center justify-center"
              >
                Join as Customer →
              </Link>
              <Link
                href="/choose?role=shop"
                className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
              >
                Join as Shop Owner →
              </Link>
            </div>
          </div>

          {/* Persons image - visible on larger screens */}
          <div className="hidden lg:block absolute right-0 bottom-0 h-full w-[40%]">
            <Image
              src="/img/rewards-people-2.png"
              alt="Happy customers"
              fill
              className="object-contain object-right-bottom"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsCTA;
