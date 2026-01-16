'use client';

import React, { useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useNotificationActions } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationModalProps {
  notification: any;
  onClose: () => void;
  onDelete: (id: string) => void;
}

// Render a design block for marketing campaigns
const renderMarketingBlock = (block: any, metadata: any) => {
  const style = block.style || {};

  switch (block.type) {
    case 'headline':
      return (
        <h2
          key={block.id}
          style={{
            fontSize: style.fontSize || '24px',
            fontWeight: style.fontWeight || 'bold',
            textAlign: style.textAlign || 'center',
            color: style.color || '#111827',
            margin: '0 0 16px 0',
          }}
        >
          {block.content}
        </h2>
      );

    case 'text':
      return (
        <div
          key={block.id}
          className="rich-text-content"
          style={{
            fontSize: style.fontSize || '14px',
            textAlign: style.textAlign || 'left',
            color: style.color || '#374151',
            lineHeight: 1.6,
            margin: '0 0 16px 0',
          }}
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );

    case 'button':
      // Build the service URL if serviceId is available
      const buttonUrl = metadata.serviceId
        ? `/customer?tab=marketplace&service=${metadata.serviceId}`
        : block.href || '#';

      return (
        <div key={block.id} style={{ textAlign: 'center', margin: '16px 0' }}>
          <a
            href={buttonUrl}
            style={{
              display: 'inline-block',
              backgroundColor: style.backgroundColor || '#eab308',
              color: style.textColor || '#000',
              padding: '12px 30px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            {block.content}
          </a>
        </div>
      );

    case 'coupon':
      if (!metadata.couponValue) return null;
      const couponDisplay = metadata.couponType === 'percentage'
        ? `${metadata.couponValue}%`
        : `$${metadata.couponValue}`;
      const expiryText = metadata.couponExpiresAt
        ? `Expires: ${new Date(metadata.couponExpiresAt).toLocaleDateString()}`
        : '';

      return (
        <div
          key={block.id}
          style={{
            backgroundColor: style.backgroundColor || '#10B981',
            color: style.textColor || 'white',
            padding: '24px',
            borderRadius: '8px',
            textAlign: 'center',
            margin: '16px 0',
          }}
        >
          <div style={{ fontSize: '42px', fontWeight: 'bold', marginBottom: '8px' }}>
            {couponDisplay}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
            OFF your next visit!
          </div>
          {expiryText && (
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '12px' }}>
              {expiryText}
            </div>
          )}
        </div>
      );

    case 'service_card':
      return (
        <div
          key={block.id}
          style={{
            backgroundColor: style.backgroundColor || '#10B981',
            borderRadius: '12px',
            overflow: 'hidden',
            margin: '16px 0',
          }}
        >
          {/* Service Image */}
          {block.serviceImage ? (
            <div style={{ height: '140px', overflow: 'hidden' }}>
              <img
                src={block.serviceImage}
                alt={block.serviceName || 'Service'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                height: '100px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.2)',
              }}
            >
              <span style={{ fontSize: '32px' }}>🔧</span>
            </div>
          )}
          {/* Service Info */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#1a1a2e',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
              {block.serviceName || 'Featured Service'}
            </div>
            {block.servicePrice !== undefined && block.servicePrice !== null && (
              <div style={{ color: '#10B981', fontWeight: '600', marginTop: '4px' }}>
                ${typeof block.servicePrice === 'number' ? block.servicePrice.toFixed(2) : block.servicePrice}
              </div>
            )}
          </div>
        </div>
      );

    case 'image':
      return (
        <div key={block.id} style={{ textAlign: 'center', margin: '16px 0' }}>
          <img
            src={block.src}
            alt=""
            style={{ maxWidth: style.maxWidth || '100%', height: 'auto', borderRadius: '4px' }}
          />
        </div>
      );

    case 'divider':
      return <hr key={block.id} style={{ border: 'none', borderTop: '1px solid #444', margin: '16px 0' }} />;

    case 'spacer':
      return <div key={block.id} style={{ height: style.height || '16px' }} />;

    default:
      return null;
  }
};

