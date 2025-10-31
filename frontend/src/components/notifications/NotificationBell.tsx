'use client';

import React, { useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationModalProps {
  notification: any;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ notification, onClose, onDelete }) => {
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
      case 'token_gifted':
        return '🎁';
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
      case 'token_gifted':
        return 'Tokens Received';
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
            {/* Message */}
            <div>
              <p className="text-gray-300 text-base leading-relaxed">
                {notification.message}
              </p>
            </div>

            {/* Metadata */}
            {notification.metadata && Object.keys(notification.metadata).length > 0 && (
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
  const { markAsRead, markAllAsRead, deleteNotification } = useNotifications();

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
      case 'token_gifted':
        return '🎁';
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
