// frontend/src/services/api/support.ts
import apiClient from './client';

export interface SupportTicket {
  id: string;
  shopId: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_shop' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'billing' | 'technical' | 'account' | 'general' | 'feature_request';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  lastMessageAt: string;
  unreadCount?: number;
  lastMessage?: string;
  shopName?: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderType: 'shop' | 'admin' | 'system';
  senderId: string;
  senderName?: string;
  message: string;
  attachments?: string[];
  isInternal: boolean;
  createdAt: string;
  readAt?: string;
  editedAt?: string;
}

export interface CreateTicketRequest {
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'billing' | 'technical' | 'account' | 'general' | 'feature_request';
}

export interface CreateTicketResponse {
  ticket: SupportTicket;
  message: SupportMessage;
}

export interface AddMessageRequest {
  message: string;
  isInternal?: boolean;
}

export interface AdminStats {
  total: number;
  open: number;
  inProgress: number;
  waitingShop: number;
  resolved: number;
  unassigned: number;
}

export interface UpdateTicketStatusRequest {
  status: 'open' | 'in_progress' | 'waiting_shop' | 'resolved' | 'closed';
  assignedTo?: string;
}

export interface AssignTicketRequest {
  assignedTo: string;
}

// ==================== SHOP ENDPOINTS ====================

/**
 * Create a new support ticket
 */
export const createTicket = async (request: CreateTicketRequest): Promise<CreateTicketResponse> => {
  const response = await apiClient.post('/support/tickets', request);
  console.log('Create ticket response:', response.data);
  // Response is already unwrapped by axios interceptor, so response.data contains {ticket, message} directly
  return response.data || { ticket: {} as SupportTicket, message: {} as SupportMessage };
};

/**
 * Get all tickets for the authenticated shop
 */
export const getShopTickets = async (status?: string): Promise<SupportTicket[]> => {
  const params = status ? `?status=${status}` : '';
  const response = await apiClient.get(`/support/tickets${params}`);
  console.log('Get shop tickets response:', response.data);
  // Response is already unwrapped by axios interceptor, so response.data is the array directly
  return response.data || [];
};

/**
 * Get ticket by ID
 */
export const getTicketById = async (ticketId: string): Promise<SupportTicket> => {
  const response = await apiClient.get(`/support/tickets/${ticketId}`);
  return response.data || {} as SupportTicket;
};

/**
 * Get messages for a ticket
 */
export const getTicketMessages = async (ticketId: string): Promise<SupportMessage[]> => {
  const response = await apiClient.get(`/support/tickets/${ticketId}/messages`);
  return response.data || [];
};

/**
 * Add a message to a ticket
 */
export const addMessage = async (ticketId: string, request: AddMessageRequest): Promise<SupportMessage> => {
  const response = await apiClient.post(`/support/tickets/${ticketId}/messages`, request);
  return response.data || {} as SupportMessage;
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (ticketId: string): Promise<void> => {
  await apiClient.post(`/support/tickets/${ticketId}/read`);
};

/**
 * Get unread ticket count
 */
export const getUnreadCount = async (): Promise<number> => {
  try {
    const response = await apiClient.get('/support/unread-count');
    return response.data?.count ?? 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all tickets (admin only)
 */
export const getAllTickets = async (filters?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tickets: SupportTicket[]; total: number }> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiClient.get(`/support/admin/tickets?${params.toString()}`);
  return response.data || { tickets: [], total: 0 };
};

/**
 * Get admin statistics
 */
export const getAdminStats = async (): Promise<AdminStats> => {
  const response = await apiClient.get('/support/admin/stats');
  return response.data || { total: 0, open: 0, inProgress: 0, waitingShop: 0, resolved: 0, unassigned: 0 };
};

/**
 * Update ticket status (admin only)
 */
export const updateTicketStatus = async (
  ticketId: string,
  request: UpdateTicketStatusRequest
): Promise<SupportTicket> => {
  const response = await apiClient.put(`/support/admin/tickets/${ticketId}/status`, request);
  return response.data || {} as SupportTicket;
};

/**
 * Assign ticket to admin (admin only)
 */
export const assignTicket = async (
  ticketId: string,
  request: AssignTicketRequest
): Promise<SupportTicket> => {
  const response = await apiClient.put(`/support/admin/tickets/${ticketId}/assign`, request);
  return response.data || {} as SupportTicket;
};
