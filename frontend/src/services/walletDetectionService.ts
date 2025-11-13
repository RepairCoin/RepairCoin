// Wallet Detection Service
// Detects wallet type and returns appropriate routing

export type WalletType = 'customer' | 'shop' | 'admin' | 'unknown';

interface WalletDetectionResult {
  type: WalletType;
  isRegistered: boolean;
  route: string;
  data?: any;
}

export class WalletDetectionService {
  private static instance: WalletDetectionService;
  private apiUrl: string;

  private constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  }

  static getInstance(): WalletDetectionService {
    if (!WalletDetectionService.instance) {
      WalletDetectionService.instance = new WalletDetectionService();
    }
    return WalletDetectionService.instance;
  }

  async detectWalletType(address: string): Promise<WalletDetectionResult> {
    if (!address) {
      return { type: 'unknown', isRegistered: false, route: '/choose' };
    }

    try {
      // Check if admin (first check environment variable, then API)
      const adminAddresses = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES?.split(',') || [];
      if (adminAddresses.some(admin => admin.toLowerCase() === address.toLowerCase())) {
        console.log(`✅ Wallet ${address} detected as admin (from environment)`);
        return { type: 'admin', isRegistered: true, route: '/admin' };
      }

      // Also check backend API for admin status using check-user endpoint
      try {
        const adminCheckResponse = await fetch(`${this.apiUrl}/auth/check-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ address })
        });
        if (adminCheckResponse.ok) {
          const userData = await adminCheckResponse.json();
          if (userData.type === 'admin') {
            console.log(`✅ Wallet ${address} detected as admin (from backend)`);
            return { type: 'admin', isRegistered: true, route: '/admin', data: userData.user };
          }
        }
      } catch (adminError) {
        console.log(`ℹ️ Could not check admin status from backend for ${address}`);
      }

      // Check if customer
      const customerResponse = await fetch(`${this.apiUrl}/customers/${address}`, {
        credentials: 'include' // Send cookies with request
      });
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        console.log(`✅ Wallet ${address} detected as registered customer`);
        return {
          type: 'customer',
          isRegistered: true,
          route: '/customer',
          data: customerData.data
        };
      } else if (customerResponse.status === 404) {
        console.log(`ℹ️ Wallet ${address} not found in customers (this is normal for new users)`);
      }

      // Check if shop
      const shopResponse = await fetch(`${this.apiUrl}/shops/wallet/${address}`, {
        credentials: 'include' // Send cookies with request
      });
      if (shopResponse.ok) {
        const shopData = await shopResponse.json();
        console.log(`✅ Wallet ${address} detected as registered shop`);
        return {
          type: 'shop',
          isRegistered: true,
          route: '/shop',
          data: shopData.data
        };
      } else if (shopResponse.status === 404) {
        console.log(`ℹ️ Wallet ${address} not found in shops (this is normal for new users)`);
      }

      // Unknown wallet - not registered anywhere
      console.log(`ℹ️ Wallet ${address} is not registered yet - showing registration options`);
      return { type: 'unknown', isRegistered: false, route: '/choose' };

    } catch (error) {
      console.error('❌ Unexpected error detecting wallet type:', error);
      return { type: 'unknown', isRegistered: false, route: '/choose' };
    }
  }

  // Check for role conflicts before registration
  async checkRoleConflicts(address: string, intendedRole: 'customer' | 'shop'): Promise<{
    hasConflict: boolean;
    conflictingRole?: string;
    message?: string;
  }> {
    const detection = await this.detectWalletType(address);
    
    if (detection.isRegistered && detection.type !== 'unknown') {
      if (detection.type === intendedRole) {
        return { hasConflict: false };
      }
      
      return {
        hasConflict: true,
        conflictingRole: detection.type,
        message: `This wallet is already registered as a ${detection.type}. Each wallet can only have one role.`
      };
    }
    
    return { hasConflict: false };
  }
}