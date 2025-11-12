"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { ArrowLeft, Users, Coins, TrendingUp, Copy, Check, BarChart3, Sparkles, Shield } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import GroupMembersTab from "./GroupMembersTab";
import GroupTokenOperationsTab from "./GroupTokenOperationsTab";
import GroupTransactionsTab from "./GroupTransactionsTab";
import AnalyticsDashboard from "./AnalyticsDashboard";
import MemberActivityStats from "./MemberActivityStats";

interface GroupDetailsClientProps {
  groupId: string;
}

export default function GroupDetailsClient({ groupId }: GroupDetailsClientProps) {
  const router = useRouter();
  const [group, setGroup] = useState<shopGroupsAPI.AffiliateShopGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "operations" | "transactions" | "analytics">(
    "overview"
  );
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);

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

  // Check if user has restricted access (non-member viewing any group)
  // Backend returns membershipStatus: 'active' for members, null for non-members
  const isRestrictedAccess = group && group.membershipStatus !== 'active';

  // Debug logging
  if (group) {
    console.log('🔍 Group Access Check:', {
      groupId: group.groupId,
      groupName: group.groupName,
      isPrivate: group.isPrivate,
      membershipStatus: group.membershipStatus,
      inviteCode: group.inviteCode,
      customTokenName: group.customTokenName,
      customTokenSymbol: group.customTokenSymbol,
      isRestrictedAccess
    });
  }

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

  const handleJoinGroup = async () => {
    if (!group) return;

    setJoiningGroup(true);
    try {
      await shopGroupsAPI.requestToJoinGroup(groupId);
      toast.success(
        group.isPrivate
          ? "Join request sent! Waiting for admin approval."
          : "Join request sent!"
      );
      // Reload group data to get updated membership status
      await loadGroupData();
    } catch (error: any) {
      console.error("Error joining group:", error);
      toast.error(error.response?.data?.error || "Failed to join group");
    } finally {
      setJoiningGroup(false);
    }
  };

  if (loading || !group) {
    return (
      <DashboardLayout title="Loading..." subtitle="">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-800 border-t-[#FFCC00] rounded-full animate-spin mx-auto"></div>
              <Sparkles className="w-6 h-6 text-[#FFCC00] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="mt-6 text-gray-400 font-medium">Loading group details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="" subtitle="">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Back Button */}
        <button
          onClick={() => router.push("/shop/groups")}
          className="group flex items-center gap-2 text-gray-400 hover:text-[#FFCC00] transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Groups</span>
        </button>

        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#FFCC00]/10 via-transparent to-transparent rounded-2xl blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8 shadow-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {group.groupName}
                </h1>
                {group.description && (
                  <p className="text-gray-400 text-lg">{group.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full border border-gray-700">
                <div className={`w-2 h-2 rounded-full ${group.isPrivate ? 'bg-orange-500' : 'bg-green-500'} animate-pulse`}></div>
                <span className="text-sm font-medium text-gray-300">
                  {group.isPrivate ? "Private" : "Public"}
                </span>
              </div>
            </div>

            {/* Restricted Access Warning */}
            {isRestrictedAccess ? (
              <div className={`bg-gradient-to-br ${
                group.membershipStatus === 'pending'
                  ? 'from-blue-500/10 to-indigo-500/10 border-blue-500/30'
                  : 'from-orange-500/10 to-red-500/10 border-orange-500/30'
              } border rounded-xl p-6`}>
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 p-2 ${
                    group.membershipStatus === 'pending'
                      ? 'bg-blue-500/20'
                      : 'bg-orange-500/20'
                  } rounded-lg`}>
                    <Shield className={`w-6 h-6 ${
                      group.membershipStatus === 'pending'
                        ? 'text-blue-400'
                        : 'text-orange-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {group.membershipStatus === 'pending'
                        ? 'Membership Request Pending'
                        : group.isPrivate
                          ? 'Private Group - Access Restricted'
                          : 'Join Group to Access Full Features'}
                    </h3>
                    <p className="text-gray-300 mb-4">
                      {group.membershipStatus === 'pending'
                        ? 'Your request to join this group is awaiting approval from the group admin. Once approved, you will have access to all group features including token operations, member list, transactions, and analytics.'
                        : group.isPrivate
                          ? 'This is a private group. You need to be a member to view detailed information including token details, members, transactions, and analytics.'
                          : 'Join this group to access token operations, view members, track transactions, and see detailed analytics.'}
                    </p>
                    <div className="flex gap-3">
                      {group.membershipStatus === null && (
                        <button
                          onClick={handleJoinGroup}
                          disabled={joiningGroup}
                          className="px-6 py-2.5 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] hover:from-[#FFD700] hover:to-[#FFCC00] text-black font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FFCC00]/20"
                        >
                          {joiningGroup ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                              Joining...
                            </span>
                          ) : (
                            "Request to Join Group"
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => router.push("/shop/groups")}
                        className={`px-4 py-2 ${
                          group.membershipStatus === 'pending'
                            ? 'bg-blue-500 hover:bg-blue-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                        } text-white font-semibold rounded-lg transition-all duration-200`}
                      >
                        Back to Groups
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Token Info */}
                  <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-5 border border-gray-700/50 hover:border-[#FFCC00]/30 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Coins className="w-4 h-4 text-[#FFCC00]" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Token</p>
                      </div>
                      <p className="text-2xl font-bold text-white mb-1">{group.customTokenSymbol}</p>
                      <p className="text-sm text-gray-400">{group.customTokenName}</p>
                    </div>
                  </div>

                  {/* Members */}
                  <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-5 border border-gray-700/50 hover:border-[#FFCC00]/30 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-[#FFCC00]" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Members</p>
                      </div>
                      <p className="text-2xl font-bold text-white">{group.memberCount || 0}</p>
                      <p className="text-sm text-gray-400">Active participants</p>
                    </div>
                  </div>

                  {/* Privacy */}
                  <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-5 border border-gray-700/50 hover:border-[#FFCC00]/30 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Access</p>
                      </div>
                      <p className="text-2xl font-bold text-white">{group.isPrivate ? "Private" : "Public"}</p>
                      <p className="text-sm text-gray-400">{group.isPrivate ? "Invite only" : "Open to join"}</p>
                    </div>
                  </div>

                  {/* Invite Code */}
                  <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-5 border border-gray-700/50 hover:border-[#FFCC00]/30 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Copy className="w-4 h-4 text-[#FFCC00]" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invite Code</p>
                      </div>
                      <button
                        onClick={copyInviteCode}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-black/30 hover:bg-black/50 rounded-lg transition-all duration-200 border border-gray-700/30 hover:border-[#FFCC00]/30"
                      >
                        <span className="font-mono text-lg font-bold text-[#FFCC00] tracking-wider">
                          {group.inviteCode}
                        </span>
                        {inviteCodeCopied ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { key: "overview", label: "Overview", icon: TrendingUp },
              ...(isRestrictedAccess ? [] : [
                { key: "members", label: "Members", icon: Users },
                { key: "operations", label: "Token Operations", icon: Coins },
                { key: "transactions", label: "Transactions", icon: TrendingUp },
                { key: "analytics", label: "Analytics", icon: BarChart3 },
              ]),
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black shadow-lg shadow-[#FFCC00]/20"
                      : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{tab.label}</span>
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#FFCC00] rounded-full"></div>
                  )}
                </button>
              );
            })}
            </div>
          </div>

        {/* Tab Content */}
        <div className="animate-in fade-in duration-300">
          {activeTab === "overview" && (
            <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-[#FFCC00] to-transparent rounded-full"></div>
                Group Overview
              </h3>
              {isRestrictedAccess ? (
                <div className="space-y-6">
                  <div className={`p-6 ${
                    group.membershipStatus === 'pending'
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-orange-500/10 border-orange-500/30'
                  } border rounded-xl`}>
                    <div className="flex items-start gap-4">
                      <Shield className={`w-6 h-6 ${
                        group.membershipStatus === 'pending'
                          ? 'text-blue-400'
                          : 'text-orange-400'
                      } flex-shrink-0 mt-1`} />
                      <div>
                        <h4 className="text-lg font-bold text-white mb-2">
                          {group.membershipStatus === 'pending'
                            ? 'Awaiting Approval'
                            : 'Members Only Content'}
                        </h4>
                        <p className="text-gray-300 mb-4">
                          {group.membershipStatus === 'pending'
                            ? 'Your membership request is pending admin approval. Once approved, you will gain access to:'
                            : group.isPrivate
                              ? 'This private group\'s detailed information is only visible to members. Join the group using an invite code to access:'
                              : 'Join this public group to unlock access to:'}
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
                          <li>Custom token details and operations</li>
                          <li>Member roster and management</li>
                          <li>Transaction history and analytics</li>
                          <li>Group statistics and insights</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  {group.description && (
                    <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/30">
                      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</p>
                      <p className="text-white leading-relaxed">{group.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {group.description && (
                    <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/30">
                      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</p>
                      <p className="text-white leading-relaxed">{group.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/30">
                      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Created</p>
                      <p className="text-white text-lg font-medium">
                        {new Date(group.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/30">
                      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Last Updated</p>
                      <p className="text-white text-lg font-medium">
                        {new Date(group.updatedAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isRestrictedAccess && activeTab === "members" && <GroupMembersTab groupId={groupId} />}

          {!isRestrictedAccess && activeTab === "operations" && (
            <GroupTokenOperationsTab groupId={groupId} tokenSymbol={group.customTokenSymbol} />
          )}

          {!isRestrictedAccess && activeTab === "transactions" && (
            <GroupTransactionsTab groupId={groupId} tokenSymbol={group.customTokenSymbol} />
          )}

          {!isRestrictedAccess && activeTab === "analytics" && (
            <div className="space-y-8">
              <AnalyticsDashboard groupId={groupId} />
              <MemberActivityStats groupId={groupId} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
