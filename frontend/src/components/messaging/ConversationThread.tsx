"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  X,
  MoreVertical,
  Phone,
  Video,
  Info,
  Check,
  CheckCheck,
  Smile,
} from "lucide-react";

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
  onSendMessage: (content: string, attachments?: File[]) => void;
  onLoadMore?: () => void;
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
}) => {
  const [messageInput, setMessageInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = () => {
    if (messageInput.trim() || selectedFiles.length > 0) {
      onSendMessage(messageInput.trim(), selectedFiles);
      setMessageInput("");
      setSelectedFiles([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
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
    <div className="flex flex-col h-full bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1A1A1A]">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FFCC00] to-[#FFD700] rounded-full flex items-center justify-center">
              <span className="text-black font-bold">
                {participantName.charAt(0).toUpperCase()}
              </span>
            </div>
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
          <button className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors">
            <Phone className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors">
            <Video className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors">
            <Info className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

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
                      {/* Avatar (only for received messages) */}
                      {!isOwnMessage && (
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">
                            {message.senderName.charAt(0).toUpperCase()}
                          </span>
                        </div>
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
                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 space-y-2">
                              {message.attachments.map((attachment, index) => (
                                <div key={index}>
                                  {attachment.type === "image" ? (
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name}
                                      className="rounded-lg max-w-full max-h-64 object-cover"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                                      <Paperclip className="w-4 h-4" />
                                      <span className="text-sm truncate">{attachment.name}</span>
                                    </div>
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
              <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {participantName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-3 flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-800 bg-[#1A1A1A]">
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
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Paperclip className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-[#1A1A1A]">
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors flex-shrink-0"
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
          <div className="flex-1 bg-[#0A0A0A] border border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-[#FFCC00] focus-within:border-transparent">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-32"
              style={{
                minHeight: "44px",
                height: "auto",
              }}
            />
          </div>

          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors flex-shrink-0"
          >
            <Smile className="w-5 h-5 text-gray-400" />
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!messageInput.trim() && selectedFiles.length === 0}
            className="p-3 bg-gradient-to-br from-[#FFCC00] to-[#FFD700] rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
};
