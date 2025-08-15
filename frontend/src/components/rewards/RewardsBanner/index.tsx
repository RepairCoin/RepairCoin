"use client";

import Section from "@/components/Section";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

interface RewardsBannerProps {
  RewardsBannerBgImage: string;
  bannerChainImage: string;
  activeTab?: "shop" | "customer";
}

interface BannerData {
  header: string;
  subHeader: string;
  img: string;
}

const bannerShopData: BannerData = {
  header: "Boost loyalty. Grow revenue. Stand out.",
  subHeader:
    "Give RCN rewards for every service — from gadget and car repairs to tires, barbershops, and nail salons. Bring in new customers and keep them coming back.",
  img: "/img/rewards-people-2.png",
};

const bannerCustomerData: BannerData = {
  header: "Join the Growing Community!",
  subHeader:
    "From phone repairs to car service, tires, barbershops, and nail salons — every visit earns you RCN. Save more and enjoy exclusive perks at participating shops.",
  img: "/img/people.png",
};

const RewardsBanner: React.FC<RewardsBannerProps> = ({
  RewardsBannerBgImage,
  bannerChainImage,
  activeTab,
}) => {
  return (
    <div className="w-full bg-[#0D0D0D]">
      {/* Desktop/Tablet View - Hidden on mobile */}
      <div
        className="hidden md:block w-full h-full xl:h-[60vh] px-4 items-center justify-center"
        style={{ backgroundImage: `url(${RewardsBannerBgImage})` }}
      >
        <Section>
          <div
            className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden"
            style={{
              backgroundImage: `url(${bannerChainImage})`,
              backgroundSize: "cover",
              backgroundPosition: "right",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="grid grid-cols-3 gap-8">
              {/* Left Column - Content */}
              <div className="flex flex-col justify-center items-center">
                <div>
                  <img
                    src="/img/community-logo.png"
                    alt="RepairCoin Logo"
                    className="h-10 w-auto"
                  />
                </div>
                <span className="text-[#FFCC00] text-sm font-medium">
                  The Repair Industry's Loyalty Coin
                </span>
              </div>
              {/* Center Column - Content */}
              <div className="flex flex-col justify-between py-4">
                {/* Main Heading */}
                <p className="text-lg md:text-xl font-bold text-[#FFCC00] leading-tight mb-2">
                  {activeTab === "shop"
                    ? bannerShopData.header
                    : bannerCustomerData.header}
                </p>
                <p className="text-white text-sm md:text-base mb-6 tracking-wide">
                  {activeTab === "shop"
                    ? bannerShopData.subHeader
                    : bannerCustomerData.subHeader}
                </p>

                {/* CTA Button */}
                <div className="w-fit">
                  <ConnectButton
                    client={client}
                    connectModal={{
                      size: "compact",
                      title: "Connect to RepairCoin",
                    }}
                    connectButton={{
                      label: "Get Started",
                      style: {
                        minWidth: "150px",
                        backgroundColor: "#F7CC00",
                        color: "#111827",
                        fontWeight: "600",
                        borderRadius: "100px",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "0.75rem 2rem",
                        boxShadow:
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                      },
                    }}
                  />
                </div>
              </div>

              {/* Right Column - Placeholder for Image/Illustration */}
              <div className="relative flex items-end justify-end h-full">
                <img
                  src={
                    activeTab === "shop"
                      ? "/img/rewards-people-2.png"
                      : "/img/people.png"
                  }
                  alt="Community Banner"
                  className="w-auto h-full max-h-[400px] object-contain object-bottom"
                />
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Mobile View - Hidden on desktop/tablet */}
      <div className="md:hidden w-full h-[60vh] relative">
        <img
          src="/img/community-mobile-banner.png"
          alt="Join the RepairCoin Community"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-24 left-4 right-4 max-w-[150px]">
          <ConnectButton
            client={client}
            connectModal={{
              size: "compact",
              title: "Connect to RepairCoin",
            }}
            connectButton={{
              label: "Get Started",
              style: {
                width: "100%",
                backgroundColor: "#F7CC00",
                color: "#111827",
                fontWeight: "600",
                borderRadius: "100px",
                justifyContent: "center",
                alignItems: "center",
                padding: "1rem 1.5rem",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RewardsBanner;
