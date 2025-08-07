'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount, ConnectButton } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { useWalletDetection } from '../../hooks/useWalletDetection';
import Section from '../Section';

interface WalletAwareHeroProps {
  backgroundImage: string;
  techBgImage: string;
  hero1BgImage: string;
}

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export const WalletAwareHero: React.FC<WalletAwareHeroProps> = ({ 
  backgroundImage, 
  techBgImage, 
  hero1BgImage 
}) => {
  const router = useRouter();
  const account = useActiveAccount();
  const { walletType, isRegistered, isDetecting } = useWalletDetection();

  // Auto-route registered users
  useEffect(() => {
    if (account && !isDetecting && isRegistered) {
      console.log('Auto-routing user:', { walletType, isRegistered });
      
      switch (walletType) {
        case 'admin':
          router.push('/admin');
          break;
        case 'shop':
          router.push('/shop');
          break;
        case 'customer':
          router.push('/customer');
          break;
      }
    }
  }, [account, walletType, isRegistered, isDetecting, router]);

  const handleGetStarted = () => {
    if (!account) {
      // If no wallet connected, the ConnectButton will handle it
      return;
    }

    if (isRegistered) {
      // Already registered, route to appropriate dashboard
      switch (walletType) {
        case 'admin':
          router.push('/admin');
          break;
        case 'shop':
          router.push('/shop');
          break;
        case 'customer':
          router.push('/customer');
          break;
      }
    } else {
      // New wallet, go to choose page
      router.push('/choose');
    }
  };

  return (
    <div className="relative h-screen md:h-[70vh] xl:h-screen w-full bg-[#0D0D0D]">
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
              <p className='text-[#FFCC00] text-sm md:text-sm xl:text-lg mb-6'>
                THE REPAIR INDUSTRY'S LOYALTY TOKEN
              </p>
              <p className='text-2xl md:text-4xl xl:text-5xl font-bold text-white mb-6'>
                Reward your Repairs with RepairCoin
              </p>
              <p className='text-white text-xs md:text-sm xl:text-base mb-10'>
                Join the revolution in device repair loyalty. Earn RCN tokens for every repair, 
                enjoy tier-based bonuses, and redeem across our network of participating shops.
              </p>
            </div>
            
            <div className='flex flex-row gap-6 pt-4 items-center'>
              {account ? (
                <>
                  <button 
                    onClick={handleGetStarted}
                    disabled={isDetecting}
                    className='bg-[#FFCC00] text-black py-2 xl:py-4 px-4 xl:px-6 rounded-full font-semibold text-sm md:text-base text-center disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {isDetecting ? (
                      <>Detecting Wallet...</>
                    ) : isRegistered ? (
                      <>Go to Dashboard <span className='ml-2 text-sm md:text-base xl:text-lg'>→</span></>
                    ) : (
                      <>Get Started <span className='ml-2 text-sm md:text-base xl:text-lg'>→</span></>
                    )}
                  </button>
                  
                  {isRegistered && (
                    <p className='text-white text-sm'>
                      Registered as: <span className='text-[#FFCC00] font-semibold'>
                        {walletType === 'admin' ? 'Administrator' : 
                         walletType === 'shop' ? 'Repair Shop' : 
                         walletType === 'customer' ? 'Customer' : 'Unknown'}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <ConnectButton 
                  client={client}
                  connectModal={{
                    size: "compact",
                    title: "Connect to RepairCoin"
                  }}
                  connectButton={{
                    label: "Connect Wallet to Get Started",
                      style: {
                        backgroundColor: "#F7CC00",
                        color: "#111827",
                        fontWeight: "600",
                        borderRadius: "10px",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "0.75rem 2rem",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                      }                  }}
                />
              )}
            </div>
            
            {/* Status Messages */}
            {account && !isDetecting && !isRegistered && (
              <div className='mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg w-1/3'>
                <p className='text-blue-200 text-sm'>
                  <span className='font-semibold'>New wallet detected!</span> Click "Get Started" to choose how you want to participate in RepairCoin.
                </p>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
};

export default WalletAwareHero;