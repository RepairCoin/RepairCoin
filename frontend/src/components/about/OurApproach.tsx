import Image from "next/image";
import SectionBadge from "./SectionBadge";

const approaches = [
  {
    icon: "/img/about/ourapprouch-icon1.png",
    title: "Service First",
    description: "Rewards should reflect great service, not coupons or flash sales.",
  },
  {
    icon: "/img/about/ourapprouch-icon2.png",
    title: "Transparent rewards",
    description: "Customers earn right after service is completed. No confusion and no fine print.",
  },
  {
    icon: "/img/about/ourapprouch-icon3.png",
    title: "Loyalty that compounds",
    description: "Every visit strengthens the relationship for both the customer and the business.",
  },
];

export default function OurApproach() {
  return (
    <section className="w-full bg-[#0D0D0D] px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <SectionBadge label="Our Approach" />
          <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Loyalty designed for how service<br className="hidden sm:block" /> businesses operate
          </h2>
          <p className="mt-4 max-w-3xl mx-auto text-gray-400 text-sm sm:text-base leading-relaxed">
            These principles guide how RepairCoin is built, prioritizing real service workflows,
            clarity for customers, and long-term relationships.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {approaches.map((item) => (
            <div
              key={item.title}
              className="rounded-[32px] border border-white/5 p-8 pt-10"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
              }}
            >
              <div className="w-14 h-14 rounded-full bg-[#ffcc00] flex items-center justify-center mb-8">
                <Image
                  src={item.icon}
                  alt={item.title}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
