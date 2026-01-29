"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";
import {
  Users, Coins, Copy, Check, Sparkles, Shield,
  BookOpen, FileText, Activity, ChevronRight, Home, Dumbbell
} from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import GroupMembersTab from "./GroupMembersTab";
import GroupTokenOperationsTab from "./GroupTokenOperationsTab";
import GroupTransactionsTab from "./GroupTransactionsTab";
import GroupCustomersTab from "./GroupCustomersTab";
import AnalyticsDashboard from "./AnalyticsDashboard";
import MemberActivityStats from "./MemberActivityStats";
import ImprovedRcnAllocationCard from "./ImprovedRcnAllocationCard";
import { useAuthStore } from "../../../stores/authStore";
import { SubscriptionGuard } from "@/components/shop/SubscriptionGuard";

interface GroupDetailsClientProps {
  groupId: string;
}

export default function GroupDetailsClient({ groupId }: GroupDetailsClientProps) {
  const router = useRouter();
  const { userProfile } = useAuthStore();
  const [group, setGroup] = useState<shopGroupsAPI.AffiliateShopGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "customers" | "operations" | "transactions" | "analytics">(
    "overview"
  );
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | undefined>(undefined);
  const [shopRcnBalance, setShopRcnBalance] = useState<number>(0);
  const [shopData, setShopData] = useState<any>(null);
  const [shopDataLoading, setShopDataLoading] = useState(true);
  const [transactionsRefreshKey, setTransactionsRefreshKey] = useState(0);

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  useEffect(() => {
    // Get current shop ID from user profile and fetch shop data
    if (userProfile?.shopId) {
      setCurrentShopId(userProfile.shopId);
      fetchShopData(userProfile.shopId);
    }
  }, [userProfile]);

  const fetchShopData = async (shopId: string) => {
    setShopDataLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}`, {
        credentials: 'include', // Include cookies for authentication
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setShopRcnBalance(result.data.purchasedRcnBalance || 0);

          // Enhance shopData with subscription details for accurate SubscriptionGuard messaging
          let enhancedShopData = result.data;
          try {
            const subResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/status`, {
              credentials: 'include',
            });
            if (subResponse.ok) {
              const subResult = await subResponse.json();
              if (subResult.success && subResult.data?.currentSubscription) {
                const sub = subResult.data.currentSubscription;
                enhancedShopData = {
                  ...enhancedShopData,
                  subscriptionCancelledAt: sub.cancelledAt || (sub.cancelAtPeriodEnd ? new Date().toISOString() : null),
                  subscriptionEndsAt: sub.currentPeriodEnd || sub.nextPaymentDate || sub.activatedAt,
                };
              }
            }
          } catch (subErr) {
            console.error("Error loading subscription details:", subErr);
          }
          setShopData(enhancedShopData);
        }
      }
    } catch (error) {
      console.error("Error fetching shop data:", error);
    } finally {
      setShopDataLoading(false);
    }
  };

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

  const copyInviteCode = async () => {
    if (!group || !group.inviteCode) return;
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
      toast.success("Join request sent! Waiting for admin approval.");
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
      <DashboardLayout userRole="shop">
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
    <DashboardLayout userRole="shop">
      {shopDataLoading ? (
      <div className="px-12 py-8 " />
      ) : (
      <SubscriptionGuard shopData={shopData}>
      <div className="px-12 py-8 min-h-screen">
        {/* Breadcrumb and Header */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-3 text-base mb-3">
            <button onClick={() => router.push("/shop")} className="text-gray-400 hover:text-white transition-colors">
              <Home className="w-5 h-5" />
            </button>
            <ChevronRight className="w-5 h-5 text-gray-500" />
            <button
              onClick={() => router.push("/shop/groups")}
              className="flex items-center gap-2 text-[#FFCC00] hover:text-[#FFD700] transition-colors font-medium"
            >
              <Users className="w-5 h-5" />
              <span>Affiliate Groups</span>
            </button>
            <ChevronRight className="w-5 h-5 text-gray-500" />
            <button
              onClick={() => router.push("/shop/groups")}
              className="text-white hover:text-[#FFCC00] transition-colors font-medium"
            >
              My Groups
            </button>
            <ChevronRight className="w-5 h-5 text-gray-500" />
            <span className="text-[#FFCC00] font-medium">{group.groupName}</span>
          </nav>
          {/* Subtitle */}
          <p className="text-gray-400 text-sm">Browse, track, and grow your affiliate communities effortlessly.</p>
        </div>

        {/* Header Card */}
        <div className="bg-[#101010] rounded-xl p-6 mb-6">
          {/* Group Name & Description */}
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="w-5 h-5 text-white" />
            <h1 className="text-lg font-semibold text-white">{group.groupName}</h1>
          </div>
          <p className="text-gray-500 text-sm mb-6">
            {group.description || "Welcome to this affiliate group."}
          </p>

          {/* Restricted Access Warning */}
          {isRestrictedAccess ? (
            <div className={`${
              group.membershipStatus === 'pending'
                ? 'bg-blue-500/10 border-blue-500/30'
                : 'bg-orange-500/10 border-orange-500/30'
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
                      : 'Join Group to Access Full Features'}
                  </h3>
                  <p className="text-gray-300 mb-4">
                    {group.membershipStatus === 'pending'
                      ? 'Your request to join this group is awaiting approval from the group admin. Once approved, you will have access to all group features including token operations, member list, transactions, and analytics.'
                      : 'You need to be a member to view detailed information including token details, members, transactions, and analytics. Send a join request to access all features.'}
                  </p>
                  <div className="flex gap-3">
                    {group.membershipStatus === null && (
                      <button
                        onClick={handleJoinGroup}
                        disabled={joiningGroup}
                        className="px-6 py-2.5 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
            /* Stats Cards Row */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Token Info */}
              <div className="bg-[#1e1f22] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="w-4 h-4 text-[#FFCC00]" />
                  <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Token</span>
                </div>
                <p className="text-white font-semibold">
                  {group.customTokenSymbol} • {group.customTokenName}
                </p>
              </div>

              {/* Members */}
              <div className="bg-[#1e1f22] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-[#FFCC00]" />
                  <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Members</span>
                </div>
                <p className="text-white font-semibold text-xl">{group.memberCount || 0}</p>
                <p className="text-gray-500 text-xs">Active participants</p>
              </div>

              {/* Invite Code */}
              <div className="bg-[#1e1f22] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Copy className="w-4 h-4 text-[#FFCC00]" />
                  <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Invite Code</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-white font-semibold tracking-wider">
                    {group.inviteCode}
                  </span>
                  <button
                    onClick={copyInviteCode}
                    className="p-1 hover:bg-white/10 rounded transition-all duration-200"
                  >
                    {inviteCodeCopied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Group Privacy */}
              <div className="bg-[#1e1f22] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-[#FFCC00]" />
                  <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Group Privacy</span>
                </div>
                <p className="text-white font-semibold">PUBLIC</p>
                <p className="text-gray-500 text-xs">
                  Created: {new Date(group.createdAt).toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: "overview", label: "Overview", icon: BookOpen },
            ...(isRestrictedAccess ? [] : [
              { key: "members", label: "Members", icon: Users, hasBadge: true },
              { key: "customers", label: "Customers", icon: Users },
              { key: "operations", label: "Token Operations", icon: Coins },
              { key: "transactions", label: "Transactions", icon: FileText },
              { key: "analytics", label: "Analytics", icon: Activity },
            ]),
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-md font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? "bg-[#FFCC00] text-[#101010]"
                    : "bg-[#dae0e7] text-[#101010] hover:bg-[#c8cdd3]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
                {tab.hasBadge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "overview" && (
            <div className="bg-[#101010] rounded-xl p-6">
              {/* Group Overview Header */}
              <div className="flex items-center gap-2 mb-5">
                <Dumbbell className="w-5 h-5 text-[#FFCC00]" />
                <h3 className="text-[#FFCC00] font-semibold">Group Overview</h3>
              </div>

              {isRestrictedAccess ? (
                <div className="space-y-4">
                  <div className={`p-5 ${
                    group.membershipStatus === 'pending'
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-orange-500/10 border-orange-500/30'
                  } border rounded-lg`}>
                    <div className="flex items-start gap-4">
                      <Shield className={`w-6 h-6 ${
                        group.membershipStatus === 'pending'
                          ? 'text-blue-400'
                          : 'text-orange-400'
                      } flex-shrink-0 mt-0.5`} />
                      <div>
                        <h4 className="text-base font-bold text-white mb-2">
                          {group.membershipStatus === 'pending'
                            ? 'Awaiting Approval'
                            : 'Members Only Content'}
                        </h4>
                        <p className="text-gray-300 text-sm mb-3">
                          {group.membershipStatus === 'pending'
                            ? 'Your membership request is pending admin approval. Once approved, you will gain access to:'
                            : 'This group\'s detailed information is only visible to members. Join the group to access:'}
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 text-sm">
                          <li>Custom token details and operations</li>
                          <li>Member roster and management</li>
                          <li>Transaction history and analytics</li>
                          <li>Group statistics and insights</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group Description Card */}
                  <div className="bg-[#1e1f22] rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-gray-400 text-sm font-medium">Group Description</p>
                      <button className="text-gray-500 hover:text-white transition-colors">
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {group.description || "No description provided."}
                    </p>
                  </div>

                  {/* Date Cards Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#1e1f22] rounded-lg p-5">
                      <p className="text-gray-400 text-sm font-medium mb-2">Date Created</p>
                      <p className="text-white text-sm">
                        {new Date(group.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="bg-[#1e1f22] rounded-lg p-5">
                      <p className="text-gray-400 text-sm font-medium mb-2">Last Updated</p>
                      <p className="text-white text-sm">
                        {new Date(group.updatedAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}, {new Date(group.updatedAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZoneName: "short",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isRestrictedAccess && activeTab === "members" && <GroupMembersTab groupId={groupId} currentShopId={currentShopId} />}

          {!isRestrictedAccess && activeTab === "customers" && <GroupCustomersTab groupId={groupId} />}

          {!isRestrictedAccess && activeTab === "operations" && (
            <div className="space-y-6">
              {/* RCN Allocation Card */}
              <ImprovedRcnAllocationCard
                groupId={groupId}
                shopRcnBalance={shopRcnBalance}
                currentShopId={currentShopId}
                onAllocationChange={() => {
                  if (currentShopId) fetchShopData(currentShopId); // Refresh shop RCN balance
                }}
              />

              {/* Token Operations */}
              <GroupTokenOperationsTab
                groupId={groupId}
                tokenSymbol={group.customTokenSymbol || "TOKEN"}
                shopRcnBalance={shopRcnBalance}
                onTransactionComplete={() => {
                  setTransactionsRefreshKey(prev => prev + 1);
                  if (currentShopId) fetchShopData(currentShopId); // Refresh RCN balance after transaction
                }}
              />
            </div>
          )}

          {!isRestrictedAccess && activeTab === "transactions" && (
            <GroupTransactionsTab
              groupId={groupId}
              tokenSymbol={group.customTokenSymbol || "TOKEN"}
              refreshKey={transactionsRefreshKey}
            />
          )}

          {!isRestrictedAccess && activeTab === "analytics" && (
            <div className="space-y-6">
              <AnalyticsDashboard groupId={groupId} />
              <MemberActivityStats groupId={groupId} />
            </div>
          )}
        </div>
      </div>
      </SubscriptionGuard>
      )}
    </DashboardLayout>
  );
}
