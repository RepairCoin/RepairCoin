"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { Users, Plus, Settings, TrendingUp } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import CreateGroupModal from "./CreateGroupModal";
import GroupCard from "./GroupCard";
import JoinGroupModal from "./JoinGroupModal";

export default function AffiliateShopGroupsClient() {
  const account = useActiveAccount();
  const router = useRouter();

  const [myGroups, setMyGroups] = useState<shopGroupsAPI.AffiliateShopGroup[]>([]);
  const [allGroups, setAllGroups] = useState<shopGroupsAPI.AffiliateShopGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my-groups" | "discover">("my-groups");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState<boolean>(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  useEffect(() => {
    console.log("🔍 AffiliateShopGroupsClient - account:", account?.address);
    if (account?.address) {
      loadData();
      checkSubscription();
    } else {
      console.log("❌ No account address, setting loading to false");
      setLoading(false);
    }
  }, [account?.address]);

  const checkSubscription = async () => {
    try {
      setCheckingSubscription(true);
      console.log("🔍 Checking subscription status...");

      // Try to get shop profile from localStorage first
      const shopAuthToken = localStorage.getItem('shopAuthToken');
      if (!shopAuthToken) {
        console.log("❌ No shop auth token found");
        setSubscriptionActive(false);
        return;
      }

      // Get shop ID from wallet address
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/wallet/${account?.address}`, {
        headers: {
          Authorization: `Bearer ${shopAuthToken}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("📦 Shop data:", result);
        const isActive = result.data?.subscriptionActive || result.subscriptionActive || false;
        console.log(`✅ Subscription active: ${isActive}`);
        setSubscriptionActive(isActive);
      } else {
        console.log("❌ Failed to fetch shop data:", response.status);
        setSubscriptionActive(false);
      }
    } catch (error) {
      console.error("❌ Error checking subscription:", error);
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
      setMyGroups(myGroupsData);
      setAllGroups(allGroupsData);
    } catch (error) {
      console.error("Error loading groups:", error);
      toast.error("Failed to load shop groups");
    } finally {
      setLoading(false);
    }
  };

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

  if (!account?.address) {
    return (
      <DashboardLayout
        title="Shop Groups"
        subtitle="Connect your wallet to manage shop groups"
      >
        <div className="text-center py-12">
          <p className="text-gray-400">Please connect your wallet to continue</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <DashboardLayout
        title="Shop Groups"
        subtitle="Create and manage shop coalitions with custom tokens"
      >
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
                <h3 className="text-orange-400 font-semibold mb-1">Active Subscription Required</h3>
                <p className="text-orange-300 text-sm mb-3">
                  You need an active RepairCoin subscription ($500/month) to create or join affiliate shop groups.
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

        {/* Header Actions */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("my-groups")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "my-groups"
                  ? "bg-[#FFCC00] text-black"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              My Groups ({myGroups.length})
            </button>
            <button
              onClick={() => setActiveTab("discover")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "discover"
                  ? "bg-[#FFCC00] text-black"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Discover Groups ({allGroups.length})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => subscriptionActive && setShowJoinModal(true)}
              disabled={!subscriptionActive}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                subscriptionActive
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
              }`}
              title={!subscriptionActive ? "Active subscription required" : ""}
            >
              <Users className="w-4 h-4" />
              Join Group
            </button>
            <button
              onClick={() => subscriptionActive && setShowCreateModal(true)}
              disabled={!subscriptionActive}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium ${
                subscriptionActive
                  ? "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
              }`}
              title={!subscriptionActive ? "Active subscription required" : ""}
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
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
              myGroups.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/50 rounded-lg">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myGroups.map((group) => (
                    <GroupCard
                      key={group.groupId}
                      group={group}
                      onClick={() => handleGroupClick(group.groupId)}
                      showMemberBadge
                    />
                  ))}
                </div>
              )
            ) : (
              allGroups.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/50 rounded-lg">
                  <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No Groups Available</h3>
                  <p className="text-gray-400">
                    Be the first to create a shop group!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allGroups.map((group) => (
                    <GroupCard
                      key={group.groupId}
                      group={group}
                      onClick={() => handleGroupClick(group.groupId)}
                    />
                  ))}
                </div>
              )
            )}
          </div>
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
