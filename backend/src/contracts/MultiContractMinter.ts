// Example of multi-contract setup
import { createThirdwebClient, getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

export class MultiContractMinter {
  private client: any;
  private tokenContract: any;
  private tierContract: any;
  private shopContract: any;
  private treasuryContract: any;

  constructor() {
    this.client = createThirdwebClient({
      clientId: process.env.THIRDWEB_CLIENT_ID!,
      secretKey: process.env.THIRDWEB_SECRET_KEY!,
    });

    // Initialize all contracts
    this.tokenContract = getContract({
      client: this.client,
      chain: baseSepolia,
      address: process.env.REPAIRCOIN_TOKEN_ADDRESS!
    });

    this.tierContract = getContract({
      client: this.client,
      chain: baseSepolia,
      address: process.env.TIER_MANAGER_ADDRESS!
    });

    this.shopContract = getContract({
      client: this.client,
      chain: baseSepolia,
      address: process.env.SHOP_MANAGER_ADDRESS!
    });

    this.treasuryContract = getContract({
      client: this.client,
      chain: baseSepolia,
      address: process.env.TREASURY_ADDRESS!
    });
  }

  // Example: Check tier from TierManager contract
  async getCustomerTier(customerAddress: string) {
    const tier = await readContract({
      contract: this.tierContract,
      method: "function getCustomerTier(address customer) returns (string)",
      params: [customerAddress]
    });
    return tier;
  }

  // Example: Register shop in ShopManager contract
  async registerShop(shopId: string, walletAddress: string) {
    const tx = await sendTransaction({
      contract: this.shopContract,
      method: "function registerShop(string shopId, address wallet)",
      params: [shopId, walletAddress]
    });
    return tx;
  }

  // Example: Treasury auto-mints tokens
  async triggerAutoMint(customerAddress: string, repairAmount: number) {
    const tx = await sendTransaction({
      contract: this.treasuryContract,
      method: "function processRepairReward(address customer, uint256 amount)",
      params: [customerAddress, BigInt(repairAmount)]
    });
    return tx;
  }
}