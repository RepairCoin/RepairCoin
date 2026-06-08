"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2, Camera, User, Bot as BotIcon } from "lucide-react";
import { format } from "date-fns";
import { useAIChatStore } from "@/stores/aiChatStore";
import { sendMessage, analyzeImage } from "@/services/api/aiAssistant";
import toast from "react-hot-toast";

/**
 * CustomerAIPanel
 *
 * The main chat interface for the AI Repair Assistant.
 * Matches the shop AI panel structure but focused on customer diagnostics.
 */
export const CustomerAIPanel: React.FC = () => {
  const { messages, isLoading, addMessage, setLoading } = useAIChatStore();
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send initial greeting if no messages
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: "welcome",
        role: "assistant",
        content:
          "👋 Hi! I'm your AI repair assistant. Tell me what's wrong with your device, or upload a photo of the damage, and I'll help you find the right repair service and estimate the cost.",
        timestamp: new Date(),
      });
    }
  }, [messages.length, addMessage]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message
    addMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });

    setLoading(true);

    try {
      const response = await sendMessage(userMessage);

      addMessage({
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        metadata: response.metadata,
      });
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    try {
      // Convert to base64 for API
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        // Add user message with image
        addMessage({
          id: `user-img-${Date.now()}`,
          role: "user",
          content: `[Uploaded image: ${file.name}]`,
          imageUrl: base64,
          timestamp: new Date(),
        });

        setLoading(true);

        try {
          const response = await analyzeImage(base64);

          addMessage({
            id: `ai-img-${Date.now()}`,
            role: "assistant",
            content: response.message,
            timestamp: new Date(),
            metadata: response.metadata,
          });
        } catch (error) {
          toast.error("Failed to analyze image. Please try again.");
        } finally {
          setLoading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
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

              {/* Metadata (cost estimates, services, etc.) */}
              {message.metadata && (
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
                  {message.metadata.recommendedServices &&
                    message.metadata.recommendedServices.length > 0 && (
                      <div className="text-xs text-gray-400">
                        Recommended services:{" "}
                        {message.metadata.recommendedServices.join(", ")}
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
