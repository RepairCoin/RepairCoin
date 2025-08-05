import { useEffect, useState } from 'react';
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
      
      setWalletType(result.type);
      setIsRegistered(result.isRegistered);
      setDetectionData(result.data);

      // Auto-route if enabled and wallet is registered
      if (autoRoute && result.isRegistered && result.route) {
        router.push(result.route);
      }
    } catch (error) {
      console.error('Wallet detection error:', error);
      setWalletType('unknown');
      setIsRegistered(false);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    detectWallet();
  }, [account?.address, autoRoute]);

  return {
    walletType,
    isDetecting,
    isRegistered,
    detectionData,
    refetch: detectWallet
  };
}