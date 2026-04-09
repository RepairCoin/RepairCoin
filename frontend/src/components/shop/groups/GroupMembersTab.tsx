"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Users, Crown, Mail, X } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import { LoadingSpinner, Pagination, EmptyState, FilterTabs, SectionHeader, Modal } from "./shared";
import { formatDate } from "./utils/formatters";
import { usePagination } from "@/hooks/usePagination";
import { ITEMS_PER_PAGE } from "./constants";
import type { MemberFilterType, FilterOption } from "./types";

interface GroupMembersTabProps {
  groupId: string;
  currentShopId?: string;
}

export default function GroupMembersTab({ groupId, currentShopId }: GroupMembersTabProps) {
  const [members, setMembers] = useState<shopGroupsAPI.AffiliateShopGroupMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<shopGroupsAPI.AffiliateShopGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<MemberFilterType>("active");
  const [memberToRemove, setMemberToRemove] = useState<shopGroupsAPI.AffiliateShopGroupMember | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [viewingApplication, setViewingApplication] = useState<shopGroupsAPI.AffiliateShopGroupMember | null>(null);

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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Error approving member:", error);
      toast.error(err?.response?.data?.error || "Failed to approve member");
    }
  };

  const handleRejectMember = async (shopId: string) => {
    try {
      await shopGroupsAPI.rejectMember(groupId, shopId);
      toast.success("Member request rejected");
      loadMembers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Error rejecting member:", error);
      toast.error(err?.response?.data?.error || "Failed to reject member");
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      await shopGroupsAPI.removeMember(groupId, memberToRemove.shopId);
      toast.success("Member removed successfully");
      setMemberToRemove(null);
      loadMembers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Error removing member:", error);
      toast.error(err?.response?.data?.error || "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-8">
        <LoadingSpinner message="Loading members..." />
      </div>
    );
  }

  const displayMembers = activeFilter === "active" ? members : pendingMembers;

  // Sort to show current user's shop first, then admins
  const sortedMembers = [...displayMembers].sort((a, b) => {
    if (currentShopId) {
      if (a.shopId === currentShopId) return -1;
      if (b.shopId === currentShopId) return 1;
    }
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return 0;
  });

  const filterOptions: FilterOption<MemberFilterType>[] = [
    { value: "active", label: "Active", count: members.length },
    { value: "pending", label: "Pending", count: pendingMembers.length },
  ];

  return (
    <div className="bg-[#101010] rounded-[20px] p-6">
      <SectionHeader
        icon={Users}
        title="Group Members"
        action={
          <FilterTabs
            options={filterOptions}
            value={activeFilter}
            onChange={(value) => setActiveFilter(value)}
          />
        }
      />

      {/* Table */}
      {!Array.isArray(sortedMembers) || sortedMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={activeFilter === "active" ? "No active members yet" : "No pending requests"}
          description={
            activeFilter === "active"
              ? "Invite people to join your group"
              : "Member requests will appear here"
          }
        />
      ) : (
        <MembersTable
          members={sortedMembers}
          activeFilter={activeFilter}
          currentShopId={currentShopId}
          isCurrentUserAdmin={isCurrentUserAdmin}
          onViewApplication={setViewingApplication}
          onApprove={handleApproveMember}
          onReject={handleRejectMember}
          onRemove={setMemberToRemove}
        />
      )}

      {/* View Application Modal */}
      {viewingApplication && (
        <Modal
          isOpen={!!viewingApplication}
          onClose={() => setViewingApplication(null)}
          title="Application Details"
          subtitle={viewingApplication.shopName || viewingApplication.shopId}
          icon={<Mail className="w-6 h-6 text-[#FFCC00]" />}
          footer={
            <>
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
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-[#1e1f22] rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Applied on</p>
              <p className="text-white font-medium">
                {formatDate(viewingApplication.joinedAt)}
              </p>
            </div>

            {viewingApplication.requestMessage && (
              <div className="bg-[#1e1f22] rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Message</p>
                <p className="text-white">&quot;{viewingApplication.requestMessage}&quot;</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Remove Member Modal */}
      {memberToRemove && (
        <Modal
          isOpen={!!memberToRemove}
          onClose={() => setMemberToRemove(null)}
          title="Remove Member?"
          icon={<X className="w-6 h-6 text-red-400" />}
          footer={
            <>
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
            </>
          }
        >
          <p className="text-gray-400">
            Are you sure you want to remove{" "}
            <span className="font-semibold text-white">
              {memberToRemove.shopName || memberToRemove.shopId}
            </span>{" "}
            from this group? This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

// Separate table component for better organization
interface MembersTableProps {
  members: shopGroupsAPI.AffiliateShopGroupMember[];
  activeFilter: MemberFilterType;
  currentShopId?: string;
  isCurrentUserAdmin: boolean;
  onViewApplication: (member: shopGroupsAPI.AffiliateShopGroupMember) => void;
  onApprove: (shopId: string) => void;
  onReject: (shopId: string) => void;
  onRemove: (member: shopGroupsAPI.AffiliateShopGroupMember) => void;
}

function MembersTable({
  members,
  activeFilter,
  currentShopId,
  isCurrentUserAdmin,
  onViewApplication,
  onApprove,
  onReject,
  onRemove,
}: MembersTableProps) {
  const {
    paginatedItems,
    currentPage,
    totalPages,
    setPage,
    startIndex,
  } = usePagination(members, { itemsPerPage: ITEMS_PER_PAGE });

  return (
    <>
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
                  {isCurrentUserAdmin && (
                    <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Action</th>
                  )}
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
            {paginatedItems.map((member, index) => {
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
                            ? `Joined ${formatDate(member.joinedAt, { shortFormat: true })}`
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
                      {isCurrentUserAdmin && (
                        <td className="py-4 px-4 text-center">
                          {!isCurrentUser && member.role !== 'admin' ? (
                            <button
                              onClick={() => onRemove(member)}
                              className="px-3 py-1.5 text-red-400 hover:text-white hover:bg-red-600 text-xs font-medium rounded-lg border border-red-500/30 transition-all duration-200"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      )}
                    </>
                  ) : (
                    <>
                      <td className="py-4 px-4 text-white">
                        {formatDate(member.joinedAt, { shortFormat: true })}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => onViewApplication(member)}
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
                              onClick={() => onApprove(member.shopId)}
                              className="px-4 py-1.5 bg-[#FFCC00] hover:bg-[#FFD700] text-[#101010] text-sm font-semibold rounded-lg transition-all duration-200"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => onReject(member.shopId)}
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

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </>
  );
}
