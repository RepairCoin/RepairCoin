"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { ArrowLeft, Users, Coins, TrendingUp, Settings, Copy, Check } from "lucide-react";
import * as shopGroupsAPI from "@/services/api/shopGroups";
import GroupMembersTab from "./GroupMembersTab";
import GroupTokenOperationsTab from "./GroupTokenOperationsTab";
import GroupTransactionsTab from "./GroupTransactionsTab";

interface GroupDetailsClientProps {
  groupId: string;
}

export default function GroupDetailsClient({ groupId }: GroupDetailsClientProps) {
  const router = useRouter();
  const [group, setGroup] = useState<shopGroupsAPI.ShopGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "operations" | "transactions">(
    "overview"
  );
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const groupData = await shopGroupsAPI.getGroup(groupId);
      if (!groupData) {
        toast.error("Group not found");
        router.push("/shop/groups");
        return;
      }
      setGroup(groupData);
    } catch (error) {
      console.error("Error loading group:", error);
      toast.error("Failed to load group details");
      router.push("/shop/groups");
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setInviteCodeCopied(true);
      toast.success("Invite code copied!");
      setTimeout(() => setInviteCodeCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy invite code");
    }
  };

  if (loading || !group) {
    return (
      <DashboardLayout title="Loading..." subtitle="">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading group details...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={group.groupName} subtitle={group.description || ""}>
      {/* Back Button */}
      <button
        onClick={() => router.push("/shop/groups")}
        className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Groups
      </button>

      {/* Group Info Card */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Token Info */}
          <div>
            <p className="text-sm text-gray-400 mb-1">Custom Token</p>
            <p className="text-xl font-bold text-white">
              {group.customTokenSymbol}
            </p>
            <p className="text-sm text-gray-400">{group.customTokenName}</p>
          </div>

          {/* Members */}
          <div>
            <p className="text-sm text-gray-400 mb-1">Members</p>
            <p className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FFCC00]" />
              {group.memberCount || 0}
            </p>
          </div>

          {/* Privacy */}
          <div>
            <p className="text-sm text-gray-400 mb-1">Privacy</p>
            <p className="text-xl font-bold text-white">
              {group.isPrivate ? "Private" : "Public"}
            </p>
            <p className="text-sm text-gray-400">
              {group.isPrivate ? "Invite only" : "Open to join"}
            </p>
          </div>

          {/* Invite Code */}
          <div>
            <p className="text-sm text-gray-400 mb-1">Invite Code</p>
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-2 px-3 py-2 bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <span className="font-mono text-[#FFCC00] font-bold">
                {group.inviteCode}
              </span>
              {inviteCodeCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === "overview"
                ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === "members"
                ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Members
            </div>
          </button>
          <button
            onClick={() => setActiveTab("operations")}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === "operations"
                ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Token Operations
            </div>
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === "transactions"
                ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Transactions
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Group Overview</h3>
            <div className="space-y-4">
              {group.description && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">Description</p>
                  <p className="text-white">{group.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Created</p>
                  <p className="text-white">
                    {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Last Updated</p>
                  <p className="text-white">
                    {new Date(group.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "members" && <GroupMembersTab groupId={groupId} />}

        {activeTab === "operations" && (
          <GroupTokenOperationsTab groupId={groupId} tokenSymbol={group.customTokenSymbol} />
        )}

        {activeTab === "transactions" && (
          <GroupTransactionsTab groupId={groupId} tokenSymbol={group.customTokenSymbol} />
        )}
      </div>
    </DashboardLayout>
  );
}
