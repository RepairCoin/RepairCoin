"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Users, Check, X, Trash2, Shield, User } from "lucide-react";
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
      setMembers(activeMembers);
      setPendingMembers(pending);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members");
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
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading members...</p>
        </div>
      </div>
    );
  }

  const displayMembers = activeFilter === "all" ? members : pendingMembers;

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6" />
          Group Members
        </h3>

        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-[#FFCC00] text-black"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Active ({members.length})
          </button>
          <button
            onClick={() => setActiveFilter("pending")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
              activeFilter === "pending"
                ? "bg-[#FFCC00] text-black"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Pending ({pendingMembers.length})
            {pendingMembers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      {/* Members List */}
      {displayMembers.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            {activeFilter === "all" ? "No active members yet" : "No pending requests"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayMembers.map((member) => (
            <div
              key={member.shopId}
              className="bg-gray-900 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    {member.role === "admin" ? (
                      <Shield className="w-5 h-5 text-[#FFCC00]" />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white flex items-center gap-2">
                      {member.shopName || member.shopId}
                      {member.role === "admin" && (
                        <span className="px-2 py-0.5 bg-[#FFCC00]/20 text-[#FFCC00] text-xs rounded-full">
                          Admin
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-400">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                    {member.requestMessage && (
                      <p className="text-sm text-gray-500 mt-1 italic">
                        "{member.requestMessage}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {member.status === "pending" ? (
                  <>
                    <button
                      onClick={() => handleApproveMember(member.shopId)}
                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      title="Approve"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRejectMember(member.shopId)}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  member.role !== "admin" && (
                    <button
                      onClick={() => handleRemoveMember(member.shopId)}
                      className="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
