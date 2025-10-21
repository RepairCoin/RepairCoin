import { useEffect, useState, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useRouter } from 'next/navigation';
import { WalletDetectionService, WalletType } from '../services/walletDetectionService';

interface UseWalletDetectionResult {
  walletType: WalletType;
  isDetecting: boolean;
  isRegistered: boolean;
  detectionData?: any;
  refetch: () => Promise<void>;
}

export function useWalletDetection(autoRoute: boolean = false): UseWalletDetectionResult {
  const account = useActiveAccount();
  const router = useRouter();
  const [walletType, setWalletType] = useState<WalletType>('unknown');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
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
      const detector = WalletDetectionService.getInstance();
      const result = await detector.detectWalletType(account.address);
      
      console.log('🔍 [useWalletDetection] Detection result:', result);
      
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
    detectionData,
    refetch: detectWallet
  };
}