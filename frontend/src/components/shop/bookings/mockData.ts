// Mock data for Shop Bookings Management System
// This will be replaced with real API data in the future

export type BookingStatus = 'requested' | 'paid' | 'approved' | 'scheduled' | 'completed' | 'cancelled';
export type CustomerTier = 'bronze' | 'silver' | 'gold';
export type MessageChannel = 'instagram' | 'whatsapp' | 'sms' | 'facebook' | 'app';

export interface Message {
  id: string;
  sender: 'customer' | 'shop';
  content: string;
  timestamp: string;
  channel?: MessageChannel;
}

export interface TimelineEvent {
  id: string;
  type: 'submitted' | 'paid' | 'approved' | 'scheduled' | 'completed' | 'cancelled';
  timestamp: string;
  description: string;
  metadata?: {
    paymentMethod?: string;
    transactionId?: string;
  };
}

export interface MockBooking {
  bookingId: string;
  orderId: string; // Original order ID from API (needed for API calls)
  serviceId: string; // Original service ID from API (needed for reschedule)
  status: BookingStatus;

  // Service Info
  serviceName: string;
  serviceCategory: string;
  serviceSubcategory: string;
  serviceImageUrl: string;

  // Customer Info
  customerName: string;
  customerTier: CustomerTier;
  customerAddress: string;
  customerPhone: string;
  customerLocation: string;

  // Booking Info
  bookedAt: string;
  serviceDate: string;
  serviceTime: string;
  amount: number;

  // Payment & Rewards
  paymentMethod: string;
  rcnEarned: number;
  rcnPromo: number;
  rcnRedeemed: number;

  // Customer Notes
  customerNotes?: string;

  // Messages
  messages: Message[];
  unreadCount: number;

  // Timeline Events
  timeline: TimelineEvent[];
}

