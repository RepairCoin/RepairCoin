'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const CartIcon: React.FC = () => {
  const router = useRouter();

  const handleClick = () => {
    router.push('/shop?tab=purchase');
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="relative p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-all duration-300 lg:shadow-[0_2px_8px_4px_#101010]"
        aria-label="Purchase RCN"
      >
        <ShoppingCart className="w-6 h-6" />
      </button>
    </div>
  );
};
