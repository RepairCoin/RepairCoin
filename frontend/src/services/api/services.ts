import apiClient from './client';

// ==================== TYPE DEFINITIONS ====================

export type ServiceCategory =
  | 'repairs'
  | 'beauty_personal_care'
  | 'health_wellness'
  | 'fitness_gyms'
  | 'automotive_services'
  | 'home_cleaning_services'
  | 'pets_animal_care'
  | 'professional_services'
  | 'education_classes'
  | 'tech_it_services'
  | 'food_beverage'
  | 'other_local_services';

export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded';

export interface ShopService {
  serviceId: string;
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: ServiceCategory;
  imageUrl?: string;
  tags?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopServiceWithShopInfo extends ShopService {
  companyName: string;
  shopAddress?: string;
  shopCity?: string;
  shopCountry?: string;
  shopPhone?: string;
  shopEmail?: string;
  shopIsVerified: boolean;
  distance?: number;
}

export interface ServiceOrder {
  orderId: string;
  serviceId: string;
  customerAddress: string;
  shopId: string;
  stripePaymentIntentId?: string;
  status: OrderStatus;
  totalAmount: number;
  bookingDate?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOrderWithDetails extends ServiceOrder {
  serviceName: string;
  serviceDescription?: string;
  serviceImageUrl?: string;
  companyName: string;
  shopName: string;
  shopAddress?: string;
  shopCity?: string;
  shopPhone?: string;
  shopEmail?: string;
}

export interface CreateServiceData {
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: ServiceCategory;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export interface UpdateServiceData {
  serviceName?: string;
  description?: string;
  priceUsd?: number;
  durationMinutes?: number;
  category?: ServiceCategory;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export interface CreatePaymentIntentData {
  serviceId: string;
  bookingDate?: string;
  notes?: string;
}

export interface CreatePaymentIntentResponse {
  orderId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface ServiceFilters {
  shopId?: string;
  category?: ServiceCategory;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface OrderFilters {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== HELPER FUNCTIONS ====================

const buildQueryString = (params: Record<string, string | number | boolean | undefined>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

// ==================== SERVICE MANAGEMENT APIs ====================

/**
 * Create a new service (Shop only)
 */
export const createService = async (data: CreateServiceData): Promise<ShopService | null> => {
  try {
    const response = await apiClient.post<ShopService>('/services', data);
    return response.data || null;
  } catch (error) {
    console.error('Error creating service:', error);
    throw error;
  }
};

/**
 * Get all services for the marketplace (Public)
 */
export const getAllServices = async (
  filters?: ServiceFilters
): Promise<PaginatedResponse<ShopServiceWithShopInfo> | null> => {
  try {
    const queryString = filters ? buildQueryString(filters) : '';
    const response = await apiClient.get<PaginatedResponse<ShopServiceWithShopInfo>>(
      `/services${queryString}`
    );
    return response || null;
  } catch (error) {
    console.error('Error getting all services:', error);
    return null;
  }
};

/**
 * Get service by ID with shop details (Public)
 */
export const getServiceById = async (serviceId: string): Promise<ShopServiceWithShopInfo | null> => {
  try {
    const response = await apiClient.get<ShopServiceWithShopInfo>(`/services/${serviceId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting service:', error);
    return null;
  }
};

/**
 * Get all services for a specific shop (Public)
 */
export const getShopServices = async (
  shopId: string,
  options?: { page?: number; limit?: number }
): Promise<PaginatedResponse<ShopService> | null> => {
  try {
    const queryString = options ? buildQueryString(options) : '';
    const response = await apiClient.get<PaginatedResponse<ShopService>>(
      `/services/shop/${shopId}${queryString}`
    );
    return response || null;
  } catch (error) {
    console.error('Error getting shop services:', error);
    return null;
  }
};

/**
 * Update a service (Shop owner only)
 */
export const updateService = async (
  serviceId: string,
  updates: UpdateServiceData
): Promise<ShopService | null> => {
  try {
    const response = await apiClient.put<ShopService>(`/services/${serviceId}`, updates);
    return response.data || null;
  } catch (error) {
    console.error('Error updating service:', error);
    throw error;
  }
};

/**
 * Delete (deactivate) a service (Shop owner only)
 */
export const deleteService = async (serviceId: string): Promise<boolean> => {
  try {
    await apiClient.delete(`/services/${serviceId}`);
    return true;
  } catch (error) {
    console.error('Error deleting service:', error);
    throw error;
  }
};

// ==================== ORDER MANAGEMENT APIs ====================

/**
 * Create payment intent for service booking (Customer only)
 */
export const createPaymentIntent = async (
  data: CreatePaymentIntentData
): Promise<CreatePaymentIntentResponse | null> => {
  try {
    const response = await apiClient.post<CreatePaymentIntentResponse>(
      '/services/orders/create-payment-intent',
      data
    );
    return response.data || null;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Confirm payment (optional - webhooks handle most cases)
 */
export const confirmPayment = async (paymentIntentId: string): Promise<ServiceOrder | null> => {
  try {
    const response = await apiClient.post<ServiceOrder>('/services/orders/confirm', {
      paymentIntentId,
    });
    return response.data || null;
  } catch (error) {
    console.error('Error confirming payment:', error);
    return null;
  }
};

/**
 * Get customer's orders (Customer only)
 */
export const getCustomerOrders = async (
  filters?: OrderFilters
): Promise<PaginatedResponse<ServiceOrderWithDetails> | null> => {
  try {
    const queryString = filters ? buildQueryString(filters) : '';
    const response = await apiClient.get<PaginatedResponse<ServiceOrderWithDetails>>(
      `/services/orders/customer${queryString}`
    );
    return response || null;
  } catch (error) {
    console.error('Error getting customer orders:', error);
    return null;
  }
};

/**
 * Get shop's orders (Shop only)
 */
export const getShopOrders = async (
  filters?: OrderFilters
): Promise<PaginatedResponse<ServiceOrderWithDetails> | null> => {
  try {
    const queryString = filters ? buildQueryString(filters) : '';
    const response = await apiClient.get<PaginatedResponse<ServiceOrderWithDetails>>(
      `/services/orders/shop${queryString}`
    );
    return response || null;
  } catch (error) {
    console.error('Error getting shop orders:', error);
    return null;
  }
};

/**
 * Get order by ID (Customer or Shop)
 */
export const getOrderById = async (orderId: string): Promise<ServiceOrderWithDetails | null> => {
  try {
    const response = await apiClient.get<ServiceOrderWithDetails>(`/services/orders/${orderId}`);
    return response.data || null;
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
};

/**
 * Update order status (Shop only)
 */
export const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<ServiceOrder | null> => {
  try {
    const response = await apiClient.put<ServiceOrder>(`/services/orders/${orderId}/status`, {
      status,
    });
    return response.data || null;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

/**
 * Cancel order (Customer only, before payment)
 */
export const cancelOrder = async (orderId: string): Promise<boolean> => {
  try {
    await apiClient.post(`/services/orders/${orderId}/cancel`);
    return true;
  } catch (error) {
    console.error('Error canceling order:', error);
    throw error;
  }
};

// ==================== CONVENIENCE NAMESPACE EXPORT ====================

export const servicesApi = {
  // Service Management
  createService,
  getAllServices,
  getServiceById,
  getShopServices,
  updateService,
  deleteService,

  // Order Management
  createPaymentIntent,
  confirmPayment,
  getCustomerOrders,
  getShopOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
} as const;

// ==================== SERVICE CATEGORIES CONSTANT ====================

export const SERVICE_CATEGORIES: Array<{ value: ServiceCategory; label: string }> = [
  { value: 'repairs', label: 'Repairs' },
  { value: 'beauty_personal_care', label: 'Beauty & Personal Care' },
  { value: 'health_wellness', label: 'Health & Wellness' },
  { value: 'fitness_gyms', label: 'Fitness & Gyms' },
  { value: 'automotive_services', label: 'Automotive Services' },
  { value: 'home_cleaning_services', label: 'Home & Cleaning Services' },
  { value: 'pets_animal_care', label: 'Pets & Animal Care' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'education_classes', label: 'Education & Classes' },
  { value: 'tech_it_services', label: 'Tech & IT Services' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'other_local_services', label: 'Other Local Services' },
];