export const mockBookings: MockBooking[] = [
  {
    bookingId: 'BK-9F21AB',
    orderId: 'mock-order-001',
    serviceId: 'srv_mock-001',
    status: 'paid',
    serviceName: 'iPhone Screen Repair',
    serviceCategory: 'Phone Repair',
    serviceSubcategory: 'iPhone',
    serviceImageUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=300&fit=crop',
    customerName: 'John Doe',
    customerTier: 'gold',
    customerAddress: '0x3a82322fbd79c86fef9e4580506009c31ab9bd36',
    customerPhone: '555-5555-5555',
    customerLocation: 'Mission, Texas, USA',
    bookedAt: '2025-12-18T17:14:00Z',
    serviceDate: '2025-12-26',
    serviceTime: '11:00 AM',
    amount: 150.00,
    paymentMethod: 'Card ••••4242',
    rcnEarned: 12,
    rcnPromo: 20,
    rcnRedeemed: 20,
    customerNotes: 'I would like to request an add-on or a discounted tempered glass after the service is completed.',
    messages: [
      {
        id: 'msg-1',
        sender: 'customer',
        content: 'Hi, I will be running late on my appointment later. Is it ok?',
        timestamp: '2025-12-26T07:31:00Z',
        channel: 'instagram'
      },
      {
        id: 'msg-2',
        sender: 'shop',
        content: 'Hi John, Surely, Are you willing to reschedule your appointment?',
        timestamp: '2025-12-26T07:32:00Z'
      },
      {
        id: 'msg-3',
        sender: 'customer',
        content: 'Thanks! Is the 2pm schedule open?',
        timestamp: '2025-12-26T07:34:00Z'
      }
    ],
    unreadCount: 1,
    timeline: [
      {
        id: 'tl-1',
        type: 'submitted',
        timestamp: '2025-12-18T17:14:00Z',
        description: 'Booking request submitted by customer'
      },
      {
        id: 'tl-2',
        type: 'paid',
        timestamp: '2025-12-18T17:15:00Z',
        description: 'Payment received via Stripe',
        metadata: {
          paymentMethod: 'Stripe',
          transactionId: 'pi_3QX8abc123'
        }
      }
    ]
  },
  {
    bookingId: 'BK-7C43DE',
    orderId: 'mock-order-002',
    serviceId: 'srv_mock-002',
    status: 'completed',
    serviceName: 'Oil Change & Filter',
    serviceCategory: 'Auto Service',
    serviceSubcategory: 'Maintenance',
    serviceImageUrl: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=400&h=300&fit=crop',
    customerName: 'Sarah Miller',
    customerTier: 'silver',
    customerAddress: '0x7b92314cde87a91bef8c5690607118d42cb8ae51',
    customerPhone: '555-1234-5678',
    customerLocation: 'Houston, Texas, USA',
    bookedAt: '2025-12-15T10:30:00Z',
    serviceDate: '2025-12-17',
    serviceTime: '9:00 AM',
    amount: 89.99,
    paymentMethod: 'Card ••••8901',
    rcnEarned: 8,
    rcnPromo: 0,
    rcnRedeemed: 0,
    messages: [
      {
        id: 'msg-4',
        sender: 'customer',
        content: 'Thank you for the great service!',
        timestamp: '2025-12-17T11:00:00Z',
        channel: 'app'
      }
    ],
    unreadCount: 0,
    timeline: [
      {
        id: 'tl-3',
        type: 'submitted',
        timestamp: '2025-12-15T10:30:00Z',
        description: 'Booking request submitted by customer'
      },
      {
        id: 'tl-4',
        type: 'paid',
        timestamp: '2025-12-15T10:32:00Z',
        description: 'Payment received via Stripe',
        metadata: { paymentMethod: 'Stripe', transactionId: 'pi_3QW7xyz456' }
      },
      {
        id: 'tl-5',
        type: 'approved',
        timestamp: '2025-12-15T11:00:00Z',
        description: 'Booking approved by shop'
      },
      {
        id: 'tl-6',
        type: 'scheduled',
        timestamp: '2025-12-15T11:05:00Z',
        description: 'Service scheduled for Dec 17, 2025 at 9:00 AM'
      },
      {
        id: 'tl-7',
        type: 'completed',
        timestamp: '2025-12-17T10:45:00Z',
        description: 'Service completed successfully. RCN rewards issued.'
      }
    ]
  },
  {
    bookingId: 'BK-2A98FG',
    orderId: 'mock-order-003',
    serviceId: 'srv_mock-003',
    status: 'requested',
    serviceName: 'MacBook Pro Battery Replacement',
    serviceCategory: 'Computer Repair',
    serviceSubcategory: 'Apple',
    serviceImageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',
    customerName: 'Mike Johnson',
    customerTier: 'bronze',
    customerAddress: '0x9c45678def12b34c56d78e90f12345678abcdef0',
    customerPhone: '555-9876-5432',
    customerLocation: 'Austin, Texas, USA',
    bookedAt: '2025-12-20T14:20:00Z',
    serviceDate: '2025-12-28',
    serviceTime: '2:00 PM',
    amount: 299.00,
    paymentMethod: '',
    rcnEarned: 25,
    rcnPromo: 15,
    rcnRedeemed: 0,
    customerNotes: 'Battery drains very quickly. Please also check if the charger port is working correctly.',
    messages: [],
    unreadCount: 0,
    timeline: [
      {
        id: 'tl-8',
        type: 'submitted',
        timestamp: '2025-12-20T14:20:00Z',
        description: 'Booking request submitted by customer'
      }
    ]
  },
  {
    bookingId: 'BK-5B67HI',
    orderId: 'mock-order-004',
    serviceId: 'srv_mock-004',
    status: 'approved',
    serviceName: 'HVAC System Tune-Up',
    serviceCategory: 'Home Services',
    serviceSubcategory: 'HVAC',
    serviceImageUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=300&fit=crop',
    customerName: 'Emily Chen',
    customerTier: 'gold',
    customerAddress: '0xab12cd34ef56gh78ij90kl12mn34op56qr78st90',
    customerPhone: '555-2468-1357',
    customerLocation: 'Dallas, Texas, USA',
    bookedAt: '2025-12-19T09:45:00Z',
    serviceDate: '2025-12-24',
    serviceTime: '10:00 AM',
    amount: 175.00,
    paymentMethod: 'Card ••••3456',
    rcnEarned: 15,
    rcnPromo: 10,
    rcnRedeemed: 25,
    messages: [
      {
        id: 'msg-5',
        sender: 'shop',
        content: 'Your booking has been approved! See you on Dec 24.',
        timestamp: '2025-12-19T10:00:00Z'
      },
      {
        id: 'msg-6',
        sender: 'customer',
        content: 'Great, thank you! Do I need to be home during the service?',
        timestamp: '2025-12-19T10:15:00Z',
        channel: 'whatsapp'
      }
    ],
    unreadCount: 1,
    timeline: [
      {
        id: 'tl-9',
        type: 'submitted',
        timestamp: '2025-12-19T09:45:00Z',
        description: 'Booking request submitted by customer'
      },
      {
        id: 'tl-10',
        type: 'paid',
        timestamp: '2025-12-19T09:47:00Z',
        description: 'Payment received via Stripe',
        metadata: { paymentMethod: 'Stripe', transactionId: 'pi_3QX1def789' }
      },
      {
        id: 'tl-11',
        type: 'approved',
        timestamp: '2025-12-19T10:00:00Z',
        description: 'Booking approved by shop'
      }
    ]
  },
  {
    bookingId: 'BK-8D12JK',
    orderId: 'mock-order-005',
    serviceId: 'srv_mock-005',
    status: 'cancelled',
    serviceName: 'Window Tinting',
    serviceCategory: 'Auto Service',
    serviceSubcategory: 'Customization',
    serviceImageUrl: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&h=300&fit=crop',
    customerName: 'Robert Williams',
    customerTier: 'bronze',
    customerAddress: '0xcd90ef12ab34cd56ef78gh90ij12kl34mn56op78',
    customerPhone: '555-7890-1234',
    customerLocation: 'San Antonio, Texas, USA',
    bookedAt: '2025-12-16T16:00:00Z',
    serviceDate: '2025-12-20',
    serviceTime: '3:00 PM',
    amount: 250.00,
    paymentMethod: 'Card ••••6789',
    rcnEarned: 0,
    rcnPromo: 0,
    rcnRedeemed: 0,
    customerNotes: 'Need darkest legal tint for all windows.',
    messages: [
      {
        id: 'msg-7',
        sender: 'customer',
        content: 'I need to cancel my appointment. Something came up.',
        timestamp: '2025-12-19T08:00:00Z',
        channel: 'sms'
      },
      {
        id: 'msg-8',
        sender: 'shop',
        content: 'No problem, your booking has been cancelled. Let us know when you want to reschedule.',
        timestamp: '2025-12-19T08:30:00Z'
      }
    ],
    unreadCount: 0,
    timeline: [
      {
        id: 'tl-12',
        type: 'submitted',
        timestamp: '2025-12-16T16:00:00Z',
        description: 'Booking request submitted by customer'
      },
      {
        id: 'tl-13',
        type: 'paid',
        timestamp: '2025-12-16T16:02:00Z',
        description: 'Payment received via Stripe',
        metadata: { paymentMethod: 'Stripe', transactionId: 'pi_3QV5ghi012' }
      }
    ]
  }
];

