import { getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { rcnClient, rcgClient } from "@/utils/thirdweb";

// Contract addresses
export const RCN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RCN_CONTRACT_ADDRESS || "0xBFE793d78B6B83859b528F191bd6F2b8555D951C";
export const RCG_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RCG_CONTRACT_ADDRESS || "0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D";

// Legacy support
export const REPAIRCOIN_CONTRACT_ADDRESS = RCN_CONTRACT_ADDRESS;

// Contract instances
export const rcnContract = getContract({
  client: rcnClient,
  address: RCN_CONTRACT_ADDRESS,
  chain: baseSepolia,
});

export const rcgContract = getContract({
  client: rcgClient,
  address: RCG_CONTRACT_ADDRESS,
  chain: baseSepolia,
});

// Token configuration
export const TOKEN_CONFIG = {
  RCN: {
    symbol: "RCN",
    name: "RepairCoin",
    decimals: 18,
    redemptionValue: 0.10, // $0.10 USD per RCN
    purchasePrice: 0.10,   // Shops buy at $0.10
    supply: "unlimited",
    tradable: false,
  },
  RCG: {
    symbol: "RCG",
    name: "RepairCoin Governance",
    decimals: 18,
    totalSupply: 100_000_000,
    minStake: 10_000,
    lockPeriod: 180, // days
  }
};

// Shop tier configuration
export const SHOP_TIERS = {
  STANDARD: {
    name: "Standard",
    minRCG: 10_000,
    maxRCG: 49_999,
    rcnPrice: 0.10,
    discount: 0,
  },
  PREMIUM: {
    name: "Premium",
    minRCG: 50_000,
    maxRCG: 199_999,
    rcnPrice: 0.08,
    discount: 20,
  },
  ELITE: {
    name: "Elite",
    minRCG: 200_000,
    maxRCG: Infinity,
    rcnPrice: 0.06,
    discount: 40,
  }
};