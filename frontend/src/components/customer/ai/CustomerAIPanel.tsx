"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2, Camera, User, Bot as BotIcon, Star, MapPin, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useAIChatStore } from "@/stores/aiChatStore";
import {
  startChatSession,
  sendMessage,
  uploadImage,
} from "@/services/api/aiAssistant";
import toast from "react-hot-toast";

/**
 * CustomerAIPanel
 *
 * The main chat interface for the AI Repair Assistant.
 * Matches the shop AI panel structure but focused on customer diagnostics.
 */
export const CustomerAIPanel: React.FC = () => {
  const router = useRouter();
  const {
    messages,
    isLoading,
    session,
    addMessage,
    setLoading,
    initializeSession
  } = useAIChatStore();
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionInitializedRef = useRef(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session on mount if needed
  useEffect(() => {
    const initSession = async () => {
      if (!session && !sessionInitializedRef.current) {
        sessionInitializedRef.current = true;
        try {
          const response = await startChatSession({});
          if (response.success) {
            initializeSession({
              id: response.data.sessionId,
              sessionToken: response.data.sessionToken,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastActivityAt: new Date().toISOString(),
            });
            // Add the welcome message from the API
            addMessage({
              ...response.data.message,
              timestamp: new Date(response.data.message.timestamp),
            });
          }
        } catch (error) {
          console.error('Failed to initialize session:', error);
        }
      }
    };
    initSession();
  }, [session, initializeSession, addMessage]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !session) return;

    const userMessage = input.trim();
    setInput("");

    setLoading(true);

    try {
      const response = await sendMessage({
        sessionId: session.id,
        sessionToken: session.sessionToken,
        message: userMessage,
      });

      if (response.success) {
        // Add both user and assistant messages
        addMessage({
          ...response.data.userMessage,
          timestamp: new Date(response.data.userMessage.timestamp),
        });
        addMessage({
          ...response.data.assistantMessage,
          timestamp: new Date(response.data.assistantMessage.timestamp),
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    setLoading(true);

    try {
      const response = await uploadImage({
        sessionId: session.id,
        sessionToken: session.sessionToken,
        image: file,
      });

      if (response.success) {
        // Add assistant message with analysis
        addMessage({
          ...response.data.assistantMessage,
          timestamp: new Date(response.data.assistantMessage.timestamp),
        });
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error("Failed to analyze image. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: "Cracked Screen", emoji: "📱" },
    { label: "Battery Issue", emoji: "🔋" },
    { label: "Water Damage", emoji: "💧" },
    { label: "Won't Turn On", emoji: "⚡" },
  ];

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  return (
    <div className="flex flex-col h-full mt-4">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* Avatar */}
            {message.role === "assistant" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <BotIcon className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={`max-w-[75%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              {/* Image if present */}
              {message.imageUrl && (
                <img
                  src={message.imageUrl}
                  alt="Uploaded"
                  className="rounded-lg mb-2 max-w-full h-auto"
                />
              )}

              {/* Message content */}
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>

              {/* Service Recommendations - Clickable Cards */}
              {message.metadata?.services && message.metadata.services.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.metadata.services.map((service: any) => (
                    <div
                      key={service.serviceId}
                      onClick={() => router.push(`/marketplace?service=${service.serviceId}`)}
                      className="bg-gray-900 hover:bg-gray-850 rounded-lg p-3 cursor-pointer transition-colors border border-gray-700 hover:border-blue-500 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                              {service.serviceName}
                            </h4>
                            <ExternalLink className="w-3 h-3 text-gray-500 flex-shrink-0 group-hover:text-blue-400" />
                          </div>
                          <p className="text-xs text-gray-400 mb-2">
                            {service.shopName}
                          </p>
                          {service.description && (
                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                              {service.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs">
                            {service.rating > 0 && (
                              <div className="flex items-center gap-1 text-yellow-400">
                                <Star className="w-3 h-3 fill-current" />
                                <span>{service.rating.toFixed(1)}</span>
                                <span className="text-gray-500">({service.reviewCount})</span>
                              </div>
                            )}
                            {service.estimatedDuration && (
                              <div className="flex items-center gap-1 text-gray-400">
                                <Clock className="w-3 h-3" />
                                <span>{service.estimatedDuration}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-lg font-bold text-green-400">
                            ${service.price.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Metadata (cost estimates, device info) */}
              {message.metadata && !message.metadata.services && (
                <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                  {message.metadata.estimatedCost && (
                    <div className="text-xs text-green-400">
                      💰 Estimated Cost: {message.metadata.estimatedCost}
                    </div>
                  )}
                  {message.metadata.deviceType && (
                    <div className="text-xs text-gray-400">
                      Device: {message.metadata.deviceType}
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div
                className={`text-[10px] mt-1 ${
                  message.role === "user" ? "text-blue-200" : "text-gray-500"
                }`}
              >
                {format(message.timestamp, "HH:mm")}
              </div>
            </div>

            {/* User Avatar */}
            {message.role === "user" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BotIcon className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
                <span
                  className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 py-3 border-t border-gray-800">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.label)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.emoji} {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex gap-2">
          {/* Image Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || uploading}
            className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Upload image"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </button>

          {/* Text Input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Describe the issue or upload a photo..."
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              minHeight: "42px",
              maxHeight: "120px",
            }}
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Character counter (optional) */}
        {input.length > 200 && (
          <div className="text-xs text-gray-500 mt-1 text-right">
            {input.length} / 500
          </div>
        )}
      </div>
    </div>
  );
};