export const quickReplies = [
  'Your booking is now scheduled for Dec 26, 2025 at 2:00 AM.',
  'Thank you for your patience. We\'re ready for your appointment!',
  'We need to reschedule your appointment. What times work for you?',
];

// Helper functions
export const getStatusLabel = (status: BookingStatus): string => {
  const labels: Record<BookingStatus, string> = {
    requested: 'Waiting for Payment',
    paid: 'Waiting for Shop Approval',
    approved: 'Approved',
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  return labels[status];
};

export const getStatusColor = (status: BookingStatus): string => {
  const colors: Record<BookingStatus, string> = {
    requested: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    paid: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    scheduled: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  };
  return colors[status];
};

export const getTierColor = (tier: CustomerTier): string => {
  const colors: Record<CustomerTier, string> = {
    bronze: 'bg-orange-600',
    silver: 'bg-gray-400',
    gold: 'bg-yellow-500'
  };
  return colors[tier];
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const truncateAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getChannelIcon = (channel?: MessageChannel): string => {
  const icons: Record<MessageChannel, string> = {
    instagram: 'instagram',
    whatsapp: 'whatsapp',
    sms: 'sms',
    facebook: 'facebook',
    app: 'app'
  };
  return channel ? icons[channel] : 'app';
};

// ==================== API Data Transformation ====================

import type { ServiceOrderWithDetails, OrderStatus } from '@/services/api/services';

/**
 * Map API OrderStatus to UI BookingStatus
 * Also considers shopApproved flag for proper status display
 */
export const mapApiStatus = (apiStatus: OrderStatus, shopApproved?: boolean): BookingStatus => {
  // If status is 'paid' but shop has approved, show as 'scheduled' (auto-confirmed)
  if (apiStatus === 'paid' && shopApproved) {
    return 'scheduled';
  }

  switch (apiStatus) {
    case 'pending':
      return 'requested';
    case 'paid':
      return 'paid';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'cancelled';
    default:
      return 'requested';
  }
};

/**
 * Generate a booking ID from order ID
 */
const generateBookingId = (orderId: string): string => {
  // Take last 6 characters of orderId and format as BK-XXXXXX
  const shortId = orderId.replace(/-/g, '').slice(-6).toUpperCase();
  return `BK-${shortId}`;
};

/**
 * Generate timeline events from order data
 */
export const generateTimelineFromOrder = (order: ServiceOrderWithDetails): TimelineEvent[] => {
  const timeline: TimelineEvent[] = [];

  // Always add submitted event
  timeline.push({
    id: `tl-${order.orderId}-submitted`,
    type: 'submitted',
    timestamp: order.createdAt,
    description: 'Booking request submitted by customer'
  });

  // Add paid event if status is paid or beyond
  const paidStatuses: OrderStatus[] = ['paid', 'completed'];
  if (paidStatuses.includes(order.status) || order.stripePaymentIntentId) {
    timeline.push({
      id: `tl-${order.orderId}-paid`,
      type: 'paid',
      timestamp: order.createdAt, // Use createdAt as we don't have exact payment time
      description: 'Payment received via Stripe',
      metadata: {
        paymentMethod: 'Stripe',
        transactionId: order.stripePaymentIntentId
      }
    });
  }

  // Add completed event
  if (order.status === 'completed' && order.completedAt) {
    // Add approved and scheduled events (inferred)
    timeline.push({
      id: `tl-${order.orderId}-approved`,
      type: 'approved',
      timestamp: order.createdAt,
      description: 'Booking approved by shop'
    });
    timeline.push({
      id: `tl-${order.orderId}-scheduled`,
      type: 'scheduled',
      timestamp: order.createdAt,
      description: `Service scheduled for ${formatDate(order.bookingDate || order.createdAt)}`
    });
    timeline.push({
      id: `tl-${order.orderId}-completed`,
      type: 'completed',
      timestamp: order.completedAt,
      description: 'Service completed successfully. RCN rewards issued.'
    });
  }

  return timeline;
};

/**
 * Transform API ServiceOrderWithDetails to UI MockBooking
 */
export const transformApiOrder = (order: ServiceOrderWithDetails): MockBooking => {
  return {
    bookingId: generateBookingId(order.orderId),
    orderId: order.orderId, // Keep original order ID for API calls
    serviceId: order.serviceId, // Keep service ID for reschedule
    status: mapApiStatus(order.status, order.shopApproved),

    // Service Info
    serviceName: order.serviceName || 'Unknown Service',
    serviceCategory: order.companyName || '',
    serviceSubcategory: '',
    serviceImageUrl: order.serviceImageUrl || '',

    // Customer Info
    customerName: order.customerName || 'Customer',
    customerTier: 'bronze', // Default - not available from API
    customerAddress: order.customerAddress,
    customerPhone: '', // Not available from API
    customerLocation: order.shopCity ? `${order.shopCity}` : '',

    // Booking Info
    bookedAt: order.createdAt,
    serviceDate: order.bookingDate || order.createdAt,
    serviceTime: order.bookingTime || order.bookingTimeSlot || '',
    amount: order.totalAmount,

    // Payment & Rewards
    paymentMethod: order.stripePaymentIntentId ? 'Card ••••' : '',
    rcnEarned: order.rcnEarned || 0,
    rcnPromo: 0, // Not available from API
    rcnRedeemed: order.rcnRedeemed || 0,

    // Customer Notes
    customerNotes: order.notes || '',

    // Messages - no backend support yet
    messages: [],
    unreadCount: 0,

    // Timeline
    timeline: generateTimelineFromOrder(order)
  };
};
