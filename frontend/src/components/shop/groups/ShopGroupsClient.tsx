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

  useEffect(() => {
    console.log("🔍 AffiliateShopGroupsClient - account:", account?.address);
    if (account?.address) {
      loadData();
    } else {
      console.log("❌ No account address, setting loading to false");
      setLoading(false);
    }
  }, [account?.address]);

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
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Join Group
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2 font-medium border-4 border-red-500"
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
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium"
                    >
                      Create Group
                    </button>
                    <button
                      onClick={() => setShowJoinModal(true)}
                      className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
