"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  X,
  MoreVertical,
  Info,
  Check,
  CheckCheck,
  Smile,
  CheckCircle,
  RotateCcw,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderType: "customer" | "shop";
  content: string;
  timestamp: string;
  status: "sending" | "sent" | "delivered" | "read";
  attachments?: {
    type: "image" | "file";
    url: string;
    name: string;
  }[];
  isSystemMessage?: boolean;
  messageType?: "text" | "service_link" | "booking_link" | "system";
  metadata?: Record<string, any>;
}

interface ConversationThreadProps {
  conversationId: string;
  messages: Message[];
  participantName: string;
  participantAvatar?: string;
  serviceName: string;
  isOnline?: boolean;
  isTyping?: boolean;
  currentUserId: string;
  currentUserType: "customer" | "shop";
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>;
  onLoadMore?: () => void;
  conversationStatus?: "active" | "resolved" | "archived";
  onArchiveConversation?: (archived: boolean) => Promise<void>;
  conversationDetails?: {
    id: string;
    customerId?: string;
    customerName?: string;
    shopId?: string;
    shopName?: string;
    lastMessageTime: string;
    unreadCount: number;
  };
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  conversationId,
  messages,
  participantName,
  participantAvatar,
  serviceName,
  isOnline,
  isTyping,
  currentUserId,
  currentUserType,
  onSendMessage,
  onLoadMore,
  conversationStatus,
  onArchiveConversation,
  conversationDetails,
}) => {
  const [messageInput, setMessageInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Close more menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // Reset avatar error when participant changes
  useEffect(() => {
    setAvatarError(false);
  }, [participantAvatar]);

  const handleSend = async () => {
    if (!messageInput.trim() && selectedFiles.length === 0) return;
    if (isSending) return; // Prevent double-sending

    try {
      setIsSending(true);
      if (selectedFiles.length > 0) setIsUploading(true);
      setSendError(null);
      await onSendMessage(messageInput.trim(), selectedFiles);
      // Only clear on success
      setMessageInput("");
      setSelectedFiles([]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setSendError(error?.message || "Failed to send message. Please try again.");
      // Keep the message in the input box for retry
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_FILES = 5;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    // Limit to 5 files
    if (files.length > MAX_FILES) {
      setSendError(`Maximum ${MAX_FILES} files allowed.`);
      return;
    }

    // Validate file sizes
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setSendError(`${oversized.map(f => f.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} 5MB limit.`);
      return;
    }

    setSendError(null);
    setSelectedFiles(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    messages.forEach((message) => {
      const messageDate = formatDate(message.timestamp);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1A1A1A]">
        <div className="flex items-center gap-3">
          {/* Avatar - Show shop logo if available, otherwise show initial */}
          <div className="relative">
            {participantAvatar && !avatarError ? (
              <img
                src={participantAvatar}
                alt={participantName}
                className="w-10 h-10 rounded-full object-cover bg-[#0A0A0A]"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-[#FFCC00] to-[#FFD700] rounded-full flex items-center justify-center">
                <span className="text-black font-bold">
                  {participantName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1A1A1A]"></div>
            )}
          </div>

          {/* Info */}
          <div>
            <h3 className="text-sm font-semibold text-white">{participantName}</h3>
            <p className="text-xs text-gray-400">
              {isTyping ? (
                <span className="text-[#FFCC00]">typing...</span>
              ) : isOnline ? (
                "Online"
              ) : (
                serviceName
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {conversationStatus === "resolved" && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
              Resolved
            </span>
          )}
          <button
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className={`p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors ${showInfoPanel ? 'bg-[#0A0A0A]' : ''}`}
          >
            <Info className={`w-5 h-5 ${showInfoPanel ? 'text-[#FFCC00]' : 'text-gray-400'}`} />
          </button>
          {onArchiveConversation && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1A1A1A] border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  {conversationStatus === "resolved" ? (
                    <button
                      onClick={() => { onArchiveConversation(false); setShowMoreMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#0A0A0A] hover:text-white flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reopen Conversation
                    </button>
                  ) : (
                    <button
                      onClick={() => { onArchiveConversation(true); setShowMoreMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#0A0A0A] hover:text-white flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Resolve Conversation
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      {showInfoPanel && (
        <div className="border-b border-gray-800 bg-[#111111] p-4 animate-in slide-in-from-top">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Participant</p>
              <p className="text-sm text-white font-medium">{participantName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <p className={`text-sm font-medium ${conversationStatus === 'resolved' ? 'text-green-400' : 'text-[#FFCC00]'}`}>
                {conversationStatus === 'resolved' ? 'Resolved' : 'Active'}
              </p>
            </div>
            {conversationDetails?.customerId && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Customer Address</p>
                <p className="text-sm text-gray-300 font-mono truncate">{conversationDetails.customerId}</p>
              </div>
            )}
            {conversationDetails?.shopName && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Shop</p>
                <p className="text-sm text-gray-300">{conversationDetails.shopName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Messages</p>
              <p className="text-sm text-white">{messages.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Unread</p>
              <p className="text-sm text-white">{conversationDetails?.unreadCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Last Activity</p>
              <p className="text-sm text-gray-300">
                {conversationDetails?.lastMessageTime
                  ? new Date(conversationDetails.lastMessageTime).toLocaleString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Conversation ID</p>
              <p className="text-sm text-gray-500 font-mono truncate">{conversationId}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Date Divider */}
            <div className="flex items-center justify-center mb-4">
              <div className="bg-[#1A1A1A] px-3 py-1 rounded-full">
                <span className="text-xs text-gray-400 font-medium">{group.date}</span>
              </div>
            </div>

            {/* Messages for this date */}
            <div className="space-y-4">
              {group.messages.map((message) => {
                const isOwnMessage = message.senderType === currentUserType;

                if (message.isSystemMessage) {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="bg-[#1A1A1A] px-4 py-2 rounded-lg max-w-md">
                        <p className="text-xs text-gray-400 text-center">{message.content}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar (only for received messages) - Show shop logo if available */}
                      {!isOwnMessage && (
                        participantAvatar && !avatarError ? (
                          <img
                            src={participantAvatar}
                            alt={message.senderName}
                            className="w-8 h-8 rounded-full object-cover bg-[#0A0A0A] flex-shrink-0"
                            onError={() => setAvatarError(true)}
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                              {message.senderName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )
                      )}

                      {/* Message Bubble */}
                      <div>
                        <div
                          className={`rounded-2xl p-3 ${
                            isOwnMessage
                              ? "bg-gradient-to-br from-[#FFCC00] to-[#FFD700] text-black"
                              : "bg-[#1A1A1A] text-white border border-gray-800"
                          }`}
                        >
                          {/* Service Link Card */}
                          {message.messageType === "service_link" && message.metadata && (
                            <div className="mb-2">
                              <div className={`rounded-lg overflow-hidden border ${
                                isOwnMessage
                                  ? "border-black/20 bg-black/10"
                                  : "border-gray-700 bg-[#0A0A0A]"
                              }`}>
                                {/* Service Image */}
                                {message.metadata.serviceImage && (
                                  <div className="w-full aspect-[4/3] overflow-hidden bg-gray-800">
                                    <img
                                      src={message.metadata.serviceImage}
                                      alt={message.metadata.serviceName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                {/* Service Details */}
                                <div className="p-3">
                                  <h4 className={`font-semibold text-sm mb-1 ${
                                    isOwnMessage ? "text-black" : "text-white"
                                  }`}>
                                    {message.metadata.serviceName}
                                  </h4>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-xs ${
                                      isOwnMessage ? "text-black/70" : "text-gray-400"
                                    }`}>
                                      {message.metadata.serviceCategory}
                                    </span>
                                    <span className={`text-sm font-bold ${
                                      isOwnMessage ? "text-black" : "text-[#FFCC00]"
                                    }`}>
                                      ${message.metadata.servicePrice}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Booking Link Card */}
                          {message.messageType === "booking_link" && message.metadata && (
                            <div className="mb-2">
                              <div className={`rounded-lg overflow-hidden border ${
                                isOwnMessage
                                  ? "border-black/20 bg-black/10"
                                  : "border-gray-700 bg-[#0A0A0A]"
                              }`}>
                                {message.metadata.serviceImage && (
                                  <div className="w-full aspect-[4/3] overflow-hidden bg-gray-800">
                                    <img
                                      src={message.metadata.serviceImage}
                                      alt={message.metadata.serviceName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="p-3">
                                  <h4 className={`font-semibold text-sm mb-1 ${
                                    isOwnMessage ? "text-black" : "text-white"
                                  }`}>
                                    {message.metadata.shopName || message.metadata.serviceName}
                                  </h4>
                                  <div className={`space-y-1 text-xs ${
                                    isOwnMessage ? "text-black/70" : "text-gray-400"
                                  }`}>
                                    <p>Service: {message.metadata.serviceName}</p>
                                    <p>Price: ${message.metadata.servicePrice}</p>
                                    {message.metadata.serviceCategory && (
                                      <p>Category: {message.metadata.serviceCategory}</p>
                                    )}
                                    {message.metadata.bookingDate && (
                                      <p className={`font-medium ${
                                        isOwnMessage ? "text-black" : "text-[#FFCC00]"
                                      }`}>
                                        {message.metadata.bookingDate}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 space-y-2">
                              {message.attachments.map((attachment, index) => (
                                <div key={index}>
                                  {attachment.type === "image" ? (
                                    <a
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block cursor-pointer"
                                    >
                                      <img
                                        src={attachment.url}
                                        alt={attachment.name}
                                        className="rounded-lg max-w-full max-h-64 object-cover hover:opacity-90 transition-opacity"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={attachment.name}
                                      className={`flex items-center gap-2 p-2 rounded-lg hover:opacity-80 transition-opacity ${
                                        isOwnMessage ? "bg-black/10" : "bg-white/5"
                                      }`}
                                    >
                                      <Paperclip className="w-4 h-4 flex-shrink-0" />
                                      <span className="text-sm truncate">{attachment.name}</span>
                                      <span className={`text-xs ml-auto flex-shrink-0 ${
                                        isOwnMessage ? "text-black/50" : "text-gray-500"
                                      }`}>Download</span>
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Message Content */}
                          {message.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          )}
                        </div>

                        {/* Timestamp and Status */}
                        <div
                          className={`flex items-center gap-1 mt-1 ${
                            isOwnMessage ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span className="text-xs text-gray-500">
                            {formatTime(message.timestamp)}
                          </span>
                          {isOwnMessage && (
                            <span>
                              {message.status === "read" ? (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                              ) : message.status === "delivered" ? (
                                <CheckCheck className="w-3 h-3 text-gray-500" />
                              ) : message.status === "sent" ? (
                                <Check className="w-3 h-3 text-gray-500" />
                              ) : (
                                <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              {participantAvatar && !avatarError ? (
                <img
                  src={participantAvatar}
                  alt={participantName}
                  className="w-8 h-8 rounded-full object-cover bg-[#0A0A0A]"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {participantName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-3 flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-800 bg-[#1A1A1A]">
          {isUploading && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#FFCC00]">Uploading {selectedFiles.length} file(s)...</span>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="relative flex-shrink-0 w-20 h-20 bg-[#0A0A0A] rounded-lg border border-gray-700"
              >
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className={`w-full h-full object-cover rounded-lg ${isUploading ? 'opacity-50' : ''}`}
                  />
                ) : (
                  <div className={`w-full h-full flex flex-col items-center justify-center gap-1 ${isUploading ? 'opacity-50' : ''}`}>
                    <Paperclip className="w-5 h-5 text-gray-500" />
                    <span className="text-[10px] text-gray-500 truncate w-full text-center px-1">{file.name.split('.').pop()?.toUpperCase()}</span>
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!isUploading && (
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-20 right-4 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={"dark" as any}
            width={320}
            height={400}
            searchPlaceholder="Search emoji..."
            lazyLoadEmojis
          />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-[#1A1A1A]">
        {/* Error Message */}
        {sendError && (
          <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start justify-between">
            <div className="flex-1">
              <p className="text-red-400 text-sm">{sendError}</p>
            </div>
            <button
              onClick={() => setSendError(null)}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Paperclip className="w-5 h-5 text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Message Input */}
          <div className={`flex-1 bg-[#0A0A0A] border rounded-lg focus-within:ring-2 focus-within:ring-[#FFCC00] focus-within:border-transparent ${
            sendError ? 'border-red-500/50' : 'border-gray-700'
          }`}>
            <textarea
              ref={textareaRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              disabled={isSending}
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-32 disabled:opacity-50"
              style={{
                minHeight: "44px",
                height: "auto",
              }}
            />
          </div>

          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={isSending}
            className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Smile className="w-5 h-5 text-gray-400" />
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={(!messageInput.trim() && selectedFiles.length === 0) || isSending}
            className="p-3 bg-gradient-to-br from-[#FFCC00] to-[#FFD700] rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-black" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