// Marketing campaign content renderer
const MarketingCampaignContent: React.FC<{ metadata: any }> = ({ metadata }) => {
  const design = metadata.designContent;

  if (!design?.blocks || !Array.isArray(design.blocks)) {
    return <p className="text-gray-300">Campaign content not available</p>;
  }

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      {/* Styles for rich text content */}
      <style>{`
        .rich-text-content p { margin: 0 0 8px 0; }
        .rich-text-content ul, .rich-text-content ol { margin: 8px 0; padding-left: 24px; }
        .rich-text-content li { margin: 4px 0; }
        .rich-text-content strong, .rich-text-content b { font-weight: bold; }
        .rich-text-content em, .rich-text-content i { font-style: italic; }
        .rich-text-content u { text-decoration: underline; }
        .rich-text-content s, .rich-text-content strike { text-decoration: line-through; }
        .rich-text-content a { color: #10B981; text-decoration: underline; }
        .rich-text-content h1 { font-size: 24px; font-weight: bold; margin: 16px 0 8px 0; }
        .rich-text-content h2 { font-size: 20px; font-weight: bold; margin: 14px 0 6px 0; }
        .rich-text-content h3 { font-size: 18px; font-weight: bold; margin: 12px 0 4px 0; }
        .rich-text-content blockquote { border-left: 3px solid #10B981; padding-left: 12px; margin: 8px 0; color: #666; }
      `}</style>
      {/* Header */}
      {design.header?.enabled !== false && (
        <div
          className="p-6 text-center"
          style={{ backgroundColor: design.header?.backgroundColor || '#1a1a2e' }}
        >
          {design.header?.showLogo !== false && (
            <img
              src="/img/landing/repaircoin-icon.png"
              alt="RepairCoin"
              className="w-12 h-12 mx-auto mb-3"
            />
          )}
          <h1 className="text-white text-xl font-bold m-0">{metadata.shopName}</h1>
        </div>
      )}

      {/* Blocks - white background content area */}
      <div className="p-4 space-y-2">
        {design.blocks.map((block: any) => renderMarketingBlock(block, metadata))}
      </div>

      {/* Footer */}
      {(design.footer?.showSocial || design.footer?.showUnsubscribe) && (
        <div className="border-t border-gray-200 p-4 text-center text-sm text-gray-500 bg-gray-50">
          {design.footer?.showSocial && (
            <div className="mb-2">
              <span className="mx-2">Website</span>
              <span className="mx-2">Instagram</span>
              <span className="mx-2">Facebook</span>
            </div>
          )}
          {design.footer?.showUnsubscribe && (
            <p className="text-xs text-gray-500">
              You received this because you are a customer of {metadata.shopName}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const NotificationModal: React.FC<NotificationModalProps> = ({ notification, onClose, onDelete }) => {
  const isMarketingCampaign = notification.notificationType === 'marketing_campaign';

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reward_issued':
        return '🎉';
      case 'redemption_approval_request':
        return '🔔';
      case 'redemption_approved':
        return '✅';
      case 'redemption_rejected':
        return '❌';
      case 'redemption_cancelled':
        return '🚫';
      case 'token_gifted':
        return '🎁';
      case 'marketing_campaign':
        return '📢';
      case 'subscription_cancelled':
        return '⚠️';
      case 'subscription_self_cancelled':
        return '📋';
      case 'subscription_paused':
        return '⏸️';
      case 'subscription_resumed':
        return '▶️';
      case 'subscription_reactivated':
        return '🔄';
      default:
        return '📬';
    }
  };

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'reward_issued':
        return 'Reward Received';
      case 'redemption_approval_request':
        return 'Redemption Request';
      case 'redemption_approved':
        return 'Redemption Approved';
      case 'redemption_rejected':
        return 'Redemption Rejected';
      case 'redemption_cancelled':
        return 'Redemption Cancelled';
      case 'token_gifted':
        return 'Tokens Received';
      case 'marketing_campaign':
        return notification.metadata?.campaignName || 'Campaign';
      case 'subscription_cancelled':
        return 'Subscription Cancelled by Admin';
      case 'subscription_self_cancelled':
        return 'Subscription Cancellation Confirmed';
      case 'subscription_paused':
        return 'Subscription Paused';
      case 'subscription_resumed':
        return 'Subscription Resumed';
      case 'subscription_reactivated':
        return 'Subscription Reactivated';
      default:
        return 'Notification';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-[#1A1A1A] rounded-xl shadow-2xl max-w-lg w-full border border-[#FFCC00]/20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getNotificationIcon(notification.notificationType)}</span>
              <h3 className="text-xl font-semibold text-white">
                {getNotificationTitle(notification.notificationType)}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            {/* Marketing Campaign Content */}
            {isMarketingCampaign && notification.metadata?.designContent ? (
              <MarketingCampaignContent metadata={notification.metadata} />
            ) : (
              <>
                {/* Message */}
                <div>
                  <p className="text-gray-300 text-base leading-relaxed">
                    {notification.message}
                  </p>
                </div>

                {/* Subscription Cancelled by Admin Details */}
                {notification.notificationType === 'subscription_cancelled' && notification.metadata?.effectiveDate && (
                  <div className="space-y-3">
                    {/* Full Access Until */}
                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                      <p className="text-blue-300 text-sm">
                        <strong className="text-blue-400">Good news:</strong> You retain full platform access until{' '}
                        <span className="font-semibold">{new Date(notification.metadata.effectiveDate).toLocaleDateString()}</span>.
                      </p>
                    </div>

                    {/* Features Lost After */}
                    <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                      <p className="text-red-400 font-semibold text-sm mb-2">
                        After {new Date(notification.metadata.effectiveDate).toLocaleDateString()}, you will no longer be able to:
                      </p>
                      <ul className="space-y-1 text-sm text-red-300">
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Issue RCN rewards to customers
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Process customer redemptions
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Manage services in the marketplace
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Look up customer information
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Purchase RCN tokens
                        </li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-400 italic">
                        Note: You will still be able to view your purchase history and limited analytics.
                      </p>
                    </div>
                  </div>
                )}

                {/* Subscription Self-Cancelled Details */}
                {notification.notificationType === 'subscription_self_cancelled' && notification.metadata?.effectiveDate && (
                  <div className="space-y-3">
                    {/* Cancellation Reason */}
                    {notification.metadata.reason && (
                      <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3">
                        <p className="text-gray-400 text-sm">
                          <strong className="text-gray-300">Reason:</strong> {notification.metadata.reason}
                        </p>
                      </div>
                    )}

                    {/* Full Access Until */}
                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                      <p className="text-blue-300 text-sm">
                        <strong className="text-blue-400">Good news:</strong> You retain full platform access until{' '}
                        <span className="font-semibold">{new Date(notification.metadata.effectiveDate).toLocaleDateString()}</span>.
                      </p>
                    </div>

                    {/* Reactivation Info */}
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                      <p className="text-green-300 text-sm">
                        <strong className="text-green-400">Changed your mind?</strong> You can reactivate your subscription anytime before{' '}
                        <span className="font-semibold">{new Date(notification.metadata.effectiveDate).toLocaleDateString()}</span>{' '}
                        from your Subscription settings.
                      </p>
                    </div>

                    {/* Features Lost After */}
                    <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                      <p className="text-red-400 font-semibold text-sm mb-2">
                        After cancellation, you will no longer be able to:
                      </p>
                      <ul className="space-y-1 text-sm text-red-300">
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Issue RCN rewards to customers
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Process customer redemptions
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Manage services in the marketplace
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Look up customer information
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✕</span> Purchase RCN tokens
                        </li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-400 italic">
                        Note: You will still be able to view your purchase history and limited analytics.
                      </p>
                    </div>
                  </div>
                )}

                {/* Subscription Paused Details */}
                {notification.notificationType === 'subscription_paused' && (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                    <p className="text-yellow-300 text-sm">
                      Your subscription is paused. Platform features are temporarily unavailable. Contact support for more information.
                    </p>
                  </div>
                )}

                {/* Subscription Resumed Details */}
                {notification.notificationType === 'subscription_resumed' && (
                  <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                    <p className="text-green-300 text-sm">
                      Your subscription is now active. All platform features are available.
                    </p>
                  </div>
                )}

                {/* Subscription Reactivated Details */}
                {notification.notificationType === 'subscription_reactivated' && (
                  <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                    <p className="text-green-300 text-sm">
                      Your subscription has been reactivated. You now have full access to all platform features.
                    </p>
                  </div>
                )}

                {/* Other Metadata (for non-subscription notifications) */}
                {!['subscription_cancelled', 'subscription_self_cancelled', 'subscription_paused', 'subscription_resumed', 'subscription_reactivated'].includes(notification.notificationType) &&
                  notification.metadata && Object.keys(notification.metadata).length > 0 && (
                  <div className="bg-[#0D0D0D] rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-[#FFCC00] mb-2">Details</h4>

                    {notification.metadata.amount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Amount:</span>
                        <span className="text-white font-semibold">{notification.metadata.amount} RCN</span>
                      </div>
                    )}

                    {notification.metadata.shopName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Shop:</span>
                        <span className="text-white">{notification.metadata.shopName}</span>
                      </div>
                    )}

                    {notification.metadata.fromCustomerName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">From:</span>
                        <span className="text-white">{notification.metadata.fromCustomerName}</span>
                      </div>
                    )}

                    {notification.metadata.transactionId && (
                      <div className="text-sm">
                        <span className="text-gray-400">Transaction ID:</span>
                        <p className="text-white font-mono text-xs mt-1 break-all">
                          {notification.metadata.transactionId}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Timestamp */}
            <div className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">
            <button
              onClick={() => {
                onDelete(notification.id);
                onClose();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const { notifications, unreadCount, isConnected } = useNotificationStore();
  const { markAsRead, markAllAsRead, deleteNotification } = useNotificationActions();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reward_issued':
        return '🎉';
      case 'redemption_approval_request':
        return '🔔';
      case 'redemption_approved':
        return '✅';
      case 'redemption_rejected':
        return '❌';
      case 'redemption_cancelled':
        return '🚫';
      case 'token_gifted':
        return '🎁';
      case 'marketing_campaign':
        return '📢';
      case 'subscription_cancelled':
        return '⚠️';
      case 'subscription_self_cancelled':
        return '📋';
      case 'subscription_paused':
        return '⏸️';
      case 'subscription_resumed':
        return '▶️';
      case 'subscription_reactivated':
        return '🔄';
      default:
        return '📬';
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setSelectedNotification(notification);
    setIsOpen(false);
  };

  return (
    <>
      <div className="relative">
        {/* Bell Icon Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-400 hover:text-[#FFCC00] transition-colors"
          aria-label="Notifications"
        >
          {/* Bell Icon */}
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Connection Status Indicator */}
          {isConnected && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white" />
          )}
        </button>

        {/* Notifications Dropdown */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Dropdown Panel */}
            <div className="absolute right-0 z-50 mt-2 w-96 bg-[#1A1A1A] rounded-xl shadow-2xl border border-[#FFCC00]/20 max-h-[600px] flex flex-col">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-[#FFCC00] hover:text-[#FFD700] transition-colors font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <div className="text-5xl mb-3">🔔</div>
                    <p className="text-gray-400 font-medium">No notifications yet</p>
                    <p className="text-sm text-gray-500 mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-800">
                    {notifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`px-4 py-3 hover:bg-[#0D0D0D] transition-colors cursor-pointer ${
                          !notification.isRead ? 'bg-[#FFCC00]/5 border-l-2 border-[#FFCC00]' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="flex-shrink-0 text-2xl">
                            {getNotificationIcon(notification.notificationType)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm ${
                                notification.isRead
                                  ? 'text-gray-400'
                                  : 'text-white font-medium'
                              }`}
                            >
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </p>

                            {/* Additional metadata */}
                            {notification.metadata?.amount && (
                              <span className="inline-block mt-1 px-2 py-1 bg-[#FFCC00]/20 text-[#FFCC00] text-xs rounded font-semibold">
                                {notification.metadata.amount} RCN
                              </span>
                            )}
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="flex-shrink-0 text-gray-500 hover:text-red-500 transition-colors"
                            aria-label="Delete notification"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>

                          {/* Unread Indicator */}
                          {!notification.isRead && (
                            <div className="flex-shrink-0 w-2 h-2 bg-[#FFCC00] rounded-full" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-700 text-center">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <NotificationModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onDelete={deleteNotification}
        />
      )}
    </>
  );
};
