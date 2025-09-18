const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.132.85:3000/api';

export const getRCNBalanceByWalletAddress = async (address: string) => {
  const response = await fetch(`${API_URL}/tokens/earned-balance/${address}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  return response;
}

export const getEarningHistoryByWalletAddress = async (address: string) => {
  const response = await fetch(`${API_URL}/tokens/earning-sources/${address}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  return response;
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

  return response;
}