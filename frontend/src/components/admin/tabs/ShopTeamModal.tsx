"use client";

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { X, Users, Edit, ShieldOff, Power, Trash2, Loader2, Check } from "lucide-react";
import {
  getShopTeam,
  updateShopTeamMember,
  suspendShopTeamMember,
  reactivateShopTeamMember,
  removeShopTeamMember,
} from "@/services/api/adminTeam";
import {
  SHOP_PERMISSIONS,
  type TeamMember,
  type TeamRole,
  type TeamStatus,
} from "@/services/api/team";

interface ShopTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
}

const ROLE_BADGE: Record<TeamRole, string> = {
  owner: "bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/20",
  manager: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  staff: "bg-gray-500/10 text-gray-300 border-gray-500/20",
  custom: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const STATUS_BADGE: Record<TeamStatus, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  invited: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  removed: "bg-red-500/10 text-red-400 border-red-500/20",
};

const EDITABLE_ROLES: Exclude<TeamRole, "owner">[] = ["manager", "staff", "custom"];

export const ShopTeamModal: React.FC<ShopTeamModalProps> = ({
  isOpen,
  onClose,
  shopId,
  shopName,
}) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Exclude<TeamRole, "owner">>("staff");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadTeam = async () => {
    setLoading(true);
    try {
      setMembers(await getShopTeam(shopId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && shopId) {
      setEditingId(null);
      loadTeam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, shopId]);

  if (!isOpen) return null;

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setEditRole(member.role === "owner" ? "staff" : member.role);
    setEditPermissions(member.permissions.filter((p) => p !== "*"));
  };

  const togglePermission = (value: string) => {
    setEditPermissions((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const saveEdit = async (memberId: string) => {
    if (editRole === "custom" && editPermissions.length === 0) {
      toast.error("Select at least one permission for a custom role");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateShopTeamMember(shopId, memberId, {
        role: editRole,
        permissions: editRole === "custom" ? editPermissions : undefined,
      });
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
      setEditingId(null);
      toast.success("Member updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update member");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    memberId: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setBusyId(memberId);
    try {
      await action();
      toast.success(successMessage);
      await loadTeam();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const permissionSummary = (member: TeamMember) => {
    if (member.permissions.includes("*")) return "All permissions";
    if (member.permissions.length === 0) return "No permissions";
    return `${member.permissions.length} permission${member.permissions.length === 1 ? "" : "s"}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFCC00]/10">
              <Users className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Team Management</h3>
              <p className="text-xs text-gray-400">{shopName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading team...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No team members found.</div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const isOwner = member.role === "owner";
                const isEditing = editingId === member.id;
                const isBusy = busyId === member.id;

                return (
                  <div
                    key={member.id}
                    className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {member.name || member.email}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{member.email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${ROLE_BADGE[member.role]}`}
                          >
                            {member.role}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_BADGE[member.status]}`}
                          >
                            {member.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {permissionSummary(member)}
                          </span>
                        </div>
                      </div>

                      {!isOwner && !isEditing && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => startEdit(member)}
                            disabled={isBusy}
                            className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                            title="Edit role & permissions"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {member.status === "suspended" ? (
                            <button
                              onClick={() =>
                                runAction(
                                  member.id,
                                  () => reactivateShopTeamMember(shopId, member.id),
                                  "Member reactivated"
                                )
                              }
                              disabled={isBusy}
                              className="p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                              title="Reactivate"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          ) : member.status === "active" ? (
                            <button
                              onClick={() =>
                                runAction(
                                  member.id,
                                  () => suspendShopTeamMember(shopId, member.id),
                                  "Member suspended"
                                )
                              }
                              disabled={isBusy}
                              className="p-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                              title="Suspend"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Remove ${member.name || member.email} from this shop's team?`
                                )
                              ) {
                                runAction(
                                  member.id,
                                  () => removeShopTeamMember(shopId, member.id),
                                  "Member removed"
                                );
                              }
                            }}
                            disabled={isBusy}
                            className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Edit panel */}
                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-gray-700/50">
                        <label className="block text-xs font-medium text-gray-300 mb-2">Role</label>
                        <div className="flex gap-2 mb-4">
                          {EDITABLE_ROLES.map((role) => (
                            <button
                              key={role}
                              onClick={() => setEditRole(role)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors border ${
                                editRole === role
                                  ? "bg-[#FFCC00] text-black border-[#FFCC00]"
                                  : "bg-gray-800 text-gray-300 border-gray-700 hover:text-white"
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>

                        {editRole === "custom" ? (
                          <>
                            <label className="block text-xs font-medium text-gray-300 mb-2">
                              Permissions
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                              {SHOP_PERMISSIONS.map((perm) => {
                                const checked = editPermissions.includes(perm.value);
                                return (
                                  <button
                                    key={perm.value}
                                    onClick={() => togglePermission(perm.value)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors border ${
                                      checked
                                        ? "bg-[#FFCC00]/10 text-white border-[#FFCC00]/40"
                                        : "bg-gray-800 text-gray-400 border-gray-700 hover:text-white"
                                    }`}
                                  >
                                    <span
                                      className={`flex items-center justify-center w-4 h-4 rounded border ${
                                        checked
                                          ? "bg-[#FFCC00] border-[#FFCC00]"
                                          : "border-gray-600"
                                      }`}
                                    >
                                      {checked && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                                    </span>
                                    {perm.label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-gray-500 mb-4">
                            Permissions are applied automatically from the {editRole} role template.
                          </p>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={saving}
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(member.id)}
                            disabled={saving}
                            className="px-4 py-2 bg-[#FFCC00] hover:bg-[#E6B800] text-black font-medium rounded-lg transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                          >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save Changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
