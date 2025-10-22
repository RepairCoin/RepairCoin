const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface CustomerData {
  data: {
    customer: {
      address: string;
      name: string;
      email: string;
      phone: string;
      tier: string;
      lifetimeEarnings: number;
      referralCode: string;
      referralCount: number;
      dailyEarnings: number;
      monthlyEarnings: number;
      lastEarnedDate: string;
      joinDate: string;
      isActive: boolean;
      isSuspended: boolean;
      suspensionReason: string | null;
      id: number;
      shopId: string;
      stripeCustomerId: string;
      createdAt: string;
      updatedAt: string;
    },
    blockchainBalance: number,
    tierBenefits: {
      earningMultiplier: number,
      redemptionRate: number,
      crossShopRedemption: boolean,
      tierBonus: number,
      features: string[]
    },
    earningCapacity: {},
    tierProgression: {}
  },
  success: boolean,
  message: string
}

export const getCustomerByWalletAddress = async (address: string): Promise<CustomerData> => {
  const response = await fetch(`${API_URL}/customers/${address}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.log(`Failed to fetch customer: ${response.status}`);
  }

  return response.json();
}

export const getRCNBalanceByWalletAddress = async (address: string) => {
  const response = await fetch(`${API_URL}/tokens/earned-balance/${address}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.log(`Failed to fetch balance: ${response.status}`);
  }

  return response.json();
}

export const getEarningHistoryByWalletAddress = async (address: string, token: string | undefined) => {
  const response = await fetch(`${API_URL}/customers/${address}/transactions`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
  });

  if (!response.ok) {
    console.log(`Failed to fetch earning history: ${response.status}`);
  }

  return response.json();
}

export const calculateTierByAddress = async (address: string, repairAmount: number) => {
  const response = await fetch(`${API_URL}/shops/tier-bonus/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerAddress: address,
      repairAmount
    })
  });

  if (!response.ok) {
    console.log(`Failed to fetch tier status: ${response.status}`);
  }

  return response.json();
}