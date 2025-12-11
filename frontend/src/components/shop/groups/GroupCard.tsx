"use client";

import { Users, Globe, Eye, Plus, Crown, UserCheck, Coins, Settings, Dumbbell, Wrench, Heart, Sparkles } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface GroupCardProps {
  group: shopGroupsAPI.AffiliateShopGroup;
  onClick: () => void;
  showMemberBadge?: boolean;
  isLeader?: boolean;
  isDiscoverTab?: boolean;
  onJoinClick?: (e: React.MouseEvent) => void;
}

// Category icon mapping
const getCategoryIcon = (category?: string) => {
  const categoryLower = category?.toLowerCase() || "";
  if (categoryLower.includes("fitness") || categoryLower.includes("training")) {
    return <Dumbbell className="w-5 h-5 text-white" />;
  }
  if (categoryLower.includes("tech") || categoryLower.includes("repair")) {
    return <Settings className="w-5 h-5 text-white" />;
  }
  if (categoryLower.includes("home") || categoryLower.includes("auto")) {
    return <Wrench className="w-5 h-5 text-white" />;
  }
  if (categoryLower.includes("health") || categoryLower.includes("wellness")) {
    return <Heart className="w-5 h-5 text-white" />;
  }
  if (categoryLower.includes("beauty") || categoryLower.includes("care")) {
    return <Sparkles className="w-5 h-5 text-white" />;
  }
  return <Settings className="w-5 h-5 text-white" />;
};

export default function GroupCard({
  group,
  onClick,
  showMemberBadge,
  isLeader,
  isDiscoverTab = false,
  onJoinClick
}: GroupCardProps) {
  // Determine the role to display
  const role = isLeader ? "Leader" : showMemberBadge ? "Member" : null;

  // Get group visibility
  const isPublic = group.isPublic !== false;

  // Get category from group or use default
  const category = group.category || "General";

  return (
    <div
      onClick={onClick}
      className="bg-[#101010] rounded-xl p-6 cursor-pointer hover:ring-1 hover:ring-[#FFCC00]/50 transition-all w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Group Icon */}
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
            {getCategoryIcon(category)}
          </div>

          {/* Group Name */}
          <h3 className="text-lg font-semibold text-white truncate">
            {group.groupName}
          </h3>
        </div>

        {/* Role Badge */}
        {role && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
            role === "Leader"
              ? "bg-[#242424] text-[#FFCC00]"
              : "bg-[#242424] text-[#FFCC00]"
          }`}>
            {role === "Leader" ? (
              <Crown className="w-3.5 h-3.5" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
            <span>{role}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#999999]/55 mb-3" />

      {/* Description */}
      {group.description && (
        <p className="text-white text-sm mb-4 line-clamp-2 leading-relaxed">
          {group.description}
        </p>
      )}

      {/* Chips Row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Token Chip */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#242424] rounded-full shadow-sm">
          <Coins className="w-4 h-4 text-white" />
          <span className="text-xs text-white font-medium">
            {group.customTokenSymbol}• {group.customTokenName}
          </span>
        </div>

        {/* Category Chip */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#242424] rounded-full shadow-sm">
          {getCategoryIcon(category)}
          <span className="text-xs text-white font-medium">
            {category}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Members Count */}
          <div className="flex items-center gap-1.5 text-[#999]">
            <Users className="w-4 h-4" />
            <span className="text-sm">
              {group.memberCount || 0} {(group.memberCount || 0) === 1 ? "Member" : "Members"}
            </span>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-1.5 text-[#999]">
            <Globe className="w-4 h-4" />
            <span className="text-sm">
              {isPublic ? "Public Group" : "Private Group"}
            </span>
          </div>
        </div>

        {/* Action Button */}
        {isDiscoverTab && !showMemberBadge ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoinClick?.(e);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFCC00] text-[#1f1f1f] rounded-full text-xs font-medium shadow-sm hover:bg-[#FFD700] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Join Group</span>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFCC00] text-[#1f1f1f] rounded-full text-xs font-medium shadow-sm hover:bg-[#FFD700] transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>View Group</span>
          </button>
        )}
      </div>
    </div>
  );
}
