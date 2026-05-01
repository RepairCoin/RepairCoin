"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { getApiBaseUrl } from "@/utils/apiUrl";
import {
  Users, Coins, Copy, Check, Shield,
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
import { LoadingSpinner } from "./shared";
import { PageTabs } from "@/components/ui/PageTabs";
import type { PageTab } from "@/components/ui/PageTabs";
import { formatDate } from "./utils/formatters";
import type { GroupDetailsTab } from "./types";

interface GroupDetailsClientProps {
  groupId: string;
}

export default function GroupDetailsClient({ groupId }: GroupDetailsClientProps) {
  const router = useRouter();
  const { userProfile } = useAuthStore();
  const [group, setGroup] = useState<shopGroupsAPI.AffiliateShopGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<GroupDetailsTab>("overview");
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | undefined>(undefined);
  const [shopRcnBalance, setShopRcnBalance] = useState<number>(0);
  const [shopData, setShopData] = useState<Record<string, unknown> | null>(null);
  const [shopDataLoading, setShopDataLoading] = useState(true);
  const [transactionsRefreshKey, setTransactionsRefreshKey] = useState(0);

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  useEffect(() => {
    if (userProfile?.shopId) {
      setCurrentShopId(userProfile.shopId);
      fetchShopData(userProfile.shopId);
    }
  }, [userProfile]);

  const fetchShopData = async (shopId: string) => {
    setShopDataLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/shops/${shopId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setShopRcnBalance(result.data.purchasedRcnBalance || 0);

          let enhancedShopData = result.data;
          try {
            const subResponse = await fetch(`${getApiBaseUrl()}/shops/subscription/status`, {
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
      await loadGroupData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Error joining group:", error);
      toast.error(err.response?.data?.error || "Failed to join group");
    } finally {
      setJoiningGroup(false);
    }
  };

  if (loading || !group) {
    return (
      <DashboardLayout userRole="shop">
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner message="Loading group details..." showSparkles />
        </div>
      </DashboardLayout>
    );
  }

  // Define tabs based on access level
  const tabs: PageTab<GroupDetailsTab>[] = [
    { key: "overview", label: "Overview", icon: BookOpen },
    ...(isRestrictedAccess ? [] : [
      { key: "members" as GroupDetailsTab, label: "Members", icon: Users, hasBadge: true },
      { key: "customers" as GroupDetailsTab, label: "Customers", icon: Users },
      { key: "operations" as GroupDetailsTab, label: "Token Operations", icon: Coins },
      { key: "transactions" as GroupDetailsTab, label: "Transactions", icon: FileText },
      { key: "analytics" as GroupDetailsTab, label: "Analytics", icon: Activity },
    ]),
  ];

  return (
    <DashboardLayout userRole="shop">
      {shopDataLoading ? (
        <div className="py-8" />
      ) : (
        <SubscriptionGuard shopData={shopData}>
          <div className="min-h-screen py-4 sm:py-8">
            <div className="max-w-screen-2xl w-[96%] mx-auto">
            {/* Breadcrumb and Header */}
            <div className="mb-6 sm:mb-8">
              <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                <button
                  onClick={() => router.push("/shop")}
                  className="p-1 rounded hover:bg-[#303236] transition-colors flex-shrink-0"
                  title="Go to Overview"
                >
                  <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 hover:text-white transition-colors" />
                </button>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                <button
                  onClick={() => router.push("/shop/groups")}
                  className="flex items-center gap-1 sm:gap-1.5 hover:text-[#FFD700] transition-colors flex-shrink-0"
                >
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFCC00]" />
                  <span className="text-sm sm:text-base font-medium text-[#FFCC00] hidden sm:inline">Affiliate Groups</span>
                </button>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0 hidden sm:inline-block" />
                <button
                  onClick={() => router.push("/shop/groups")}
                  className="text-sm sm:text-base font-medium text-white hover:text-[#FFCC00] transition-colors flex-shrink-0 hidden sm:inline"
                >
                  My Groups
                </button>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm sm:text-base font-medium text-[#FFCC00] truncate max-w-[160px] sm:max-w-[240px] md:max-w-none">{group.groupName}</span>
              </nav>
              <p className="text-xs sm:text-sm text-gray-400">Browse, track, and grow your affiliate communities effortlessly.</p>
            </div>

            {/* Header Card */}
            <div className="bg-[#101010] rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                <h1 className="text-base sm:text-lg font-semibold text-white truncate">{group.groupName}</h1>
              </div>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                {group.description || "Welcome to this affiliate group."}
              </p>

              {/* Restricted Access Warning */}
              {isRestrictedAccess ? (
                <RestrictedAccessBanner
                  membershipStatus={group.membershipStatus}
                  onJoinGroup={handleJoinGroup}
                  onGoBack={() => router.push("/shop/groups")}
                  joiningGroup={joiningGroup}
                />
              ) : (
                <GroupStatsCards group={group} onCopyInviteCode={copyInviteCode} inviteCodeCopied={inviteCodeCopied} />
              )}
            </div>

            {/* Tabs Navigation */}
            <PageTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              className="mb-4 sm:mb-6"
            />

            {/* Tab Content */}
            <div>
              {activeTab === "overview" && (
                <OverviewTab group={group} isRestrictedAccess={isRestrictedAccess || false} />
              )}

              {!isRestrictedAccess && activeTab === "members" && (
                <GroupMembersTab groupId={groupId} currentShopId={currentShopId} />
              )}

              {!isRestrictedAccess && activeTab === "customers" && (
                <GroupCustomersTab groupId={groupId} />
              )}

              {!isRestrictedAccess && activeTab === "operations" && (
                <div className="space-y-6">
                  <ImprovedRcnAllocationCard
                    groupId={groupId}
                    shopRcnBalance={shopRcnBalance}
                    currentShopId={currentShopId}
                    onAllocationChange={() => {
                      if (currentShopId) fetchShopData(currentShopId);
                    }}
                  />
                  <GroupTokenOperationsTab
                    groupId={groupId}
                    tokenSymbol={group.customTokenSymbol || "TOKEN"}
                    shopRcnBalance={shopRcnBalance}
                    onTransactionComplete={() => {
                      setTransactionsRefreshKey(prev => prev + 1);
                      if (currentShopId) fetchShopData(currentShopId);
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
          </div>
        </SubscriptionGuard>
      )}
    </DashboardLayout>
  );
}

// Extracted components for better organization

interface RestrictedAccessBannerProps {
  membershipStatus: string | null | undefined;
  onJoinGroup: () => void;
  onGoBack: () => void;
  joiningGroup: boolean;
}

function RestrictedAccessBanner({ membershipStatus, onJoinGroup, onGoBack, joiningGroup }: RestrictedAccessBannerProps) {
  const isPending = membershipStatus === 'pending';

  return (
    <div className={`${
      isPending ? 'bg-blue-500/10 border-blue-500/30' : 'bg-orange-500/10 border-orange-500/30'
    } border rounded-xl p-4 sm:p-6`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`flex-shrink-0 p-2 ${
          isPending ? 'bg-blue-500/20' : 'bg-orange-500/20'
        } rounded-lg`}>
          <Shield className={`w-5 h-5 sm:w-6 sm:h-6 ${isPending ? 'text-blue-400' : 'text-orange-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-white mb-2">
            {isPending ? 'Membership Request Pending' : 'Join Group to Access Full Features'}
          </h3>
          <p className="text-gray-300 text-xs sm:text-sm mb-4">
            {isPending
              ? 'Your request to join this group is awaiting approval from the group admin. Once approved, you will have access to all group features including token operations, member list, transactions, and analytics.'
              : 'You need to be a member to view detailed information including token details, members, transactions, and analytics. Send a join request to access all features.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {membershipStatus === null && (
              <button
                onClick={onJoinGroup}
                disabled={joiningGroup}
                className="px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joiningGroup ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    Joining...
                  </span>
                ) : (
                  "Request to Join Group"
                )}
              </button>
            )}
            <button
              onClick={onGoBack}
              className={`px-4 py-2 text-sm sm:text-base ${
                isPending ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              } text-white font-semibold rounded-lg transition-all duration-200`}
            >
              Back to Groups
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface GroupStatsCardsProps {
  group: shopGroupsAPI.AffiliateShopGroup;
  onCopyInviteCode: () => void;
  inviteCodeCopied: boolean;
}

function GroupStatsCards({ group, onCopyInviteCode, inviteCodeCopied }: GroupStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <Coins className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Token</span>
        </div>
        <p className="text-white font-semibold">
          {group.customTokenSymbol} • {group.customTokenName}
        </p>
      </div>

      <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <Users className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Members</span>
        </div>
        <p className="text-white font-semibold text-xl">{group.memberCount || 0}</p>
        <p className="text-gray-500 text-xs">Active participants</p>
      </div>

      <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <Copy className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Invite Code</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-white font-semibold tracking-wider">
            {group.inviteCode}
          </span>
          <button
            onClick={onCopyInviteCode}
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

      <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <Shield className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[#FFCC00] text-xs font-semibold uppercase tracking-wide">Group Privacy</span>
        </div>
        <p className="text-white font-semibold">PUBLIC</p>
        <p className="text-gray-500 text-xs">
          Created: {formatDate(group.createdAt, { shortFormat: true })}
        </p>
      </div>
    </div>
  );
}

interface OverviewTabProps {
  group: shopGroupsAPI.AffiliateShopGroup;
  isRestrictedAccess: boolean;
}

function OverviewTab({ group, isRestrictedAccess }: OverviewTabProps) {
  const isPending = group.membershipStatus === 'pending';

  return (
    <div className="bg-[#101010] rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-5">
        <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFCC00]" />
        <h3 className="text-[#FFCC00] font-semibold text-sm sm:text-base">Group Overview</h3>
      </div>

      {isRestrictedAccess ? (
        <div className="space-y-4">
          <div className={`p-4 sm:p-5 ${
            isPending ? 'bg-blue-500/10 border-blue-500/30' : 'bg-orange-500/10 border-orange-500/30'
          } border rounded-lg`}>
            <div className="flex items-start gap-3 sm:gap-4">
              <Shield className={`w-5 h-5 sm:w-6 sm:h-6 ${
                isPending ? 'text-blue-400' : 'text-orange-400'
              } flex-shrink-0 mt-0.5`} />
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-white mb-2">
                  {isPending ? 'Awaiting Approval' : 'Members Only Content'}
                </h4>
                <p className="text-gray-300 text-xs sm:text-sm mb-3">
                  {isPending
                    ? 'Your membership request is pending admin approval. Once approved, you will gain access to:'
                    : 'This group\'s detailed information is only visible to members. Join the group to access:'}
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-300 text-xs sm:text-sm">
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
          <div className="bg-[#1e1f22] rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 text-xs sm:text-sm font-medium">Group Description</p>
              <button className="text-gray-500 hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
              {group.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-[#1e1f22] rounded-lg p-4 sm:p-5">
              <p className="text-gray-400 text-xs sm:text-sm font-medium mb-2">Date Created</p>
              <p className="text-white text-xs sm:text-sm">{formatDate(group.createdAt)}</p>
            </div>
            <div className="bg-[#1e1f22] rounded-lg p-4 sm:p-5">
              <p className="text-gray-400 text-xs sm:text-sm font-medium mb-2">Last Updated</p>
              <p className="text-white text-xs sm:text-sm">{formatDate(group.updatedAt, { includeTime: true })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
