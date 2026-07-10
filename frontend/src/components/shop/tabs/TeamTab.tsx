"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Users, UserPlus, Trash2, Pencil, Ban, X, Mail, Copy, Check } from "lucide-react";
import {
  getTeamMembers,
  inviteMember,
  resendInvite,
  updateMember,
  suspendMember,
  removeMember,
  SHOP_PERMISSIONS,
  type TeamMember,
  type TeamRole,
  type InviteResult,
} from "@/services/api/team";

interface TeamTabProps {
  shopId: string;
}

const ROLE_OPTIONS: { value: Exclude<TeamRole, "owner">; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
  { value: "custom", label: "Custom" },
];

const roleBadge: Record<string, string> = {
  owner: "bg-[#FFCC00] text-black",
  manager: "bg-blue-500/20 text-blue-300",
  staff: "bg-gray-500/20 text-gray-300",
  custom: "bg-purple-500/20 text-purple-300",
};

const statusBadge: Record<string, string> = {
  active: "bg-green-500/20 text-green-300",
  invited: "bg-yellow-500/20 text-yellow-300",
  suspended: "bg-orange-500/20 text-orange-300",
  removed: "bg-red-500/20 text-red-300",
};

export function TeamTab({ shopId }: TeamTabProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [inviteLink, setInviteLink] = useState<InviteResult | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await getTeamMembers();
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading team members:", error);
      toast.error("Failed to load team members");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (member: TeamMember) => {
    if (!confirm(`Suspend ${member.email}? They will lose access until reactivated.`)) return;
    try {
      await suspendMember(member.id);
      toast.success("Member suspended");
      loadMembers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to suspend member");
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.email} from the team? This cannot be undone.`)) return;
    try {
      await removeMember(member.id);
      toast.success("Member removed");
      loadMembers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove member");
    }
  };

  const handleResend = async (member: TeamMember) => {
    try {
      const result = await resendInvite(member.id);
      setInviteLink(result);
      toast.success(result.emailSent ? "Invitation resent" : "Invite link regenerated (email failed to send)");
      loadMembers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to resend invitation");
    }
  };

  const openInvite = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditing(member);
    setShowModal(true);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#303236] pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FFCC00]" /> Team Management
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Invite staff and assign roles with granular permissions.
            </p>
          </div>
          <button
            onClick={openInvite}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] transition-colors"
          >
            <UserPlus className="w-5 h-5" /> Invite member
          </button>
        </div>

        {inviteLink && (
          <div className="bg-[#101010] border border-[#303236] rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className={`w-4 h-4 ${inviteLink.emailSent ? "text-green-400" : "text-orange-400"}`} />
                <span className={inviteLink.emailSent ? "text-green-300" : "text-orange-300"}>
                  {inviteLink.emailSent
                    ? `Invitation emailed to ${inviteLink.member.email}. You can also share this link:`
                    : `Email couldn't be sent to ${inviteLink.member.email}. Share this link manually:`}
                </span>
              </div>
              <button onClick={() => setInviteLink(null)} className="text-gray-400 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <CopyLink url={inviteLink.acceptUrl} />
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto" />
            <p className="mt-4 text-gray-400">Loading team...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 bg-[#101010] rounded-lg">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No team members yet</h3>
            <p className="text-gray-400 mb-6">Invite your first staff member to get started.</p>
            <button
              onClick={openInvite}
              className="px-6 py-3 rounded-lg bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] transition-colors"
            >
              Invite member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#303236]">
            <table className="w-full text-left">
              <thead className="bg-[#1e1f22] text-gray-400 text-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Permissions</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303236]">
                {members.map((m) => (
                  <tr key={m.id} className="text-white">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.name || "—"}</div>
                      <div className="text-sm text-gray-400">{m.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${roleBadge[m.role] || roleBadge.custom}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusBadge[m.status] || ""}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {m.permissions.includes("*") ? "All permissions" : `${m.permissions.length} permission${m.permissions.length === 1 ? "" : "s"}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {m.role !== "owner" && (
                          <>
                            {m.status === "invited" && (
                              <button
                                onClick={() => handleResend(m)}
                                className="p-1.5 rounded hover:bg-[#303236] text-blue-300"
                                title="Resend invitation"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(m)}
                              className="p-1.5 rounded hover:bg-[#303236] text-gray-300"
                              title="Edit role & permissions"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {m.status === "active" && (
                              <button
                                onClick={() => handleSuspend(m)}
                                className="p-1.5 rounded hover:bg-[#303236] text-orange-300"
                                title="Suspend"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemove(m)}
                              className="p-1.5 rounded hover:bg-[#303236] text-red-300"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <MemberModal
          member={editing}
          onClose={() => setShowModal(false)}
          onSaved={(result) => {
            setShowModal(false);
            if (result) setInviteLink(result);
            loadMembers();
          }}
        />
      )}
    </>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };
  return (
    <div className="flex items-center gap-2 mt-3">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        className="flex-1 px-3 py-2 rounded-md bg-[#1a1b1e] border border-[#303236] text-gray-300 text-sm font-mono"
      />
      <button
        onClick={copy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#FFCC00] text-black text-sm font-medium hover:bg-[#FFD700] shrink-0"
      >
        {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
      </button>
    </div>
  );
}

interface MemberModalProps {
  member: TeamMember | null;
  onClose: () => void;
  onSaved: (result?: InviteResult) => void;
}

function MemberModal({ member, onClose, onSaved }: MemberModalProps) {
  const isEdit = !!member;
  const [email, setEmail] = useState(member?.email || "");
  const [name, setName] = useState(member?.name || "");
  const [role, setRole] = useState<Exclude<TeamRole, "owner">>(
    (member && member.role !== "owner" ? member.role : "staff") as Exclude<TeamRole, "owner">
  );
  const [permissions, setPermissions] = useState<string[]>(
    member ? member.permissions.filter((p) => p !== "*") : []
  );
  const [saving, setSaving] = useState(false);

  const togglePermission = (value: string) => {
    setPermissions((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    if (!isEdit && (!email || !email.includes("@"))) {
      toast.error("Enter a valid email");
      return;
    }
    if (role === "custom" && permissions.length === 0) {
      toast.error("Select at least one permission for a custom role");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateMember(member!.id, {
          name: name || undefined,
          role,
          permissions: role === "custom" ? permissions : undefined,
        });
        toast.success("Member updated");
        onSaved();
      } else {
        const result = await inviteMember({
          email,
          name: name || undefined,
          role,
          permissions: role === "custom" ? permissions : undefined,
        });
        toast.success(result.emailSent ? "Invitation sent" : "Member invited — copy the link to share");
        onSaved(result);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1a1b1e] border border-[#303236] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303236]">
          <h3 className="text-lg font-bold text-white">
            {isEdit ? "Edit member" : "Invite member"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled={isEdit}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white disabled:opacity-50 focus:border-[#FFCC00] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Exclude<TeamRole, "owner">)}
              className="w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {role !== "custom" && (
              <p className="text-xs text-gray-500 mt-1">
                {role === "manager"
                  ? "Full access except billing and team management."
                  : "Bookings, rewards, redemptions, and customer lookup."}
              </p>
            )}
          </div>

          {role === "custom" && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SHOP_PERMISSIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={permissions.includes(p.value)}
                      onChange={() => togglePermission(p.value)}
                      className="accent-[#FFCC00]"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#303236]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-[#303236] text-gray-300 hover:bg-[#303236]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Save changes" : "Send invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}
