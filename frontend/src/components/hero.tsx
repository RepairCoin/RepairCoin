'use client';

import React from 'react';

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
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-black/30" />
    </div>
  );
};

export default Hero;