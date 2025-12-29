'use client';

import { useState, useEffect, useRef } from 'react';
import { ConnectButton, useActiveAccount, useActiveWallet } from "thirdweb/react";
import { useRouter } from 'next/navigation';
import { client } from '@/utils/thirdweb';
import { useAuthMethod } from '@/contexts/AuthMethodContext';
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { getUserEmail } from "thirdweb/wallets/in-app";
import { WalletDetectionService } from '@/services/walletDetectionService';

interface DualAuthConnectProps {
  onConnect?: (address: string, authMethod: string) => void;
  onError?: (error: Error) => void;
}

export function DualAuthConnect({ onConnect, onError }: DualAuthConnectProps) {
  const [authMethod, setAuthMethod] = useState<'wallet' | 'email'>('email');
  const { setAuthMethod: setGlobalAuthMethod } = useAuthMethod();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const router = useRouter();
  const previousAccountRef = useRef<string | undefined>(undefined);
  const hasCheckedRef = useRef(false);
  const signInInitiatedRef = useRef(true); // DualAuthConnect is ONLY shown for sign-in

  // Handle connection success
  useEffect(() => {
    if (account && wallet) {
      // Determine the actual authentication method and wallet type
      let detectedMethod: 'wallet' | 'email' | 'google' | 'apple' = 'wallet';
      let walletType: 'embedded' | 'external' = 'external';

      console.log('🟩 [DualAuthConnect] Wallet info:', {
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
        console.log('🟩 [DualAuthConnect] Embedded wallet info:', walletInfo);
        
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
              console.log(`🟩 [DualAuthConnect] Found auth data in ${key}:`, data);
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
          console.log('🟩 [DualAuthConnect] Could not read auth data:', e);
        }
      } else {
        // External wallet - check the wallet ID to determine the type
        walletType = 'external';
        detectedMethod = 'wallet';
        
        // Log the wallet ID for debugging
        console.log('🟩 [DualAuthConnect] External wallet detected:', wallet.id);
      }

      console.log('🟩 [DualAuthConnect] Final detection:', { detectedMethod, walletType });
      setGlobalAuthMethod(detectedMethod, walletType);
      
      // Call onConnect callback if provided
      if (onConnect) {
        onConnect(account.address, detectedMethod);
      }

      console.log('🟩 [DualAuthConnect] Checking connection', {
        currentAddress: account.address,
        previousRef: previousAccountRef.current,
        signInInitiated: signInInitiatedRef.current,
        hasChecked: hasCheckedRef.current
      });

      // Since DualAuthConnect is ONLY used for sign-in, any connection here is a new sign-in
      const isNewSignIn = signInInitiatedRef.current && previousAccountRef.current !== account.address;
      
      console.log('🟩 [DualAuthConnect] Connection analysis', {
        isNewSignIn,
        currentAddress: account.address,
        previousAddress: previousAccountRef.current
      });

      if (isNewSignIn && !hasCheckedRef.current) {
        console.log('🟩 [DualAuthConnect] ✅ NEW SIGN-IN detected - checking registration');

        // Mark as checked to prevent duplicate checks
        hasCheckedRef.current = true;
        signInInitiatedRef.current = false; // Reset the flag

        // Check wallet registration status and redirect if needed
        const checkAndRedirect = async () => {
          try {
            // Small delay to ensure Thirdweb has fully initialized the wallet
            // This allows getUserEmail to return the email for social login
            await new Promise(resolve => setTimeout(resolve, 500));

            const detector = WalletDetectionService.getInstance();

            // ALWAYS try to get email for social login fallback
            // This allows MetaMask-registered shops to also login via Google
            let userEmail: string | undefined;
            try {
              // Use Thirdweb v5's official getUserEmail function
              // Try this regardless of detected wallet type
              userEmail = await getUserEmail({ client });

              if (userEmail) {
                console.log('🟩 [DualAuthConnect] Found email for social login via getUserEmail:', userEmail);
              } else {
                // Fallback to localStorage for Thirdweb auth data
                const authData = localStorage.getItem('thirdweb:in-app-wallet-user-id');
                if (authData && authData.includes('@')) {
                  userEmail = authData;
                  console.log('🟩 [DualAuthConnect] Found email from localStorage:', userEmail);
                }
              }
            } catch (e) {
              // This is expected for non-embedded wallets, just continue without email
              console.log('🟩 [DualAuthConnect] No email available (expected for external wallets)');
            }

            const result = await detector.detectWalletType(account.address, userEmail);

            console.log('🟩 [DualAuthConnect] Detection result:', result);

            if (!result.isRegistered) {
              console.log('🟩 [DualAuthConnect] 🔄 New user detected, redirecting to /choose...');
              setTimeout(() => {
                router.push('/choose');
              }, 100);
            } else {
              console.log('🟩 [DualAuthConnect] ✅ Registered user, authenticating...');

              // IMPORTANT: Create session before redirecting
              // Pass email for social login fallback (shop registered with MetaMask, logging in with Google)
              try {
                const { authApi } = await import('@/services/api/auth');
                const { useAuthStore } = await import('@/stores/authStore');

                if (result.type === 'shop') {
                  const authResult = await authApi.authenticateShop(account.address, userEmail);
                  console.log('🟩 [DualAuthConnect] Shop session created:', authResult);

                  // Update authStore with user profile from authentication response
                  if (authResult && authResult.user) {
                    const userData = authResult.user as any;
                    useAuthStore.getState().setUserProfile({
                      id: userData.id || userData.shopId || account.address,
                      address: userData.walletAddress || userData.address || account.address,
                      type: 'shop',
                      name: userData.name,
                      email: userData.email,
                      isActive: userData.active,
                      shopId: userData.shopId,
                      registrationDate: userData.createdAt,
                    });
                    console.log('🟩 [DualAuthConnect] Auth store updated with shop profile, shopId:', userData.shopId);
                  }
                } else if (result.type === 'customer') {
                  const authResult = await authApi.authenticateCustomer(account.address);
                  console.log('🟩 [DualAuthConnect] Customer session created');

                  // Update authStore with user profile
                  if (authResult && authResult.user) {
                    const userData = authResult.user as any;
                    // Convert tier to lowercase to match UserProfile type
                    const tierLower = userData.tier?.toLowerCase() as 'bronze' | 'silver' | 'gold' | undefined;
                    useAuthStore.getState().setUserProfile({
                      id: userData.id || account.address,
                      address: userData.address || account.address,
                      type: 'customer',
                      name: userData.name,
                      email: userData.email,
                      isActive: userData.active,
                      tier: tierLower,
                      registrationDate: userData.createdAt,
                    });
                    console.log('🟩 [DualAuthConnect] Auth store updated with customer profile');
                  }
                } else if (result.type === 'admin') {
                  const authResult = await authApi.authenticateAdmin(account.address);
                  console.log('🟩 [DualAuthConnect] Admin session created');

                  // Update authStore with user profile
                  if (authResult && authResult.user) {
                    const userData = authResult.user as any;
                    useAuthStore.getState().setUserProfile({
                      id: userData.id || account.address,
                      address: userData.address || account.address,
                      type: 'admin',
                      name: userData.name,
                      email: userData.email,
                      isActive: userData.active,
                      registrationDate: userData.createdAt,
                    });
                    console.log('🟩 [DualAuthConnect] Auth store updated with admin profile');
                  }
                }
              } catch (authError) {
                console.error('🟩 [DualAuthConnect] Failed to create session:', authError);
                // Still try to redirect - they might already have a valid session
              }

              console.log('🟩 [DualAuthConnect] Redirecting to dashboard...');
              setTimeout(() => {
                router.push(result.route);
              }, 100);
            }
          } catch (error) {
            console.error('🟩 [DualAuthConnect] ❌ Error detecting wallet:', error);
          }
        };

        checkAndRedirect();
      } else if (previousAccountRef.current !== account.address) {
        console.log('🟩 [DualAuthConnect] Address changed but sign-in not initiated (unlikely in DualAuthConnect)');
      }
      
      // Update tracked address
      previousAccountRef.current = account.address;
      
    } else if (!account && previousAccountRef.current) {
      // Reset everything when wallet disconnects
      console.log('🟩 [DualAuthConnect] Wallet disconnected - resetting all refs');
      previousAccountRef.current = undefined;
      hasCheckedRef.current = false;
      signInInitiatedRef.current = true; // Reset to true since component is for sign-in
    }
  }, [account, wallet, authMethod, onConnect, setGlobalAuthMethod, router]);

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