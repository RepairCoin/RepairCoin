"use client";

import Section from "@/components/Section";

interface RewardYourCustomerProps {
  techBgImage: string;
}

const tiers = [
  {
    name: "Bronze Partner",
    subtitle: "Just sign up & start rewarding",
    color: "from-amber-600 to-amber-700",
    bgColor: "bg-gradient-to-b from-[#CE8946] to-[#543700]",
    buttonColor: "bg-amber-600 hover:bg-amber-700",
    perks: [
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
    ],
    character: "/pr1.png", // You'll need to add this image
  },
  {
    name: "Silver Partner",
    subtitle: "20+ Customer Redemptions",
    color: "from-gray-400 to-gray-500",
    bgColor: "bg-gradient-to-b from-[#D9D9D9] to-[#E2E8F0]",
    buttonColor: "bg-gray-600 hover:bg-gray-700",
    featured: true,
    perks: [
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
    ],
    character: "/pr2.png", // You'll need to add this image
  },
  {
    name: "Gold Partner",
    subtitle: "50+ Customer Redemptions",
    color: "from-yellow-500 to-yellow-600",
    bgColor: "bg-gradient-to-b from-[#EFBF04] to-[#FFD700]",
    buttonColor: "bg-yellow-600 hover:bg-yellow-700",
    perks: [
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
    ],
    character: "/pr3.png", // You'll need to add this image
  },
];

const RewardYourCustomer: React.FC<RewardYourCustomerProps> = ({
  techBgImage,
}) => {
  return (
    <div
      className="w-full pt-10 bg-[#0D0D0D]"
      style={{ backgroundImage: `url(${techBgImage})` }}
    >
      <Section>
        <div className="w-full flex flex-col justify-between items-center py-8 xl:py-20 gap-34">
          <div className="w-full flex flex-col items-center gap-6">
            <div className="w-full flex flex-col justify-center items-center gap-20">
              {/* Header */}
              <div className="flex flex-col w-1/2 items-center md:gap-6 gap-4">
                <p className="text-[#FFCC00] text-sm md:text-lg tracking-wide">
                  Partner with RepairCoin. Power Up Your Shop.
                </p>
                <p className="md:text-5xl text-3xl text-center font-bold text-white tracking-wide">
                  Reward your customers. Grow your business.
                </p>
                <p className="text-white text-xs md:text-base mb-6 text-center tracking-wide">
                  With RepairCoin, your shop stands out, earns loyalty, and
                  joins a growing network of future-ready service providers.
                </p>
              </div>

              {/* Pricing Cards */}
              <div className="w-full max-w-[1200px] flex flex-col justify-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                  {tiers.map((tier, index) => (
                    <div
                      key={tier.name}
                      className={`relative rounded-2xl p-8 ${tier.bgColor} shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${
                        tier.featured ? "md:scale-105" : ""
                      }`}
                    >
                      {/* Card Header */}
                      <div className="text-start mb-6">
                        <h3 className={`text-2xl font-bold text-black mb-2`}>
                          {tier.name}
                        </h3>
                        <p className="text-sm text-gray-800">{tier.subtitle}</p>
                      </div>

                      {/* Perks Section */}
                      <div className="mb-8">
                        <h4 className="font-semibold text-gray-900 mb-4">
                          Perks
                        </h4>
                        <ul className="space-y-3">
                          {tier.perks.map((perk, perkIndex) => (
                            <li key={perkIndex} className="flex items-start">
                              <svg
                                className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-gray-800`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="text-gray-900 text-sm">
                                {perk}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Character Image */}
                      <div className="relative h-48 mb-6">
                        <div className="absolute inset-0 flex items-center justify-center">
                          {/* Placeholder for character image */}
                          <div className="pb-4">
                            <img src={tier.character} alt="" />
                          </div>
                        </div>
                      </div>

                      {/* CTA Button */}
                      {/* <button
                        className={`w-full py-4 px-6 rounded-xl font-semibold text-white ${tier.buttonColor} transition-colors duration-200 transform hover:scale-105`}
                      >
                        Get Started →
                      </button> */}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default RewardYourCustomer;
