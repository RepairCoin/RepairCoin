import apiClient from './client';

export interface ShopLocation {
  id: string;
  shopId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  isPrimary: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationInput {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  active?: boolean;
}

export const getLocations = async (): Promise<ShopLocation[]> => {
  const res = await apiClient.get<{ success: boolean; data: ShopLocation[] }>('/shops/locations');
  return res.data || [];
};

export const createLocation = async (input: LocationInput): Promise<ShopLocation> => {
  const res = await apiClient.post<{ success: boolean; data: ShopLocation }>('/shops/locations', input);
  return res.data;
};

export const updateLocation = async (id: string, input: Partial<LocationInput>): Promise<ShopLocation> => {
  const res = await apiClient.put<{ success: boolean; data: ShopLocation }>(`/shops/locations/${id}`, input);
  return res.data;
};

export const setPrimaryLocation = async (id: string): Promise<ShopLocation> => {
  const res = await apiClient.post<{ success: boolean; data: ShopLocation }>(`/shops/locations/${id}/primary`);
  return res.data;
};

export const deleteLocation = async (id: string): Promise<void> => {
  await apiClient.delete(`/shops/locations/${id}`);
};
