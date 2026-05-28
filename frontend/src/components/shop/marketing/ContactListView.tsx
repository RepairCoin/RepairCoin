"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Search,
  Plus,
  Upload,
  Mail,
  Phone,
  User,
  MoreVertical,
  Trash2,
  Edit,
  Tag,
  Filter,
  Download,
  Users,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactImportModal } from "./ContactImportModal";
import { EmailCampaignComposerModal } from "./EmailCampaignComposerModal";
import apiClient from "@/services/api/client";

interface Contact {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: "active" | "unsubscribed" | "bounced" | "invalid";
  tags: string[];
  emailSentCount: number;
  smsSentCount: number;
  lastEmailSentAt?: string;
  lastSmsSentAt?: string;
  createdAt: string;
}

interface ContactStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
  invalid: number;
}

interface ContactListViewProps {
  shopId: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  unsubscribed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  bounced: "bg-red-500/20 text-red-400 border-red-500/30",
  invalid: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export function ContactListView({ shopId }: ContactListViewProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showImport, setShowImport] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadData();
  }, [shopId, page, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch contacts
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery }),
      });

      const contactsData = await apiClient.get(
        `/marketing/shops/${shopId}/contacts?${params}`
      );

      if (contactsData.success) {
        setContacts(contactsData.data.contacts);
        setTotalPages(Math.ceil(contactsData.data.total / 50));
      }

      // Fetch stats
      const statsData = await apiClient.get(`/marketing/shops/${shopId}/contacts/stats`);

      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      await apiClient.delete(`/marketing/contacts/${contactId}`);

      toast.success("Contact deleted");
      loadData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete contact");
    }
  };

  const exportContacts = () => {
    const csv = [
      "Full Name,Email,Phone,Status,Tags,Email Sent,SMS Sent,Created At",
      ...contacts.map((c) =>
        [
          c.fullName,
          c.email || "",
          c.phone || "",
          c.status,
          c.tags.join(";"),
          c.emailSentCount,
          c.smsSentCount,
          new Date(c.createdAt).toLocaleDateString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <Users className="w-5 h-5 text-gray-400 mb-2" />
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-sm text-gray-400">Total Contacts</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
            <p className="text-2xl font-bold text-green-400">{stats.active}</p>
            <p className="text-sm text-gray-400">Active</p>
          </div>
          <div className="bg-gray-500/10 rounded-lg p-4 border border-gray-500/20">
            <p className="text-2xl font-bold text-gray-400">{stats.unsubscribed}</p>
            <p className="text-sm text-gray-400">Unsubscribed</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
            <p className="text-2xl font-bold text-red-400">{stats.bounced}</p>
            <p className="text-sm text-gray-400">Bounced</p>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
            <p className="text-2xl font-bold text-orange-400">{stats.invalid}</p>
            <p className="text-sm text-gray-400">Invalid</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          {/* Search */}
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-yellow-500 hover:bg-yellow-400 text-black"
            >
              Search
            </Button>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger variant="dark" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent variant="dark">
              <SelectItem variant="dark" value="all">All Status</SelectItem>
              <SelectItem variant="dark" value="active">Active</SelectItem>
              <SelectItem variant="dark" value="unsubscribed">Unsubscribed</SelectItem>
              <SelectItem variant="dark" value="bounced">Bounced</SelectItem>
              <SelectItem variant="dark" value="invalid">Invalid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportContacts}
            disabled={contacts.length === 0}
            className="border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setShowEmailComposer(true)}
            disabled={contacts.length === 0}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Email
          </Button>
          <Button
            onClick={() => setShowImport(true)}
            className="bg-yellow-500 hover:bg-yellow-400 text-black"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Contacts Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading contacts...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-12 text-center border border-gray-700">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Contacts Yet</h3>
          <p className="text-gray-400 mb-6">
            Import your customer contacts to send mass email and SMS campaigns
          </p>
          <Button
            onClick={() => setShowImport(true)}
            className="bg-yellow-500 hover:bg-yellow-400 text-black"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Contacts
          </Button>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-white font-medium flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {contact.fullName}
                        </p>
                        {contact.email && (
                          <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </p>
                        )}
                        {contact.phone && (
                          <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={`border ${statusColors[contact.status]}`}>
                        {contact.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.length > 0 ? (
                          contact.tags.slice(0, 2).map((tag, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-xs border-gray-600"
                            >
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No tags</span>
                        )}
                        {contact.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs border-gray-600">
                            +{contact.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      <div>
                        <p>📧 {contact.emailSentCount} emails</p>
                        <p>📱 {contact.smsSentCount} SMS</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDelete(contact.id)}
                            className="text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-gray-700"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border-gray-700"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Modal */}
      <ContactImportModal
        open={showImport}
        onClose={(imported) => {
          setShowImport(false);
          if (imported) loadData();
        }}
        shopId={shopId}
      />

      {/* Email Campaign Composer Modal */}
      <EmailCampaignComposerModal
        open={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        shopId={shopId}
        totalContacts={stats?.active || 0}
      />
    </div>
  );
}
