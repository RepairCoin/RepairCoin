import apiClient from "./client";

export interface ShopTaxRate {
  id: string;
  shopId: string;
  locationId: string | null;
  name: string;
  rateBps: number;
  active: boolean;
}

export const bpsToPercent = (bps: number): number => bps / 100;

export async function listTaxRates(): Promise<ShopTaxRate[]> {
  const res = await apiClient.get<{ data?: { rates: ShopTaxRate[] } }>("/shops/pos/tax-rates");
  return res.data?.rates ?? [];
}

export async function saveTaxRate(input: {
  ratePercent: number;
  name?: string;
  locationId?: string | null;
}): Promise<ShopTaxRate> {
  const res = await apiClient.put<{ data?: { rate: ShopTaxRate }; error?: string }>(
    "/shops/pos/tax-rates",
    input
  );
  if (!res.data?.rate) throw new Error(res.error || "Could not save the tax rate");
  return res.data.rate;
}

export async function removeTaxRate(id: string): Promise<void> {
  await apiClient.delete(`/shops/pos/tax-rates/${id}`);
}
