const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const listShops = async () => {
  const response = await fetch(`${API_URL}/shops`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch shops: ${response.status}`);
  }

  return response.json();
}

export const getShopById = async (shopId: string) => {
  const response = await fetch(`${API_URL}/shops/${shopId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch shop: ${response.status}`);
  }

  return response.json();
}

export const getShopByWalletAddress = async (address: string) => {
  const response = await fetch(`${API_URL}/shops/wallet/${address}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch shop: ${response.status}`);
  }

  return response.json();
}