"use client";

import { Users, Globe, Eye, Plus, Crown, UserCheck, Coins } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import { getCategoryIcon } from "./utils/categoryIcons";

interface GroupCardProps {
  group: shopGroupsAPI.AffiliateShopGroup;
  onClick: () => void;
  showMemberBadge?: boolean;
  isLeader?: boolean;
  isDiscoverTab?: boolean;
  onJoinClick?: (e: React.MouseEvent) => void;
}

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
      className="bg-[#101010] border border-[#333] rounded-xl p-4 sm:p-6 cursor-pointer hover:ring-1  hover:ring-[#FFCC00]/50 transition-all w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Group Icon */}
          <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
            {getCategoryIcon(category)}
          </div>

          {/* Group Name */}
          <h3 className="text-base sm:text-lg font-semibold text-white truncate">
            {group.groupName}
          </h3>
        </div>

        {/* Role Badge */}
        {role && (
          <div className={`flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
            role === "Leader"
              ? "bg-[#242424] text-[#FFCC00]"
              : "bg-[#242424] text-[#FFCC00]"
          }`}>
            {role === "Leader" ? (
              <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
            <span>{role}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#999999]/55 mb-3" />

      {/* Description */}
      {group.description && (
        <p className="text-white text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2 leading-relaxed">
          {group.description}
        </p>
      )}

      {/* Chips Row */}
      <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
        {/* Token Chip */}
        <div className="flex items-center gap-1.5 px-2 py-1 sm:py-1.5 bg-[#242424] rounded-full shadow-sm max-w-full">
          <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
          <span className="text-[11px] sm:text-xs text-white font-medium truncate">
            {group.customTokenSymbol}• {group.customTokenName}
          </span>
        </div>

        {/* Category Chip */}
        <div className="flex items-center gap-1.5 px-2 py-1 sm:py-1.5 bg-[#242424] rounded-full shadow-sm">
          {getCategoryIcon(category, "w-3.5 h-3.5 sm:w-4 sm:h-4 text-white")}
          <span className="text-[11px] sm:text-xs text-white font-medium">
            {category}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Members Count */}
          <div className="flex items-center gap-1.5 text-[#999]">
            <Users className="w-4 h-4" />
            <span className="text-xs sm:text-sm">
              {group.memberCount || 0} {(group.memberCount || 0) === 1 ? "Member" : "Members"}
            </span>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-1.5 text-[#999]">
            <Globe className="w-4 h-4" />
            <span className="text-xs sm:text-sm">
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
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-[#FFCC00] text-[#1f1f1f] rounded-full text-xs font-medium shadow-sm hover:bg-[#FFD700] transition-colors"
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
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-[#FFCC00] text-[#1f1f1f] rounded-full text-xs font-medium shadow-sm hover:bg-[#FFD700] transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>View Group</span>
          </button>
        )}
      </div>
    </div>
  );
}
