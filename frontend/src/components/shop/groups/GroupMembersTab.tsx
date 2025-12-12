"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Users, Check, X, Crown, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface GroupMembersTabProps {
  groupId: string;
  currentShopId?: string;
}

export default function GroupMembersTab({ groupId, currentShopId }: GroupMembersTabProps) {
  const [members, setMembers] = useState<shopGroupsAPI.AffiliateShopGroupMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<shopGroupsAPI.AffiliateShopGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"active" | "pending">("active");
  const [memberToRemove, setMemberToRemove] = useState<shopGroupsAPI.AffiliateShopGroupMember | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingApplication, setViewingApplication] = useState<shopGroupsAPI.AffiliateShopGroupMember | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadMembers();
  }, [groupId, currentShopId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const [activeMembers, pending] = await Promise.all([
        shopGroupsAPI.getGroupMembers(groupId, "active"),
        shopGroupsAPI.getGroupMembers(groupId, "pending"),
      ]);
      const activeMembersList = Array.isArray(activeMembers) ? activeMembers : [];
      setMembers(activeMembersList);
      setPendingMembers(Array.isArray(pending) ? pending : []);

      // Check if current user is an admin
      if (currentShopId) {
        const currentMember = activeMembersList.find(m => m.shopId === currentShopId);
        setIsCurrentUserAdmin(currentMember?.role === 'admin');
      }
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members");
      setMembers([]);
      setPendingMembers([]);
      setIsCurrentUserAdmin(false);
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

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      await shopGroupsAPI.removeMember(groupId, memberToRemove.shopId);
      toast.success("Member removed successfully");
      setMemberToRemove(null);
      loadMembers();
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast.error(error?.response?.data?.error || "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-8">
        <div className="text-center py-12">
          <div className="relative mx-auto w-12 h-12">
            <div className="w-12 h-12 border-4 border-gray-800 border-t-[#FFCC00] rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-gray-400 font-medium">Loading members...</p>
        </div>
      </div>
    );
  }

  const displayMembers = activeFilter === "active" ? members : pendingMembers;

  // Sort to show current user's shop first, then admins
  const sortedMembers = [...displayMembers].sort((a, b) => {
    // 1. Current user's shop always first
    if (currentShopId) {
      if (a.shopId === currentShopId) return -1;
      if (b.shopId === currentShopId) return 1;
    }
    // 2. Then admins before regular members
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    // 3. Then maintain original order
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = sortedMembers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="bg-[#101010] rounded-[20px] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Group Members</h3>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveFilter("active"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeFilter === "active"
                ? "bg-[#FFCC00] text-[#101010]"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Active ({members.length})
          </button>
          <button
            onClick={() => { setActiveFilter("pending"); setCurrentPage(1); }}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeFilter === "pending"
                ? "bg-[#FFCC00] text-[#101010]"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Pending ({pendingMembers.length})
            {pendingMembers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      {!Array.isArray(sortedMembers) || sortedMembers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-medium">
            {activeFilter === "active" ? "No active members yet" : "No pending requests"}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {activeFilter === "active"
              ? "Invite people to join your group"
              : "Member requests will appear here"}
          </p>
        </div>
      ) : (
        <>
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm w-12">#</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Shop</th>
                  {activeFilter === "active" ? (
                    <>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Rank</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">RCN Allocated</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">RCN Used</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">RCN Available</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Date Applied</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">View Application</th>
                      {isCurrentUserAdmin && (
                        <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Action</th>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedMembers.map((member, index) => {
                  const isCurrentUser = member.shopId === currentShopId;
                  const rowNumber = startIndex + index + 1;

                  return (
                    <tr key={member.shopId} className="border-b border-gray-800/50 hover:bg-[#1e1f22]/50">
                      <td className="py-4 px-4 text-white font-medium">{rowNumber}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-white font-medium flex items-center gap-2">
                              {member.shopName || member.shopId}
                              {member.role === "admin" && (
                                <Crown className="w-4 h-4 text-[#FFCC00]" />
                              )}
                            </p>
                            <p className="text-gray-500 text-sm">
                              {activeFilter === "active"
                                ? `Joined ${new Date(member.joinedAt).toLocaleDateString("en-US", {
                                    month: "numeric",
                                    day: "numeric",
                                    year: "numeric",
                                  })}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      {activeFilter === "active" ? (
                        <>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              {member.role === "admin" ? (
                                <span className="px-3 py-1 bg-[#FFCC00] text-[#101010] text-xs font-semibold rounded-lg">
                                  Admin
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-[#1e1f22] text-white text-xs font-semibold rounded-lg border border-gray-700">
                                  Member
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="px-3 py-1 bg-[#FFCC00] text-[#101010] text-xs font-semibold rounded-lg">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center text-white">
                            {member.allocatedRcn?.toLocaleString() || 0}
                          </td>
                          <td className="py-4 px-4 text-center text-white">
                            {member.usedRcn?.toLocaleString() || 0}
                          </td>
                          <td className="py-4 px-4 text-center text-white">
                            {member.availableRcn?.toLocaleString() || 0}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-4 px-4 text-white">
                            {new Date(member.joinedAt).toLocaleDateString("en-US", {
                              month: "numeric",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => setViewingApplication(member)}
                              className="inline-flex items-center gap-1.5 text-[#FFCC00] hover:text-[#FFD700] text-sm font-medium"
                            >
                              <Mail className="w-4 h-4" />
                              View Application
                            </button>
                          </td>
                          {isCurrentUserAdmin && (
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleApproveMember(member.shopId)}
                                  className="px-4 py-1.5 bg-[#FFCC00] hover:bg-[#FFD700] text-[#101010] text-sm font-semibold rounded-lg transition-all duration-200"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRejectMember(member.shopId)}
                                  className="px-4 py-1.5 bg-[#1e1f22] hover:bg-[#2a2b2f] text-white text-sm font-semibold rounded-lg border border-gray-700 transition-all duration-200"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-800">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                      currentPage === page
                        ? "bg-[#1e1f22] text-white border border-gray-600"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* View Application Modal */}
      {viewingApplication && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101010] rounded-2xl border border-gray-800 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 p-3 bg-[#FFCC00]/10 rounded-xl">
                <Mail className="w-6 h-6 text-[#FFCC00]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">Application Details</h3>
                <p className="text-gray-400 text-sm">
                  {viewingApplication.shopName || viewingApplication.shopId}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-[#1e1f22] rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Applied on</p>
                <p className="text-white font-medium">
                  {new Date(viewingApplication.joinedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              {viewingApplication.requestMessage && (
                <div className="bg-[#1e1f22] rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Message</p>
                  <p className="text-white">&quot;{viewingApplication.requestMessage}&quot;</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setViewingApplication(null)}
                className="flex-1 px-6 py-3 bg-[#1e1f22] hover:bg-[#2a2b2f] text-white font-semibold rounded-xl transition-all duration-200 border border-gray-700"
              >
                Close
              </button>
              {isCurrentUserAdmin && (
                <>
                  <button
                    onClick={() => {
                      handleApproveMember(viewingApplication.shopId);
                      setViewingApplication(null);
                    }}
                    className="flex-1 px-6 py-3 bg-[#FFCC00] hover:bg-[#FFD700] text-[#101010] font-semibold rounded-xl transition-all duration-200"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => {
                      handleRejectMember(viewingApplication.shopId);
                      setViewingApplication(null);
                    }}
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all duration-200"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101010] rounded-2xl border border-gray-800 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 p-3 bg-red-500/20 rounded-xl">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">Remove Member?</h3>
                <p className="text-gray-400">
                  Are you sure you want to remove{" "}
                  <span className="font-semibold text-white">
                    {memberToRemove.shopName || memberToRemove.shopId}
                  </span>{" "}
                  from this group? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                className="flex-1 px-6 py-3 bg-[#1e1f22] hover:bg-[#2a2b2f] text-white font-semibold rounded-xl transition-all duration-200 border border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all duration-200"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
