'use client';

import React from 'react';
import Section from './Section';

interface HeroProps {
    backgroundImage: string;
}

export const Hero: React.FC<HeroProps> = ({ backgroundImage }) => {
  return (
    <div className="relative h-screen w-full">
      {/* Mobile View - Two Split Backgrounds */}
      <div className="md:hidden h-full w-full flex flex-col">
        {/* Top half background */}
        <div 
          className="h-3/5 w-full"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1605000797499-95a51c5269ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        
        {/* Bottom half background */}
        <div 
          className="h-2/4 w-full"
          style={{
            backgroundImage: `url(${backgroundImage})`,
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
      
      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Section>
          <div className='flex flex-col mb-60 md:mb-36 p-4'>
            <div className='md:w-3/7'>
              <p className='text-[#FFCC00] text-sm md:text-lg mb-6'>THE REPAIR INDUSTRY 'S LOYALTY TOKEN</p>
              <p className='md:text-5xl text-3xl font-bold text-white mb-4'>Reward your Repairs with RepairCoin</p>
              <p className='text-white text-xs md:text-base mb-6'>
                Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequat duis enim velit mollit. Exercitation veniam consequat sunt nostrud amet.
              </p>
            </div>
            <div className='flex flex-row gap-6 pt-20'>
              <button className='bg-[#FFCC00] text-black py-2 md:py-4 px-4 md:px-6 rounded-full font-semibold text-lg text-center'>
                Get Started <span className='ml-2 text-base'>→</span>
              </button>
              <button className='hidden md:block border border-white text-white py-4 px-6 rounded-full font-semibold text-lg text-center'>
                Find a Participating Repair Shop <span className='ml-2 text-base'>→</span>
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default Hero;