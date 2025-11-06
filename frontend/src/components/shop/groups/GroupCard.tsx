"use client";

import { Users, Lock, Globe } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface GroupCardProps {
  group: shopGroupsAPI.AffiliateShopGroup;
  onClick: () => void;
  showMemberBadge?: boolean;
}

export default function GroupCard({ group, onClick, showMemberBadge }: GroupCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-750 transition-all hover:scale-105 border border-gray-700 hover:border-[#FFCC00]"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">{group.groupName}</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#FFCC00] font-medium">
              {group.customTokenSymbol}
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">{group.customTokenName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {group.isPrivate ? (
            <Lock className="w-5 h-5 text-gray-400" />
          ) : (
            <Globe className="w-5 h-5 text-gray-400" />
          )}
          {showMemberBadge && (
            <span className="px-2 py-1 bg-[#FFCC00]/20 text-[#FFCC00] text-xs rounded-full font-medium">
              Member
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {group.description && (
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {group.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <div className="flex items-center gap-2 text-gray-400">
          <Users className="w-4 h-4" />
          <span className="text-sm">
            {group.memberCount || 0} {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {group.isPrivate ? "Invite Only" : "Open to Join"}
        </div>
      </div>
    </div>
  );
}
