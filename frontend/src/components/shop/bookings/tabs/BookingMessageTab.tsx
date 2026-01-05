"use client";

import React, { useState } from "react";
import { MessageSquare, Send, Edit2, Instagram, MessageCircle, Phone, Facebook } from "lucide-react";
import { MockBooking, Message, MessageChannel, formatDateTime, quickReplies } from "../mockData";

interface BookingMessageTabProps {
  booking: MockBooking;
  onSendMessage: (message: string) => void;
}

const ChannelIcon: React.FC<{ channel?: MessageChannel }> = ({ channel }) => {
  const iconClass = "w-4 h-4";

  switch (channel) {
    case 'instagram':
      return <Instagram className={`${iconClass} text-pink-400`} />;
    case 'whatsapp':
      return <MessageCircle className={`${iconClass} text-green-400`} />;
    case 'sms':
      return <Phone className={`${iconClass} text-blue-400`} />;
    case 'facebook':
      return <Facebook className={`${iconClass} text-blue-500`} />;
    default:
      return null;
  }
};

export const BookingMessageTab: React.FC<BookingMessageTabProps> = ({ booking, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleQuickReply = (reply: string) => {
    setNewMessage(reply);
  };

  const lastMessageTime = booking.messages.length > 0
    ? formatDateTime(booking.messages[booking.messages.length - 1].timestamp)
    : 'No messages yet';

  return (
    <div className="flex flex-col h-full">
      {/* Unified Messages Header */}
      <div className="p-4 bg-[#0D0D0D] rounded-xl border border-gray-800 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h4 className="text-white font-medium">Unified Messages</h4>
        </div>
        <p className="text-gray-500 text-sm">Last message: {lastMessageTime}</p>

        {/* Channel Info */}
        <div className="mt-3 p-3 bg-[#1A1A1A] rounded-lg border border-gray-700">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 text-lg">ℹ️</span>
            <p className="text-sm text-yellow-400/80">
              Channel-agnostic thread. FB/IG/WhatsApp/SMS all normalize into the same Conversation object.
            </p>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[200px] max-h-[300px]">
        {booking.messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No messages yet</p>
            <p className="text-gray-600 text-sm">Start the conversation with your customer</p>
          </div>
        ) : (
          booking.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'shop' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${message.sender === 'shop' ? 'order-2' : ''}`}>
                <div
                  className={`p-3 rounded-xl ${
                    message.sender === 'shop'
                      ? 'bg-[#FFCC00] text-black rounded-br-sm'
                      : 'bg-[#2A2A2A] text-white rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
                <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                  message.sender === 'shop' ? 'justify-end' : 'justify-start'
                }`}>
                  {message.sender === 'customer' && (
                    <>
                      <span>{booking.customerName}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formatDateTime(message.timestamp)}</span>
                  {message.channel && (
                    <>
                      <span>•</span>
                      <ChannelIcon channel={message.channel} />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Replies */}
      <div className="mb-4 p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <h4 className="text-white font-medium text-sm">Quick Replies</h4>
          </div>
          <button className="p-1 hover:bg-gray-800 rounded transition-colors">
            <Edit2 className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="space-y-2">
          {quickReplies.map((reply, index) => (
            <button
              key={index}
              onClick={() => handleQuickReply(reply)}
              className="w-full p-2 text-left text-sm text-gray-300 bg-[#1A1A1A] rounded-lg hover:bg-[#2A2A2A] transition-colors truncate"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 bg-[#1A1A1A] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className="px-4 py-3 bg-[#FFCC00] text-black rounded-xl hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
