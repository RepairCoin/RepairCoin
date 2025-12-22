// backend/src/utils/serviceMapper.ts
/**
 * Shared mapping functions for service data
 * Ensures consistent data transformation across all service endpoints
 */

export interface ServiceGroup {
  groupId: string;
  groupName: string;
  customTokenSymbol: string;
  customTokenName: string;
  icon?: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
}

export interface ShopLocation {
  lat: number | null;
  lng: number | null;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface ShopServiceWithShopInfo {
  serviceId: string;
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];
  active: boolean;
  avgRating?: number;
  averageRating?: number; // Legacy field
  reviewCount?: number;
  companyName: string;
  shopName?: string;
  shopAddress?: string;
  shopCity?: string;
  shopCountry?: string;
  shopPhone?: string;
  shopEmail?: string;
  shopIsVerified: boolean;
  shopLocation?: ShopLocation;
  groups?: ServiceGroup[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Map a database row to ShopServiceWithShopInfo interface
 * This is the standard mapper for all service endpoints
 *
 * @param row Database row with snake_case column names
 * @returns Mapped service object with camelCase properties
 */
export function mapServiceWithShopInfo(row: any): ShopServiceWithShopInfo {
  return {
    serviceId: row.service_id,
    shopId: row.shop_id,
    serviceName: row.service_name,
    description: row.description,
    priceUsd: parseFloat(row.price_usd),
    durationMinutes: row.duration_minutes,
    category: row.category,
    imageUrl: row.image_url,
    tags: row.tags || [],
    active: row.active ?? true,
    avgRating: row.average_rating ? parseFloat(row.average_rating) : undefined,
    averageRating: row.average_rating ? parseFloat(row.average_rating) : undefined, // Legacy field
    reviewCount: row.review_count || 0,
    companyName: row.company_name || row.shop_name,
    shopName: row.shop_name,
    shopAddress: row.shop_address,
    shopCity: row.shop_city || row.location_city,
    shopCountry: row.shop_country || row.country,
    shopPhone: row.shop_phone || row.phone,
    shopEmail: row.shop_email || row.email,
    shopIsVerified: row.shop_is_verified || row.verified || false,
    shopLocation: {
      lat: row.location_lat ? parseFloat(row.location_lat) : null,
      lng: row.location_lng ? parseFloat(row.location_lng) : null,
      city: row.location_city,
      state: row.location_state,
      zipCode: row.location_zip_code
    },
    groups: row.groups || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map an array of database rows to service objects
 *
 * @param rows Array of database rows
 * @returns Array of mapped service objects
 */
export function mapServicesWithShopInfo(rows: any[]): ShopServiceWithShopInfo[] {
  return rows.map(mapServiceWithShopInfo);
}

/**
 * Map service group availability row
 * Used for service-group link data
 */
export interface ServiceGroupLink {
  id: number;
  serviceId: string;
  groupId: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
  active: boolean;
  addedAt: Date;
  updatedAt: Date;
  // Optional group info (when joined)
  groupName?: string;
  customTokenName?: string;
  customTokenSymbol?: string;
  icon?: string;
}

export function mapServiceGroupLink(row: any): ServiceGroupLink {
  return {
    id: row.id,
    serviceId: row.service_id,
    groupId: row.group_id,
    tokenRewardPercentage: parseFloat(row.token_reward_percentage),
    bonusMultiplier: parseFloat(row.bonus_multiplier),
    active: row.active ?? true,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
    groupName: row.group_name,
    customTokenName: row.custom_token_name,
    customTokenSymbol: row.custom_token_symbol,
    icon: row.icon
  };
}

export function mapServiceGroupLinks(rows: any[]): ServiceGroupLink[] {
  return rows.map(mapServiceGroupLink);
}
