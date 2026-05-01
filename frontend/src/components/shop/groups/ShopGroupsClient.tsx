"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useActiveAccount, useIsAutoConnecting, ConnectButton } from "thirdweb/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { Users, Plus, TrendingUp, ChevronDown, UserPlus, Home, ChevronRight, Search, X, Loader2 } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import CreateGroupModal from "./CreateGroupModal";
import GroupCard from "./GroupCard";
import JoinGroupModal from "./JoinGroupModal";
import { useAuthStore } from "@/stores/authStore";
import { client } from "@/utils/thirdweb";
import { SubscriptionGuard } from "@/components/shop/SubscriptionGuard";
import { useSubscriptionCheck } from "@/hooks/useSubscriptionCheck";
import { LoadingSpinner, EmptyState } from "./shared";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { GroupSortOption } from "./types";
import { GROUP_SORT_OPTIONS } from "./constants";

export default function AffiliateShopGroupsClient() {
  const account = useActiveAccount();
  const isAutoConnecting = useIsAutoConnecting();
  const router = useRouter();
  const { authInitialized, isAuthenticated, userType, isLoading: authLoading, userProfile } = useAuthStore();

  const [myGroups, setMyGroups] = useState<shopGroupsAPI.AffiliateShopGroup[]>([]);
  const [allGroups, setAllGroups] = useState<shopGroupsAPI.AffiliateShopGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my-groups" | "discover">("my-groups");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sortBy, setSortBy] = useState<GroupSortOption>("members");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // My Groups: client-side search
  const [myGroupsSearch, setMyGroupsSearch] = useState("");

  // Discover Groups: lazy-loaded on first tab switch (or invalidated after create/join)
  const [discoverLoaded, setDiscoverLoaded] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverSearch, setDiscoverSearch] = useState("");
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotalItems, setDiscoverTotalItems] = useState(0);
  const [discoverHasMore, setDiscoverHasMore] = useState(false);
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use subscription check hook
  const {
    subscriptionActive,
    checking: checkingSubscription,
    shopId,
    shopData,
  } = useSubscriptionCheck(
    account?.address || userProfile?.address,
    authInitialized && isAuthenticated && userType === 'shop',
    userProfile?.shopId
  );

  const loadMyGroups = useCallback(async () => {
    try {
      setLoading(true);
      const myGroupsData = await shopGroupsAPI.getMyGroups();
      setMyGroups(Array.isArray(myGroupsData) ? myGroupsData : []);
    } catch (error) {
      console.error("Error loading my groups:", error);
      toast.error("Failed to load shop groups");
      setMyGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDiscoverGroups = useCallback(async (search: string, page: number, append: boolean = false) => {
    try {
      if (append) {
        setDiscoverLoadingMore(true);
      } else {
        setDiscoverLoading(true);
      }
      const result = await shopGroupsAPI.getAllGroups({ search: search || undefined, page, limit: 20 });
      if (append) {
        setAllGroups(prev => [...prev, ...result.items]);
      } else {
        setAllGroups(result.items);
      }
      setDiscoverTotalItems(result.pagination.totalItems);
      setDiscoverHasMore(result.pagination.hasMore);
      setDiscoverPage(page);
      setDiscoverLoaded(true);
    } catch (error) {
      console.error("Error loading discover groups:", error);
    } finally {
      setDiscoverLoadingMore(false);
      setDiscoverLoading(false);
    }
  }, []);

  // Initial load: only fetch My Groups; Discover is lazy-loaded on tab switch.
  useEffect(() => {
    if (!authInitialized) return;

    if ((account?.address || userProfile?.address) && isAuthenticated && userType === 'shop') {
      loadMyGroups();
    } else {
      setLoading(false);
    }
  }, [account?.address, userProfile?.address, authInitialized, isAuthenticated, userType, loadMyGroups]);

  // Lazy-load Discover on first switch to that tab (or after invalidation).
  useEffect(() => {
    if (
      activeTab === "discover" &&
      !discoverLoaded &&
      !discoverLoading &&
      isAuthenticated &&
      userType === 'shop'
    ) {
      loadDiscoverGroups(discoverSearch, 1, false);
    }
  }, [activeTab, discoverLoaded, discoverLoading, discoverSearch, isAuthenticated, userType, loadDiscoverGroups]);

  // Cancel pending search debounce on unmount to avoid stale state updates.
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setDiscoverSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadDiscoverGroups(value, 1, false);
    }, 300);
  }, [loadDiscoverGroups]);

  const handleLoadMore = useCallback(() => {
    loadDiscoverGroups(discoverSearch, discoverPage + 1, true);
  }, [discoverSearch, discoverPage, loadDiscoverGroups]);

  // Filter and sort my groups
  const sortedMyGroups = useMemo(() => {
    let groups = [...myGroups];
    if (myGroupsSearch) {
      const search = myGroupsSearch.toLowerCase();
      groups = groups.filter(g =>
        g.groupName.toLowerCase().includes(search) ||
        (g.customTokenSymbol && g.customTokenSymbol.toLowerCase().includes(search)) ||
        (g.customTokenName && g.customTokenName.toLowerCase().includes(search))
      );
    }
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
  }, [myGroups, sortBy, myGroupsSearch]);

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
      setDiscoverLoaded(false);
      loadMyGroups();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Error creating group:", error);
      toast.error(err?.response?.data?.error || "Failed to create group");
      throw error;
    }
  };

  const handleJoinGroup = async (inviteCode: string, message?: string) => {
    try {
      const result = await shopGroupsAPI.joinByInviteCode(inviteCode, message);
      if (result?.status === 'active') {
        toast.success("Successfully joined group!");
      } else {
        toast.success("Join request submitted! Waiting for admin approval.");
      }
      setShowJoinModal(false);
      setDiscoverLoaded(false);
      loadMyGroups();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Error joining group:", error);
      toast.error(err?.response?.data?.error || "Failed to join group");
      throw error;
    }
  };

  const handleGroupClick = useCallback((groupId: string) => {
    router.push(`/shop/groups/${groupId}`);
  }, [router]);

  const getSortLabel = (option: GroupSortOption) => {
    return GROUP_SORT_OPTIONS.find(o => o.value === option)?.label || "Members";
  };

  const isGroupLeader = useCallback(
    (group: shopGroupsAPI.AffiliateShopGroup) => group.creatorShopId === shopId,
    [shopId]
  );

  // O(1) membership check — Set is rebuilt only when myGroups changes.
  const myGroupIds = useMemo(
    () => new Set(myGroups.map(g => g.groupId)),
    [myGroups]
  );
  const isGroupMember = useCallback(
    (groupId: string) => myGroupIds.has(groupId),
    [myGroupIds]
  );

  // Show loading state while auth is initializing or wallet is auto-connecting
  if (!authInitialized || authLoading || isAutoConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <LoadingSpinner message="Checking your authentication status" />
        </div>
      </div>
    );
  }

  // Not connected state
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] px-4 py-16 sm:py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🏪</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">Affiliate Groups</h1>
            <p className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8">Connect your shop wallet to access affiliate groups</p>
            <ConnectButton client={client} theme="light" connectModal={{ size: "wide" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardLayout userRole="shop">
        {checkingSubscription ? (
          <div className="px-4 sm:px-6 lg:px-12 py-4 sm:py-6 lg:py-8" />
        ) : (
          <SubscriptionGuard shopData={shopData}>
            <div className="px-4 sm:px-6 lg:px-12 py-4 sm:py-6 lg:py-8 min-h-screen">
              {/* Breadcrumb and Header */}
              <div className="mb-6 sm:mb-8">
                <nav className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base mb-2 sm:mb-3 flex-wrap">
                  <Link href="/shop" className="text-gray-400 hover:text-white transition-colors">
                    <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Link>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                  <Link href="/shop/groups" className="flex items-center gap-1.5 sm:gap-2 text-[#FFCC00] hover:text-[#FFD700] transition-colors font-medium">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Affiliate Groups</span>
                  </Link>
                  {activeTab === "discover" && (
                    <>
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                      <span className="text-[#FFCC00] font-medium">Discover Groups</span>
                    </>
                  )}
                </nav>
                <p className="text-gray-400 text-xs sm:text-sm">
                  Browse, track, and grow your affiliate communities effortlessly.
                </p>
              </div>

              {/* Subscription Warning */}
              {!checkingSubscription && !subscriptionActive && (
                <div className="mb-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-orange-400 font-semibold text-sm sm:text-base mb-1">Subscription or RCG Qualification Required</h3>
                      <p className="text-orange-300 text-xs sm:text-sm mb-3">
                        You need an active RepairCoin subscription ($500/month) or RCG qualification (10K+ RCG tokens) to create or join affiliate shop groups.
                      </p>
                      <button
                        onClick={() => router.push('/shop/subscription-form')}
                        className="px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs sm:text-sm font-medium"
                      >
                        Subscribe Now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Header with Tabs and Actions */}
              <SectionHeader
                variant="page"
                className="border-y border-[#303236] py-3 sm:py-4"
                title={
                  <div className="p-1 rounded-md flex gap-1 sm:gap-2 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab("my-groups")}
                      className={`flex-1 lg:flex-none whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 rounded font-medium text-sm sm:text-base transition-colors ${
                        activeTab === "my-groups"
                          ? "bg-[#FFCC00] text-[#101010]"
                          : "bg-[#dae0e7] text-[#101010] hover:bg-[#c8cdd3]"
                      }`}
                    >
                      My Groups ({myGroups.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("discover")}
                      className={`flex-1 lg:flex-none whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 rounded font-medium text-sm sm:text-base transition-colors ${
                        activeTab === "discover"
                          ? "bg-[#FFCC00] text-[#101010]"
                          : "bg-[#dae0e7] text-[#101010] hover:bg-[#c8cdd3]"
                      }`}
                    >
                      Discover Groups{discoverLoaded ? ` (${discoverTotalItems})` : ""}
                    </button>
                  </div>
                }
                action={
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                      onClick={() => subscriptionActive && setShowJoinModal(true)}
                      disabled={!subscriptionActive}
                      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border transition-colors ${
                        subscriptionActive
                          ? "bg-white border-[#dde2e4] text-[#101010] hover:bg-gray-50"
                          : "bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed opacity-50"
                      }`}
                      title={!subscriptionActive ? "Active subscription required" : ""}
                    >
                      <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm font-medium">Join Group</span>
                    </button>

                    <button
                      onClick={() => subscriptionActive && setShowCreateModal(true)}
                      disabled={!subscriptionActive}
                      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border transition-colors ${
                        subscriptionActive
                          ? "bg-white border-[#dde2e4] text-[#101010] hover:bg-gray-50"
                          : "bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed opacity-50"
                      }`}
                      title={!subscriptionActive ? "Active subscription required" : ""}
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm font-medium">Create Group</span>
                    </button>

                    {/* Sort Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border bg-white border-[#dde2e4] text-[#101010] hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-[10px] sm:text-xs text-[#535353]">Sort by</span>
                        <span className="text-xs sm:text-sm font-medium">{getSortLabel(sortBy)}</span>
                        <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>

                      {showSortDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-[#dde2e4] rounded-md shadow-lg z-20">
                            {GROUP_SORT_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSortBy(option.value);
                                  setShowSortDropdown(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                  sortBy === option.value ? "text-[#FFCC00] font-medium" : "text-[#101010]"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                }
              />

              {/* Content */}
              {loading ? (
                <LoadingSpinner message="Loading groups..." />
              ) : (
                <div>
                  {activeTab === "my-groups" ? (
                    myGroups.length === 0 ? (
                      <div className="bg-[#101010] rounded-lg p-6 sm:p-12">
                        <EmptyState
                          icon={Users}
                          title="No Groups Yet"
                          description="Create your first shop group or join an existing one"
                          action={
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                              <button
                                onClick={() => subscriptionActive && setShowCreateModal(true)}
                                disabled={!subscriptionActive}
                                className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-colors font-medium text-sm sm:text-base ${
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
                                className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-colors text-sm sm:text-base ${
                                  subscriptionActive
                                    ? "bg-gray-700 text-white hover:bg-gray-600"
                                    : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                                }`}
                                title={!subscriptionActive ? "Active subscription required" : ""}
                              >
                                Join Group
                              </button>
                            </div>
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        {/* My Groups Search */}
                        {myGroups.length > 3 && (
                          <div className="relative mb-4 sm:mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            <input
                              type="text"
                              value={myGroupsSearch}
                              onChange={(e) => setMyGroupsSearch(e.target.value)}
                              placeholder="Search your groups..."
                              className="w-full pl-10 pr-10 py-2 sm:py-2.5 text-sm sm:text-base bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                            />
                            {myGroupsSearch && (
                              <button
                                onClick={() => setMyGroupsSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                              >
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                            )}
                          </div>
                        )}

                        {sortedMyGroups.length === 0 && myGroupsSearch ? (
                          <div className="bg-[#101010] rounded-lg p-6 sm:p-12">
                            <EmptyState
                              icon={Search}
                              title="No Groups Found"
                              description={`No groups matching "${myGroupsSearch}"`}
                            />
                          </div>
                        ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
                        )}
                      </div>
                    )
                  ) : (
                    <div>
                      {/* Search Input */}
                      <div className="relative mb-4 sm:mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        <input
                          type="text"
                          value={discoverSearch}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          placeholder="Search groups by name or token symbol..."
                          className="w-full pl-10 pr-10 py-2 sm:py-2.5 text-sm sm:text-base bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                        />
                        {discoverSearch && (
                          <button
                            onClick={() => { setDiscoverSearch(""); loadDiscoverGroups("", 1, false); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        )}
                      </div>

                      {discoverLoading && allGroups.length === 0 ? (
                        <LoadingSpinner message="Loading groups..." />
                      ) : (
                        <>
                          {/* Results count */}
                          <p className="text-xs sm:text-sm text-gray-400 mb-4">
                            Showing {allGroups.length} of {discoverTotalItems} groups
                          </p>

                          {sortedAllGroups.length === 0 ? (
                            <div className="bg-[#101010] rounded-lg p-6 sm:p-12">
                              <EmptyState
                                icon={TrendingUp}
                                title={discoverSearch ? "No Groups Found" : "No Groups Available"}
                                description={discoverSearch ? `No groups matching "${discoverSearch}"` : "Be the first to create a shop group!"}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                {sortedAllGroups.map((group) => {
                                  const isMember = isGroupMember(group.groupId);
                                  return (
                                    <GroupCard
                                      key={group.groupId}
                                      group={group}
                                      onClick={() => handleGroupClick(group.groupId)}
                                      showMemberBadge={isMember}
                                      isLeader={isGroupLeader(group)}
                                      isDiscoverTab={!isMember}
                                      onJoinClick={() => subscriptionActive && setShowJoinModal(true)}
                                    />
                                  );
                                })}
                              </div>

                              {/* Load More Button */}
                              {discoverHasMore && (
                                <div className="flex justify-center mt-6">
                                  <button
                                    onClick={handleLoadMore}
                                    disabled={discoverLoadingMore}
                                    className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {discoverLoadingMore ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading...
                                      </>
                                    ) : (
                                      <>Load More Groups</>
                                    )}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SubscriptionGuard>
        )}
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
