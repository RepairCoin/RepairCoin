"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Users, Check, X, Trash2, Shield, User, Crown, Sparkles } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface GroupMembersTabProps {
  groupId: string;
}

export default function GroupMembersTab({ groupId }: GroupMembersTabProps) {
  const [members, setMembers] = useState<shopGroupsAPI.AffiliateShopGroupMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<shopGroupsAPI.AffiliateShopGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "pending">("all");

  useEffect(() => {
    loadMembers();
  }, [groupId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const [activeMembers, pending] = await Promise.all([
        shopGroupsAPI.getGroupMembers(groupId, "active"),
        shopGroupsAPI.getGroupMembers(groupId, "pending"),
      ]);
      setMembers(Array.isArray(activeMembers) ? activeMembers : []);
      setPendingMembers(Array.isArray(pending) ? pending : []);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members");
      setMembers([]);
      setPendingMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMember = async (shopId: string) => {
    try {
      await shopGroupsAPI.approveMember(groupId, shopId);
      toast.success("Member approved!");
      loadMembers();
    } catch (error: any) {
      console.error("Error approving member:", error);
      toast.error(error?.response?.data?.error || "Failed to approve member");
    }
  };

  const handleRejectMember = async (shopId: string) => {
    try {
      await shopGroupsAPI.rejectMember(groupId, shopId);
      toast.success("Member request rejected");
      loadMembers();
    } catch (error: any) {
      console.error("Error rejecting member:", error);
      toast.error(error?.response?.data?.error || "Failed to reject member");
    }
  };

  const handleRemoveMember = async (shopId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      await shopGroupsAPI.removeMember(groupId, shopId);
      toast.success("Member removed");
      loadMembers();
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast.error(error?.response?.data?.error || "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8">
        <div className="text-center py-12">
          <div className="relative mx-auto w-12 h-12">
            <div className="w-12 h-12 border-4 border-gray-800 border-t-[#FFCC00] rounded-full animate-spin"></div>
            <Sparkles className="w-5 h-5 text-[#FFCC00] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-400 font-medium">Loading members...</p>
        </div>
      </div>
    );
  }

  const displayMembers = activeFilter === "all" ? members : pendingMembers;

  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
            <Users className="w-6 h-6 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Group Members</h3>
            <p className="text-sm text-gray-400 mt-1">
              {members.length} active • {pendingMembers.length} pending
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={`relative px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
              activeFilter === "all"
                ? "bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black shadow-lg shadow-[#FFCC00]/20"
                : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700/50"
            }`}
          >
            <span className="text-sm">Active ({members.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter("pending")}
            className={`relative px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
              activeFilter === "pending"
                ? "bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black shadow-lg shadow-[#FFCC00]/20"
                : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700/50"
            }`}
          >
            <span className="text-sm">Pending ({pendingMembers.length})</span>
            {pendingMembers.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Members List */}
      {!Array.isArray(displayMembers) || displayMembers.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex p-4 bg-gray-800/50 rounded-full mb-4">
            <Users className="w-12 h-12 text-gray-600" />
          </div>
          <p className="text-gray-400 text-lg font-medium">
            {activeFilter === "all" ? "No active members yet" : "No pending requests"}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {activeFilter === "all"
              ? "Invite people to join your group"
              : "Member requests will appear here"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayMembers.map((member) => (
            <div
              key={member.shopId}
              className="group relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-[#FFCC00]/30 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>

              <div className="relative flex items-center justify-between gap-4">
                {/* Member Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                    member.role === "admin"
                      ? "bg-gradient-to-br from-[#FFCC00]/20 to-[#FFCC00]/10"
                      : "bg-gray-700/50"
                  }`}>
                    {member.role === "admin" ? (
                      <Crown className="w-6 h-6 text-[#FFCC00]" />
                    ) : (
                      <User className="w-6 h-6 text-gray-400" />
                    )}
                    {member.role === "admin" && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#FFCC00] rounded-full border-2 border-gray-900"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white truncate">
                        {member.shopName || member.shopId}
                      </p>
                      {member.role === "admin" && (
                        <span className="flex-shrink-0 px-2.5 py-0.5 bg-gradient-to-r from-[#FFCC00]/20 to-[#FFD700]/20 border border-[#FFCC00]/30 text-[#FFCC00] text-xs font-bold rounded-full uppercase tracking-wide">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {member.status === "pending" ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                          Pending approval
                        </span>
                      ) : (
                        <>Joined {new Date(member.joinedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}</>
                      )}
                    </p>
                    {member.requestMessage && (
                      <p className="text-sm text-gray-500 mt-2 italic line-clamp-2 bg-gray-900/50 px-3 py-1.5 rounded-lg">
                        "{member.requestMessage}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  {member.status === "pending" ? (
                    <>
                      <button
                        onClick={() => handleApproveMember(member.shopId)}
                        className="p-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-xl transition-all duration-200 shadow-lg shadow-green-600/20 hover:shadow-green-500/40"
                        title="Approve member"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRejectMember(member.shopId)}
                        className="p-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl transition-all duration-200 shadow-lg shadow-red-600/20 hover:shadow-red-500/40"
                        title="Reject request"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    member.role !== "admin" && (
                      <button
                        onClick={() => handleRemoveMember(member.shopId)}
                        className="p-3 bg-red-600/10 hover:bg-gradient-to-r hover:from-red-600 hover:to-red-700 text-red-400 hover:text-white border border-red-600/30 hover:border-transparent rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-red-600/20"
                        title="Remove member"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
