'use client';

import React from 'react';
import Section from './Section';

interface HeroProps {
  backgroundImage: string;
  techBgImage: string;
  hero1BgImage: string;
}

export const Hero: React.FC<HeroProps> = ({ backgroundImage, techBgImage, hero1BgImage }) => {
  return (
    <div className="relative h-screen md:h-[70vh] xl:h-screen w-full bg-[#000000]">
      {/* Mobile View - Two Split Backgrounds */}
      <div className="md:hidden h-full w-full flex flex-col">
        {/* Top half background */}
        <div
          className="h-3/4 w-full"
          style={{
            backgroundImage: `url(${techBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />

        {/* Bottom half background */}
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `url(${hero1BgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      </div>

      {/* Desktop Background */}
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Content - Positioned at top with responsive padding */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-28 md:pt-48">
        <Section>
          <div className='flex w-full flex-col'>
            <div className='md:w-1/2'>
              <p className='text-[#FFCC00] text-sm md:text-sm xl:text-lg mb-6'>THE REPAIR INDUSTRY 'S LOYALTY TOKEN</p>
              <p className='text-2xl md:text-4xl xl:text-5xl font-bold text-white mb-6'>Reward your Repairs with RepairCoin</p>
              <p className='text-white text-xs md:text-sm xl:text-base mb-10'>
                Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequat duis enim velit mollit. Exercitation veniam consequat sunt nostrud amet.
              </p>
            </div>
            <div className='flex flex-row gap-6 pt-4'>
              <button className='bg-[#FFCC00] text-black py-2 xl:py-4 px-4 xl:px-6 rounded-full font-semibold text-sm md:text-base text-center'>
                Get Started <span className='ml-2 text-sm md:text-base xl:text-lg'>→</span>
              </button>
              <button className='hidden md:block border border-white text-white py-4 px-6 rounded-full font-semibold text-sm md:text-base text-center'>
                Find a Participating Repair Shop <span className='ml-2 text-sm md:text-base xl:text-lg'>→</span>
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default Hero;