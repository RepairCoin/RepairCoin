'use client';

import React from 'react';
import Section from './Section';

interface HeroProps {
  backgroundImage?: string;
}

export const Hero: React.FC<HeroProps> = ({
  backgroundImage
}) => {
  return (
    <div
      className="relative flex h-screen w-full flex-col items-center justify-center bg-cover bg-[-90%] bg-no-repeat md:bg-center xl:bg-center"
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {}}
    >
      <Section>
        <div className='flex flex-col mb-36'>
          <div className='w-3/7 py-2 px-4'>
            <p className='text-[#FFCC00] text-lg mb-6'>THE REPAIR INDUSTRY ‘S LOYALTY TOKEN</p>
            <p className='text-5xl font-bold text-white mb-4'>Reward your Repairs with RepairCoin</p>
            <p className='text-white text-base mb-6'>
              Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequat duis enim velit mollit. Exercitation veniam consequat sunt nostrud amet.
            </p>
          </div>
          <div className='flex flex-row gap-6 pt-20'>
            <button className='bg-[#FFCC00] text-black py-4 px-6 rounded-full font-semibold text-lg text-center'>Get Started <span className='ml-2 text-base'>→</span></button>
            <button className='border border-white text-white py-4 px-6 rounded-full font-semibold text-lg text-center'>Find a Participating Repair Shop <span className='ml-2 text-base'>→</span></button>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default Hero;