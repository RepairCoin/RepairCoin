"use client";

import React, { useState } from "react";
import { MessagesContainer } from "@/components/messaging/MessagesContainer";
import {
  MessageCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  Filter,
  Download,
} from "lucide-react";

interface MessagesTabProps {
  shopId: string;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ shopId }) => {
  const [showStats, setShowStats] = useState(true);

  // Mock stats - replace with actual data
  const messageStats = {
    totalConversations: 24,
    activeToday: 5,
    avgResponseTime: "12 min",
    satisfactionRate: "98%",
  };

  return (
    <div className="h-full flex flex-col">
      {/* Stats Cards (Collapsible) */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <MessageCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{messageStats.totalConversations}</p>
                <p className="text-xs text-gray-400">Total Conversations</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{messageStats.activeToday}</p>
                <p className="text-xs text-gray-400">Active Today</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{messageStats.avgResponseTime}</p>
                <p className="text-xs text-gray-400">Avg Response Time</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{messageStats.satisfactionRate}</p>
                <p className="text-xs text-gray-400">Satisfaction Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="px-3 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showStats ? "Hide" : "Show"} Stats
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="px-3 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 bg-[#1A1A1A] border border-gray-800 rounded-lg overflow-hidden">
        <MessagesContainer userType="shop" currentUserId={shopId} />
      </div>

      {/* Help Text */}
      <div className="mt-4 bg-gradient-to-r from-[#FFCC00]/10 to-[#FFD700]/10 border border-[#FFCC00]/20 rounded-lg p-3">
        <p className="text-xs text-gray-400">
          💡 <span className="font-semibold text-white">Pro Tip:</span> Quick responses improve customer satisfaction and increase booking conversions by up to 40%
        </p>
      </div>
    </div>
  );
};
