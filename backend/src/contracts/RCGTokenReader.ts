import { createThirdwebClient, getContract, ThirdwebClient, ThirdwebContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import { balanceOf, totalSupply } from 'thirdweb/extensions/erc20';

interface RCGStats {
  totalSupply: string;
  circulatingSupply: string;
  teamAllocation: string;
  investorAllocation: string;
  publicSaleAllocation: string;
  daoTreasuryAllocation: string;
  stakingRewardsAllocation: string;
  holders: number;
  stakedAmount: string;
}

interface RCGHolder {
  address: string;
  balance: string;
  tier?: 'standard' | 'premium' | 'elite';
}

export class RCGTokenReader {
  private client: ThirdwebClient | null = null;
  private contract: ThirdwebContract | null = null;
  private readonly contractAddress: string;
  private readonly clientId: string;
  private readonly secretKey: string;

  // RCG token allocations (fixed)
  private readonly TOTAL_SUPPLY = '100000000'; // 100M RCG
  private readonly TEAM_ALLOCATION = '30000000'; // 30M (30%)
  private readonly INVESTOR_ALLOCATION = '30000000'; // 30M (30%)
  private readonly PUBLIC_SALE_ALLOCATION = '20000000'; // 20M (20%)
  private readonly DAO_TREASURY_ALLOCATION = '15000000'; // 15M (15%)
  private readonly STAKING_REWARDS_ALLOCATION = '5000000'; // 5M (5%)

  // Shop tier thresholds
  private readonly TIER_THRESHOLDS = {
    standard: { min: 10000, max: 49999 },
    premium: { min: 50000, max: 199999 },
    elite: { min: 200000, max: Infinity }
  };

  constructor() {
    this.contractAddress = process.env.RCG_CONTRACT_ADDRESS || '0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D';
    this.clientId = process.env.RCG_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || '';
    this.secretKey = process.env.RCG_THIRDWEB_SECRET_KEY || process.env.THIRDWEB_SECRET_KEY || '';

    if (!this.contractAddress || !this.clientId || !this.secretKey) {
      console.warn('RCG token reader configuration incomplete');
    }
  }

  private async initialize(): Promise<void> {
    if (this.client && this.contract) return;

    try {
      this.client = createThirdwebClient({
        clientId: this.clientId,
        secretKey: this.secretKey,
      });

      this.contract = getContract({
        client: this.client,
        chain: baseSepolia,
        address: this.contractAddress,
      });
    } catch (error) {
      console.error('Failed to initialize RCG token reader:', error);
      throw error;
    }
  }

  async getContractStats(): Promise<RCGStats> {
    await this.initialize();
    
    try {
      // Get actual total supply from contract
      const supply = await totalSupply({
        contract: this.contract,
      });

      // For now, return fixed allocations
      // In production, you'd calculate circulating supply by checking vesting contracts
      return {
        totalSupply: this.TOTAL_SUPPLY,
        circulatingSupply: this.PUBLIC_SALE_ALLOCATION, // Simplified for now
        teamAllocation: this.TEAM_ALLOCATION,
        investorAllocation: this.INVESTOR_ALLOCATION,
        publicSaleAllocation: this.PUBLIC_SALE_ALLOCATION,
        daoTreasuryAllocation: this.DAO_TREASURY_ALLOCATION,
        stakingRewardsAllocation: this.STAKING_REWARDS_ALLOCATION,
        holders: 0, // Would need to track this separately
        stakedAmount: '0' // Would come from staking contract
      };
    } catch (error) {
      console.error('Failed to get RCG contract stats:', error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<string> {
    await this.initialize();
    
    try {
      const balance = await balanceOf({
        contract: this.contract,
        address: address,
      });
      
      // Convert BigInt to string and format to 18 decimals
      const balanceInWei = balance.toString();
      const balanceFormatted = (Number(balanceInWei) / 1e18).toFixed(6);
      return balanceFormatted;
    } catch (error) {
      console.error('Failed to get RCG balance:', error);
      return '0';
    }
  }

  async getShopTier(address: string): Promise<'none' | 'standard' | 'premium' | 'elite'> {
    const balance = await this.getBalance(address);
    const balanceNum = parseFloat(balance);

    if (balanceNum < this.TIER_THRESHOLDS.standard.min) {
      return 'none';
    } else if (balanceNum <= this.TIER_THRESHOLDS.standard.max) {
      return 'standard';
    } else if (balanceNum <= this.TIER_THRESHOLDS.premium.max) {
      return 'premium';
    } else {
      return 'elite';
    }
  }

  getRCNPriceForTier(tier: 'none' | 'standard' | 'premium' | 'elite'): number {
    switch (tier) {
      case 'none':
        return 0.10; // Default price if not enough RCG
      case 'standard':
        return 0.10;
      case 'premium':
        return 0.08;
      case 'elite':
        return 0.06;
      default:
        return 0.10;
    }
  }

  async getTopHolders(limit: number = 10): Promise<RCGHolder[]> {
    // This would require indexing or event monitoring
    // For now, return empty array
    // In production, you'd query indexed data or use a subgraph
    return [];
  }

  calculateDistribution(rcnSalesRevenue: number): {
    operations: number;
    stakers: number;
    daoTreasury: number;
  } {
    return {
      operations: rcnSalesRevenue * 0.80,
      stakers: rcnSalesRevenue * 0.10,
      daoTreasury: rcnSalesRevenue * 0.10
    };
  }
}

let rcgTokenReader: RCGTokenReader | null = null;

export function getRCGTokenReader(): RCGTokenReader {
  if (!rcgTokenReader) {
    rcgTokenReader = new RCGTokenReader();
  }
  return rcgTokenReader;
}