'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet } from "thirdweb/react";
import { client } from '@/utils/thirdweb';
import { useAuthMethod } from '@/contexts/AuthMethodContext';
import { createWallet, inAppWallet } from "thirdweb/wallets";

interface DualAuthConnectProps {
  onConnect?: (address: string, authMethod: string) => void;
  onError?: (error: Error) => void;
}

export function DualAuthConnect({ onConnect, onError }: DualAuthConnectProps) {
  const [authMethod, setAuthMethod] = useState<'wallet' | 'email'>('email');
  const { setAuthMethod: setGlobalAuthMethod } = useAuthMethod();
  const account = useActiveAccount();
  const wallet = useActiveWallet();

  // Handle connection success
  useEffect(() => {
    if (account && wallet && onConnect) {
      // Determine the actual authentication method and wallet type
      let detectedMethod: 'wallet' | 'email' | 'google' | 'apple' = 'wallet';
      let walletType: 'embedded' | 'external' = 'external';

      console.log('Wallet info:', {
        id: wallet.id,
        wallet: wallet,
        account: account.address
      });

      // Check if it's an in-app wallet
      // Thirdweb v5 uses 'inApp' as the wallet ID for embedded wallets
      if (wallet.id === 'inApp' || wallet.id === 'embedded' || wallet.id.includes('inApp')) {
        walletType = 'embedded';
        
        // For embedded wallets, we need to check how the user authenticated
        // In Thirdweb v5, the auth method info might be in the wallet's internal state
        const walletInfo = (wallet as any);
        console.log('Embedded wallet info:', walletInfo);
        
        // Check if wallet has any auth info
        if (walletInfo.authMode || walletInfo.authMethod) {
          const authMode = walletInfo.authMode || walletInfo.authMethod;
          if (authMode.includes('google')) {
            detectedMethod = 'google';
          } else if (authMode.includes('apple')) {
            detectedMethod = 'apple';
          } else if (authMode.includes('email')) {
            detectedMethod = 'email';
          }
        } else {
          // Default to email if we're in the email tab and using embedded wallet
          detectedMethod = 'email';
        }
        
        // Also check localStorage for any stored auth info
        try {
          // Check multiple possible storage keys
          const possibleKeys = [
            'thirdweb:active-wallet-id',
            'thirdweb:auth-method',
            'thirdweb:in-app-wallet-auth'
          ];
          
          for (const key of possibleKeys) {
            const data = localStorage.getItem(key);
            if (data) {
              console.log(`Found auth data in ${key}:`, data);
              if (data.includes('google')) {
                detectedMethod = 'google';
                break;
              } else if (data.includes('apple')) {
                detectedMethod = 'apple';
                break;
              }
            }
          }
        } catch (e) {
          console.log('Could not read auth data:', e);
        }
      } else {
        // External wallet - check the wallet ID to determine the type
        walletType = 'external';
        detectedMethod = 'wallet';
        
        // Log the wallet ID for debugging
        console.log('External wallet detected:', wallet.id);
      }

      console.log('Final detection:', { detectedMethod, walletType });
      setGlobalAuthMethod(detectedMethod, walletType);
      onConnect(account.address, detectedMethod);
    }
  }, [account, wallet, authMethod, onConnect, setGlobalAuthMethod]);

  // Configure wallets based on selected method
  const wallets = authMethod === 'email' 
    ? [
        inAppWallet({
          auth: {
            options: ["email", "google", "apple"],
          }
        })
      ]
    : [
        createWallet("io.metamask"),
        createWallet("com.coinbase.wallet"),
        createWallet("walletConnect"),
      ];

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tab Selection */}
      <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
        <button
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            authMethod === 'email'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setAuthMethod('email')}
        >
          📧 Email (Recommended)
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            authMethod === 'wallet'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setAuthMethod('wallet')}
        >
          🦊 Crypto Wallet
        </button>
      </div>

      {/* Connect Button */}
      <div className="space-y-4 w-full">
        {!account ? (
          <ConnectButton
            client={client}
            wallets={wallets}
            connectButton={{
              label: authMethod === 'email' ? "Continue with Email" : "Connect Wallet",
              className: "!bg-[#F7CC00] hover:!bg-[#E5BB00] !text-gray-900 !justify-center !w-full !font-semibold !px-8 !py-3 !rounded-full !inline-flex !items-center !gap-3 !transition-all !duration-200 !shadow-lg hover:!shadow-xl !border-none",
              style: {
                backgroundColor: "#F7CC00",
                color: "#111827",
                borderRadius: "9999px",
                fontWeight: "600",
                width: "100%",
                justifyContent: "center",
                padding: "0.75rem 2rem",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
              }
            }}
            connectModal={{
              size: "compact",
              title: authMethod === 'email' ? "Sign in with Email" : "Connect Your Wallet",
              showThirdwebBranding: false,
            }}
          />
        ) : (
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-green-800 font-medium">Connected!</p>
            <p className="text-sm text-green-600 mt-1">{account.address}</p>
          </div>
        )}
      </div>
    </div>
  );
}