import { useEffect, useState, useRef } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { useRouter } from 'next/navigation';
import { getUserEmail } from 'thirdweb/wallets/in-app';
import { client } from '@/utils/thirdweb';
import { WalletDetectionService, WalletType } from '../services/walletDetectionService';

interface UseWalletDetectionResult {
  walletType: WalletType;
  isDetecting: boolean;
  isRegistered: boolean;
  isRateLimited: boolean;
  rateLimitMessage?: string;
  detectionData?: any;
  refetch: () => Promise<void>;
}

export function useWalletDetection(autoRoute: boolean = false): UseWalletDetectionResult {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const router = useRouter();
  const [walletType, setWalletType] = useState<WalletType>('unknown');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | undefined>(undefined);
  const [detectionData, setDetectionData] = useState<any>(null);
  const previousAddressRef = useRef<string | undefined>(undefined);
  const hasCheckedRef = useRef(false);

  const detectWallet = async () => {
    if (!account?.address) {
      setWalletType('unknown');
      setIsRegistered(false);
      setDetectionData(null);
      return;
    }

    setIsDetecting(true);
    try {
      // Small delay to ensure Thirdweb has fully initialized the wallet
      // This allows getUserEmail to return the email for social login
      await new Promise(resolve => setTimeout(resolve, 500));

      const detector = WalletDetectionService.getInstance();

      // ALWAYS try to get email for social login fallback
      // This allows shops registered with MetaMask to login via Google if their email matches
      // getUserEmail returns undefined for non-embedded wallets, which is fine
      let userEmail: string | undefined;
      try {
        // Use Thirdweb v5's official getUserEmail function
        // Try this regardless of wallet type detection (wallet object might not be ready yet)
        userEmail = await getUserEmail({ client });

        if (userEmail) {
          console.log('🔍 [useWalletDetection] Found email for social login via getUserEmail:', userEmail);
        } else {
          // Fallback to localStorage for Thirdweb auth data
          const authData = localStorage.getItem('thirdweb:in-app-wallet-user-id');
          if (authData && authData.includes('@')) {
            userEmail = authData;
            console.log('🔍 [useWalletDetection] Found email from localStorage:', userEmail);
          }
        }
      } catch (e) {
        // This is expected for non-embedded wallets, just continue without email
        console.log('🔍 [useWalletDetection] No email available (expected for external wallets)');
      }

      const result = await detector.detectWalletType(account.address, userEmail);

      console.log('🔍 [useWalletDetection] Detection result:', result);

      // Check for rate limiting
      if (result.route === '/rate-limited') {
        console.warn('⚠️ [useWalletDetection] Rate limited!');
        setIsRateLimited(true);
        setRateLimitMessage(result.data?.message || 'Too many requests. Please wait a few minutes and try again.');
        setWalletType('unknown');
        setIsRegistered(false);
        setDetectionData(null);
        return;
      }

      // Clear rate limit state on successful detection
      setIsRateLimited(false);
      setRateLimitMessage(undefined);

      setWalletType(result.type);
      setIsRegistered(result.isRegistered);
      setDetectionData(result.data);

      // Auto-route if enabled and wallet is registered
      if (autoRoute && result.isRegistered && result.route) {
        console.log('🔄 [useWalletDetection] Auto-routing to:', result.route);
        router.push(result.route);
      }
    } catch (error) {
      console.error('❌ [useWalletDetection] Wallet detection error:', error);
      setWalletType('unknown');
      setIsRegistered(false);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    if (account?.address) {
      // Only detect on actual address change, not on first render
      const isAddressChange = 
        previousAddressRef.current !== undefined && 
        previousAddressRef.current !== account.address;
      
      // Initialize ref on first render without detecting
      if (previousAddressRef.current === undefined) {
        console.log('🔷 [useWalletDetection] First render with address:', account.address);
        previousAddressRef.current = account.address;
        // Still detect on first render to populate state, but won't auto-route
        detectWallet();
        return;
      }

      if (isAddressChange) {
        console.log('🔄 [useWalletDetection] Address changed from', previousAddressRef.current, 'to', account.address);
        hasCheckedRef.current = false;
        detectWallet();
      }
      
      previousAddressRef.current = account.address;
    } else if (!account?.address && previousAddressRef.current) {
      console.log('🔌 [useWalletDetection] Wallet disconnected');
      previousAddressRef.current = undefined;
      hasCheckedRef.current = false;
      setWalletType('unknown');
      setIsRegistered(false);
      setDetectionData(null);
    }
  }, [account?.address, autoRoute]);

  return {
    walletType,
    isDetecting,
    isRegistered,
    isRateLimited,
    rateLimitMessage,
    detectionData,
    refetch: detectWallet
  };
}