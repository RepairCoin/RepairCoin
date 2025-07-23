'use client';

import Section from "@/components/Section";

interface HowRepairCoinWorksProps {
    techBgImage: string;
}

const HowRepairCoinWorks: React.FC<HowRepairCoinWorksProps> = ({techBgImage}) => {
    return (
        <div 
            className="relative py-16 md:py-24 lg:py-32 overflow-hidden"
        >
            {/* Background pattern */}
            <div 
                className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: `url(${techBgImage})`,
                    backgroundSize: '60px 60px'
                }}
            />
            
            <Section>
                <div className="relative z-10 w-full">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                            How RepairCoin Works
                        </h2>
                        <div className="w-20 h-1 bg-[#FFCC00] mx-auto my-6"></div>
                        <p className="text-gray-300 text-lg max-w-3xl mx-auto">
                            A simple and transparent way to earn rewards for your repair purchases
                        </p>
                    </div>

                    <div className="relative">
                        {/* Dotted wave pattern overlay */}
                        <div className="absolute inset-0 opacity-10" style={{
                            backgroundImage: 'radial-gradient(#FFCC00 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
                            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)'
                        }}></div>
                        
                        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 lg:gap-8">
                            {/* Step 1: Repair */}
                            <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 md:p-6 lg:p-8 border border-gray-800/50 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10">
                                <div className="flex flex-col items-center text-center h-full">
                                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-yellow-500 font-bold text-xl mb-3">Repair</h3>
                                    <p className="text-gray-300 mb-4">
                                        Visit a participating repair shop for your phone, device, or avail any repair services.
                                    </p>
                                </div>
                            </div>

                            {/* Arrow - Hidden on mobile, shown on md and up */}
                            <div className="hidden md:flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>

                            {/* Step 2: Earn */}
                            <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 md:p-6 lg:p-8 border border-gray-800/50 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10">
                                <div className="flex flex-col items-center text-center h-full">
                                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a2 2 0 100-4 2 2 0 000 4z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-yellow-500 font-bold text-xl mb-3">Earn</h3>
                                    <p className="text-gray-300 mb-4">
                                        Receive RepairCoin as a reward for every repair.
                                    </p>
                                </div>
                            </div>

                            {/* Arrow - Hidden on mobile, shown on md and up */}
                            <div className="hidden md:flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>

                            {/* Step 3: Redeem */}
                            <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 md:p-6 lg:p-8 border border-gray-800/50 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10">
                                <div className="flex flex-col items-center text-center h-full">
                                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-yellow-500 font-bold text-xl mb-3">Redeem</h3>
                                    <p className="text-gray-300">
                                        Receive exciting rewards from our system. Trade other currencies from the market.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default HowRepairCoinWorks;