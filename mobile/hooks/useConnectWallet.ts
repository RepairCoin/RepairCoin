import { checkUserByWalletAddress } from '../services/authServices';
import { useRouter } from 'expo-router';

const router = useRouter();

export const useConnectWallet = () => {
  const checkWalletConnection = async (address: string | null | undefined) => {
    if (!address) {
      console.log('[useConnectWallet] No wallet address connected');
      return;
    }
    
    try {
      const response = await checkUserByWalletAddress(address);
      
      if (response?.exists && response?.user) {
        if(response?.type === 'customer') {
          router.push("/dashboard/customer");
        }
      } else {
        console.log('[useConnectWallet] No user found for address:', address);
      }
    } catch (error: any) {
      if(error.response.status === 404) {
        router.push("/auth/register");
      }
      console.log('[useConnectWallet] Error checking user:', error);
    }
  };

  return {
    checkWalletConnection,
  };
};