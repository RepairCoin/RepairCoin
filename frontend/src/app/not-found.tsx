'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Section from '@/components/Section';

export default function NotFound() {
  const router = useRouter();

  return (
    <div 
      className="relative h-screen md:h-[70vh] xl:h-screen w-full bg-[#0D0D0D]"
      style={{ backgroundImage: `url(/tech-bg.png)` }}
    >
      <Section>
        <div className="w-full flex flex-col items-center gap-6">
          <div className="w-full flex flex-col items-center gap-20">
            {/* Header */}
            <div className="flex flex-col w-2/3 items-center md:gap-6 gap-4">
              <p className="md:text-5xl text-3xl text-center font-bold text-white tracking-wide">
                404 - Page Not Found
              </p>
              <p className="text-[#FFCC00] text-center text-sm md:text-lg tracking-wide">
                The page you are looking for does not exist or has been moved.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}