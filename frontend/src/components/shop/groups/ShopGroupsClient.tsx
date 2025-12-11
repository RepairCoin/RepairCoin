"use client";

import { useState, useEffect, useMemo } from "react";
import { useActiveAccount, useIsAutoConnecting, ConnectButton } from "thirdweb/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { Users, Plus, TrendingUp, ChevronDown, UserPlus, Home, ChevronRight } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import CreateGroupModal from "./CreateGroupModal";
import GroupCard from "./GroupCard";
import JoinGroupModal from "./JoinGroupModal";
import apiClient from "@/services/api/client";
import { useAuthStore } from "@/stores/authStore";
import { client } from "@/utils/thirdweb";

type SortOption = "members" | "name" | "recent";

export default function AffiliateShopGroupsClient() {
  const account = useActiveAccount();
  const isAutoConnecting = useIsAutoConnecting();
  const router = useRouter();
  const { authInitialized, isAuthenticated, userType, isLoading: authLoading } = useAuthStore();

  const [myGroups, setMyGroups] = useState<shopGroupsAPI.AffiliateShopGroup[]>([]);
  const [allGroups, setAllGroups] = useState<shopGroupsAPI.AffiliateShopGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my-groups" | "discover">("my-groups");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState<boolean>(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [shopId, setShopId] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("members");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  useEffect(() => {
    // Wait for auth to initialize before loading data
    if (!authInitialized) {
      return;
    }

    // Only load data if we have an authenticated shop user
    if (account?.address && isAuthenticated && userType === 'shop') {
      loadData();
      checkSubscription();
    } else if (authInitialized) {
      // Auth is initialized but user is not authenticated as shop
      setLoading(false);
      setCheckingSubscription(false);
    }
  }, [account?.address, authInitialized, isAuthenticated, userType]);

  const checkSubscription = async () => {
    try {
      setCheckingSubscription(true);

      // Use apiClient which handles auth via cookies
      // apiClient returns response.data directly (interceptor unwraps it)
      const result = await apiClient.get(`/shops/wallet/${account?.address}`) as { success: boolean; data?: { subscriptionActive?: boolean; shopId?: string; operational_status?: string } };

      console.log('📋 [ShopGroups] Subscription check result:', result);

      if (result.success && result.data) {
        // Check both subscriptionActive flag AND operational_status
        // operational_status can be 'subscription_qualified' or 'rcg_qualified'
        const isActive = result.data.subscriptionActive ||
          result.data.operational_status === 'subscription_qualified' ||
          result.data.operational_status === 'rcg_qualified';

        console.log('📋 [ShopGroups] Subscription active:', isActive, {
          subscriptionActive: result.data.subscriptionActive,
          operational_status: result.data.operational_status
        });

        setSubscriptionActive(isActive);
        setShopId(result.data.shopId || "");
      } else {
        setSubscriptionActive(false);
      }
    } catch (error: unknown) {
      // Silently handle errors - this is expected when shop doesn't exist or auth fails
      console.log("Could not check subscription status:", error instanceof Error ? error.message : 'Unknown error');
      setSubscriptionActive(false);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [myGroupsData, allGroupsData] = await Promise.all([
        shopGroupsAPI.getMyGroups(),
        shopGroupsAPI.getAllGroups(),
      ]);
      setMyGroups(Array.isArray(myGroupsData) ? myGroupsData : []);
      setAllGroups(Array.isArray(allGroupsData) ? allGroupsData : []);
    } catch (error) {
      console.error("Error loading groups:", error);
      toast.error("Failed to load shop groups");
      setMyGroups([]);
      setAllGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // Sort groups based on selected option
  const sortedMyGroups = useMemo(() => {
    const groups = [...myGroups];
    switch (sortBy) {
      case "members":
        return groups.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
      case "name":
        return groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
      case "recent":
        return groups.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      default:
        return groups;
    }
  }, [myGroups, sortBy]);

  const sortedAllGroups = useMemo(() => {
    const groups = [...allGroups];
    switch (sortBy) {
      case "members":
        return groups.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
      case "name":
        return groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
      case "recent":
        return groups.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      default:
        return groups;
    }
  }, [allGroups, sortBy]);

  const handleCreateGroup = async (data: shopGroupsAPI.CreateGroupData) => {
    try {
      await shopGroupsAPI.createGroup(data);
      toast.success("Shop group created successfully!");
      setShowCreateModal(false);
      loadData();
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error(error?.response?.data?.error || "Failed to create group");
      throw error;
    }
  };

  const handleJoinGroup = async (inviteCode: string, message?: string) => {
    try {
      await shopGroupsAPI.joinByInviteCode(inviteCode, message);
      toast.success("Successfully joined group!");
      setShowJoinModal(false);
      loadData();
    } catch (error: any) {
      console.error("Error joining group:", error);
      toast.error(error?.response?.data?.error || "Failed to join group");
      throw error;
    }
  };

  const handleGroupClick = (groupId: string) => {
    router.push(`/shop/groups/${groupId}`);
  };

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case "members":
        return "Members";
      case "name":
        return "Name";
      case "recent":
        return "Recent";
      default:
        return "Members";
    }
  };

  // Check if current shop is leader of a group
  const isGroupLeader = (group: shopGroupsAPI.AffiliateShopGroup) => {
    return group.creatorShopId === shopId;
  };

  // Check if current shop is member of a group
  const isGroupMember = (groupId: string) => {
    return myGroups.some(g => g.groupId === groupId);
  };

  // Show loading state while auth is initializing or wallet is auto-connecting
  if (!authInitialized || authLoading || isAutoConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Initializing...</h3>
            <p className="text-gray-600">Checking your authentication status</p>
          </div>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🏪</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Affiliate Groups</h1>
            <p className="text-gray-600 mb-8">Connect your shop wallet to access affiliate groups</p>
            <ConnectButton client={client} theme="light" connectModal={{ size: "wide" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardLayout userRole="shop">
        <div className="p-6">
          {/* Breadcrumb and Header */}
          <div className="mb-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm mb-2">
              <Link href="/shop" className="text-gray-400 hover:text-white transition-colors">
                <Home className="w-4 h-4" />
              </Link>
              <ChevronRight className="w-4 h-4 text-gray-500" />
              <Link href="/shop/groups" className="flex items-center gap-1.5 text-white hover:text-[#FFCC00] transition-colors">
                <Users className="w-4 h-4" />
                <span>Affiliate Groups</span>
              </Link>
              {activeTab === "discover" && (
                <>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                  <span className="text-[#FFCC00]">Discover Groups</span>
                </>
              )}
            </nav>
            {/* Subtitle */}
            <p className="text-gray-400 text-sm">
              Browse, track, and grow your affiliate communities effortlessly.
            </p>
          </div>

          {/* Subscription Warning */}
        {!checkingSubscription && !subscriptionActive && (
          <div className="mb-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-orange-400 font-semibold mb-1">Subscription or RCG Qualification Required</h3>
                <p className="text-orange-300 text-sm mb-3">
                  You need an active RepairCoin subscription ($500/month) or RCG qualification (10K+ RCG tokens) to create or join affiliate shop groups.
                </p>
                <button
                  onClick={() => router.push('/shop/subscription-form')}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                >
                  Subscribe Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header with Tabs and Actions */}
        <div className="mb-6 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center border-y border-[#303236] py-4">
          {/* Tab Bar */}
          <div className="bg-[#1e1f22] p-1 rounded-md flex gap-2">
            <button
              onClick={() => setActiveTab("my-groups")}
              className={`px-4 py-2.5 rounded font-medium text-base transition-colors ${
                activeTab === "my-groups"
                  ? "bg-[#FFCC00] text-[#101010]"
                  : "bg-[#dae0e7] text-[#101010] hover:bg-[#c8cdd3]"
              }`}
            >
              My Groups ({myGroups.length})
            </button>
            <button
              onClick={() => setActiveTab("discover")}
              className={`px-4 py-2.5 rounded font-medium text-base transition-colors ${
                activeTab === "discover"
                  ? "bg-[#FFCC00] text-[#101010]"
                  : "bg-[#dae0e7] text-[#101010] hover:bg-[#c8cdd3]"
              }`}
            >
              Discover Groups ({allGroups.length})
            </button>
          </div>

          {/* Action Buttons and Sort */}
          <div className="flex items-center gap-3">
            {/* Join Group Button */}
            <button
              onClick={() => subscriptionActive && setShowJoinModal(true)}
              disabled={!subscriptionActive}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors ${
                subscriptionActive
                  ? "bg-white border-[#dde2e4] text-[#101010] hover:bg-gray-50"
                  : "bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed opacity-50"
              }`}
              title={!subscriptionActive ? "Active subscription required" : ""}
            >
              <UserPlus className="w-5 h-5" />
              <span className="text-sm font-medium">Join Group</span>
            </button>

            {/* Create Group Button */}
            <button
              onClick={() => subscriptionActive && setShowCreateModal(true)}
              disabled={!subscriptionActive}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors ${
                subscriptionActive
                  ? "bg-white border-[#dde2e4] text-[#101010] hover:bg-gray-50"
                  : "bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed opacity-50"
              }`}
              title={!subscriptionActive ? "Active subscription required" : ""}
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Create Group</span>
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white border-[#dde2e4] text-[#101010] hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs text-[#535353]">Sort by</span>
                <span className="text-sm font-medium">{getSortLabel(sortBy)}</span>
                <ChevronDown className="w-5 h-5" />
              </button>

              {showSortDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-[#dde2e4] rounded-md shadow-lg z-20">
                    {(["members", "name", "recent"] as SortOption[]).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setSortBy(option);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                          sortBy === option ? "text-[#FFCC00] font-medium" : "text-[#101010]"
                        }`}
                      >
                        {getSortLabel(option)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading groups...</p>
          </div>
        ) : (
          <div>
            {activeTab === "my-groups" ? (
              sortedMyGroups.length === 0 ? (
                <div className="text-center py-12 bg-[#101010] rounded-lg">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No Groups Yet</h3>
                  <p className="text-gray-400 mb-6">
                    Create your first shop group or join an existing one
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => subscriptionActive && setShowCreateModal(true)}
                      disabled={!subscriptionActive}
                      className={`px-6 py-3 rounded-lg transition-colors font-medium ${
                        subscriptionActive
                          ? "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
                          : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                      }`}
                      title={!subscriptionActive ? "Active subscription required" : ""}
                    >
                      Create Group
                    </button>
                    <button
                      onClick={() => subscriptionActive && setShowJoinModal(true)}
                      disabled={!subscriptionActive}
                      className={`px-6 py-3 rounded-lg transition-colors ${
                        subscriptionActive
                          ? "bg-gray-700 text-white hover:bg-gray-600"
                          : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                      }`}
                      title={!subscriptionActive ? "Active subscription required" : ""}
                    >
                      Join Group
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {sortedMyGroups.map((group) => (
                    <GroupCard
                      key={group.groupId}
                      group={group}
                      onClick={() => handleGroupClick(group.groupId)}
                      showMemberBadge
                      isLeader={isGroupLeader(group)}
                    />
                  ))}
                </div>
              )
            ) : (
              sortedAllGroups.length === 0 ? (
                <div className="text-center py-12 bg-[#101010] rounded-lg">
                  <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No Groups Available</h3>
                  <p className="text-gray-400">
                    Be the first to create a shop group!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {sortedAllGroups.map((group) => (
                    <GroupCard
                      key={group.groupId}
                      group={group}
                      onClick={() => handleGroupClick(group.groupId)}
                      showMemberBadge={isGroupMember(group.groupId)}
                      isLeader={isGroupLeader(group)}
                      isDiscoverTab={!isGroupMember(group.groupId)}
                      onJoinClick={() => subscriptionActive && setShowJoinModal(true)}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        )}
        </div>
      </DashboardLayout>

      {/* Modals */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateGroup}
        />
      )}

      {showJoinModal && (
        <JoinGroupModal
          onClose={() => setShowJoinModal(false)}
          onSubmit={handleJoinGroup}
        />
      )}
    </>
  );
}
