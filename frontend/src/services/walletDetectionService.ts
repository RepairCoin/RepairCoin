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
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
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
      // Check if admin
      const adminAddresses = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES?.split(',') || [];
      if (adminAddresses.some(admin => admin.toLowerCase() === address.toLowerCase())) {
        return { type: 'admin', isRegistered: true, route: '/admin' };
      }

      // Check if customer
      const customerResponse = await fetch(`${this.apiUrl}/customers/${address}`);
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        return { 
          type: 'customer', 
          isRegistered: true, 
          route: '/customer',
          data: customerData.data
        };
      }

      // Check if shop
      const shopResponse = await fetch(`${this.apiUrl}/shops/wallet/${address}`);
      if (shopResponse.ok) {
        const shopData = await shopResponse.json();
        return { 
          type: 'shop', 
          isRegistered: true, 
          route: '/shop',
          data: shopData.data
        };
      }

      // Unknown wallet - not registered anywhere
      return { type: 'unknown', isRegistered: false, route: '/choose' };

    } catch (error) {
      console.error('Error detecting wallet type:', error);
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