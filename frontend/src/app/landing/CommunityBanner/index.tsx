'use client';

import Section from "@/components/Section";

interface CommunityBannerProps {
    communityBannerBgImage: string;
    bannerChainImage: string;
}

const CommunityBanner: React.FC<CommunityBannerProps> = ({ communityBannerBgImage, bannerChainImage }) => {
    return (
        <div
            className="w-full min-h-[70vh] py-6 md:py-8 px-4 flex items-center justify-center"
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
                                        src="/community-logo.png"
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
                                Join the Growing Community! <span className="text-[#FFCC00]">Earning</span> while repairing.
                            </p>

                            {/* CTA Button */}
                            <button className="bg-[#FFCC00] hover:bg-yellow-400 text-gray-900 font-semibold px-8 py-3 rounded-full transition-all duration-300 transform hover:scale-105 w-max">
                                Sign Up Now <span className='ml-2 text-sm md:text-lg'>→</span>
                            </button>
                        </div>

                        {/* Right Column - Placeholder for Image/Illustration */}
                        <div className="flex items-center justify-center">
                            <div className="relative w-full h-64 md:h-80 rounded-xl flex items-center justify-center">
                                <img src="/people.png" alt="Community Banner" />
                            </div>
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default CommunityBanner;
