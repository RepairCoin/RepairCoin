"use client";

import Section from "@/components/Section";

interface RewardYourCustomerProps {
  techBgImage: string;
}

interface TierData {
  name: string;
  level: string;
  requirement: string;
  features: string[];
  featuresPrefix: string;
  gradient: string;
  textColor: string;
  subtitleColor: string;
  prefixColor: string;
}

const tierData: TierData[] = [
  {
    name: "Bronze Tier",
    level: "Welcome Rewards",
    requirement: "0-199 Lifetime RCN",
    featuresPrefix: "Your Benefits:",
    features: [
      "Earn 10-25 RCN per repair service",
      "+10 RCN automatic bonus on every transaction",
      "$1 redemption value at your home shop",
      "20% balance usable at partner shops",
      "Instant mobile wallet activation",
      "Real-time transaction notifications",
    ],
    gradient: "bg-[#CE8946]",
    textColor: "text-white",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
  {
    name: "Silver Tier",
    level: "Loyalty Champion",
    requirement: "200-999 Lifetime RCN",
    featuresPrefix: "All Bronze benefits, plus:",
    features: [
      "+20 RCN automatic bonus per repair",
      "Priority service booking at shops",
      "Exclusive seasonal promotions (2x rewards)",
      "Birthday month: 50 RCN bonus gift",
      "Referral rewards: 25 RCN per success",
      "Monthly prize draws for free services",
    ],
    gradient: "bg-[#E2E8F0]",
    textColor: "text-gray-900",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
  {
    name: "Gold Tier",
    level: "VIP Elite Status",
    requirement: "1,000+ Lifetime RCN",
    featuresPrefix: "All Silver benefits, plus:",
    features: [
      "+30 RCN automatic bonus per repair",
      "Free annual device health check ($50 value)",
      "VIP customer support hotline",
      "Exclusive partner discounts (10-20% off)",
      "Quarterly bonus rewards (100 RCN)",
      "Extended warranty options at partner shops",
      "Early access to new shop locations",
    ],
    gradient: "bg-[#FFD700]",
    textColor: "text-gray-900",
    subtitleColor: "text-gray-800",
    prefixColor: "text-black",
  },
];

const CheckIcon = () => (
  <svg
    className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-gray-800"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

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
              <div className="flex flex-col w-2/3 items-center md:gap-6 gap-4">
                <p className="md:text-5xl text-3xl text-center font-bold text-white tracking-wide">
                  Loyalty Tier for our Friends
                </p>
                <p className="text-[#FFCC00] text-center text-sm md:text-lg tracking-wide">
                  Every time you repair a device, you earn RepairCoin and unlock
                  collectible coins that mark your loyalty tier. These coins
                  symbolize your status and unlock real-world perks at partner
                  shops.
                </p>
              </div>

              {/* Rewards Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mx-auto">
                {tierData.map((tier) => (
                  <div
                    key={tier.name}
                    className="w-full flex flex-col items-center rounded-2xl"
                  >
                    <div
                      className={`${tier.gradient} w-full flex flex-col items-center rounded-t-2xl p-2`}
                    />
                    <div
                      className={`bg-white p-8 h-full ${tier.textColor} w-full rounded-b-2xl`}
                    >
                      <div className="mb-6">
                        <h3 className="text-2xl text-black font-bold mb-1">
                          {tier.name}
                        </h3>
                        <p className={`${tier.subtitleColor} text-sm`}>
                          {tier.level}
                        </p>
                      </div>

                      <div className="mb-6">
                        <p className="text-xl text-black font-semibold">
                          {tier.requirement}
                        </p>
                      </div>

                      <div>
                        <p className={`text-base mb-4 ${tier.prefixColor}`}>
                          {tier.featuresPrefix}
                        </p>
                        <ul className="space-y-3">
                          {tier.features.map((feature, index) => (
                            <li key={index} className="flex items-start">
                              <CheckIcon />
                              <span className="text-sm text-gray-900">
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default RewardYourCustomer;
