"use client";

import Section from "@/components/Section";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

interface CommunityBannerProps {
  communityBannerBgImage: string;
  bannerChainImage: string;
}

const CommunityBanner: React.FC<CommunityBannerProps> = ({
  communityBannerBgImage,
  bannerChainImage,
}) => {
  return (
    <div className="w-full bg-[#0D0D0D]">
      {/* Desktop/Tablet View - Hidden on mobile */}
      <div
        className="hidden md:block w-full h-full xl:h-[60vh] px-4 items-center justify-center"
        style={{ backgroundImage: `url(${communityBannerBgImage})` }}
      >
        <Section>
          <div
            className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden"
            style={{ backgroundImage: `url(${bannerChainImage})` }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8 pt-12">
              {/* Left Column - Content */}
              <div className="flex flex-col justify-between pb-12">
                {/* Logo and Tagline */}
                <div className="flex flex-col space-x-3 mb-8">
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

                {/* Main Heading */}
                <p className="text-xl md:text-3xl font-bold text-white leading-tight">
                  Join the Growing Community!{" "}
                  <span className="text-[#FFCC00]">Earning</span> while
                  repairing.
                </p>

                {/* CTA Button */}
                <ConnectButton
                  client={client}
                  connectModal={{
                    size: "compact",
                    title: "Connect to RepairCoin",
                  }}
                  connectButton={{
                    label: "Get Started",
                    style: {
                      width: "100px",
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

              {/* Right Column - Placeholder for Image/Illustration */}
              <div className="flex items-center justify-center">
                <div className="relative w-full h-64 md:h-80 rounded-xl flex items-center justify-center">
                  <img src="/img/people.png" alt="Community Banner" />
                </div>
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
        <div className="absolute bottom-24 left-4">
          <ConnectButton
            client={client}
            connectModal={{
              size: "compact",
              title: "Connect to RepairCoin",
            }}
            connectButton={{
              label: "Get Started",
              style: {
                width: "100px",
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
    </div>
  );
};

export default CommunityBanner;
