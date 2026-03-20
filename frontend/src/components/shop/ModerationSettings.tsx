"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Ban,
  AlertTriangle,
  UserX,
  Plus,
  X,
  Search,
  Flag,
  CheckCircle,
  Mail,
  Calendar,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getBlockedCustomers,
  blockCustomer,
  unblockCustomer,
  submitReport,
  getReports,
  BlockedCustomer,
  Report,
} from "@/services/api/moderation";

interface ModerationSettingsProps {
  shopId: string;
}

export const ModerationSettings: React.FC<ModerationSettingsProps> = ({ shopId }) => {
  const [loading, setLoading] = useState(true);
  const [blockedCustomers, setBlockedCustomers] = useState<BlockedCustomer[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"blocked" | "reports">("blocked");

  // Block customer form state
  const [blockForm, setBlockForm] = useState({
    customerWalletAddress: "",
    reason: "",
  });
  const [blocking, setBlocking] = useState(false);

  // Report form state
  const [reportForm, setReportForm] = useState({
    category: "spam" as "spam" | "fraud" | "inappropriate_review" | "harassment" | "other",
    description: "",
    severity: "medium" as "low" | "medium" | "high",
    relatedEntityType: "" as "" | "customer" | "review" | "order",
    relatedEntityId: "",
  });
  const [reporting, setReporting] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [shopId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [blocked, reportsList] = await Promise.all([
        getBlockedCustomers(shopId),
        getReports(shopId),
      ]);
      setBlockedCustomers(blocked);
      setReports(reportsList);
    } catch (error) {
      console.error("Error loading moderation data:", error);
      toast.error("Failed to load moderation data");
    } finally {
      setLoading(false);
    }
  };

  const handleBlockCustomer = async () => {
    if (!blockForm.customerWalletAddress || !blockForm.reason) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setBlocking(true);
      await blockCustomer(shopId, blockForm);
      toast.success("Customer blocked successfully");
      setShowBlockModal(false);
      setBlockForm({ customerWalletAddress: "", reason: "" });
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to block customer");
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (customerWalletAddress: string) => {
    if (!confirm("Are you sure you want to unblock this customer?")) return;

    try {
      await unblockCustomer(shopId, customerWalletAddress);
      toast.success("Customer unblocked successfully");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to unblock customer");
    }
  };

  const handleSubmitReport = async () => {
    if (!reportForm.category || !reportForm.description) {
      toast.error("Please fill in category and description");
      return;
    }

    try {
      setReporting(true);
      const reportData = {
        category: reportForm.category,
        description: reportForm.description,
        severity: reportForm.severity,
        ...(reportForm.relatedEntityType && {
          relatedEntityType: reportForm.relatedEntityType,
          relatedEntityId: reportForm.relatedEntityId,
        }),
      };
      await submitReport(shopId, reportData);
      toast.success("Report submitted successfully. Admins will review it soon.");
      setShowReportModal(false);
      setReportForm({
        category: "spam",
        description: "",
        severity: "medium",
        relatedEntityType: "",
        relatedEntityId: "",
      });
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit report");
    } finally {
      setReporting(false);
    }
  };

  // Filter blocked customers by search term
  const filteredBlockedCustomers = blockedCustomers.filter(
    (customer) =>
      customer.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customerWalletAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Moderation Tools</h2>
          <p className="text-sm text-gray-400">
            Manage blocked customers and report issues to admins
          </p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Flag className="w-4 h-4" />
          Report Issue
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab("blocked")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "blocked"
              ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Ban className="w-4 h-4 inline mr-2" />
          Blocked Customers ({blockedCustomers.length})
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "reports"
              ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Flag className="w-4 h-4 inline mr-2" />
          Reports ({reports.length})
        </button>
      </div>

      {/* Blocked Customers Tab */}
      {activeTab === "blocked" && (
        <div className="space-y-4">
          {/* Search and Block Button */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search blocked customers..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
              />
            </div>
            <button
              onClick={() => setShowBlockModal(true)}
              className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Block Customer
            </button>
          </div>

          {/* Blocked Customers List */}
          {filteredBlockedCustomers.length === 0 ? (
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-12 text-center">
              <UserX className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">
                {searchTerm ? "No matching blocked customers" : "No blocked customers"}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {searchTerm
                  ? "Try a different search term"
                  : "Block problematic customers to prevent them from booking services"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBlockedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                          <Ban className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">
                            {customer.customerName || "Unknown Customer"}
                          </h4>
                          <p className="text-xs text-gray-400 font-mono">
                            {customer.customerWalletAddress}
                          </p>
                        </div>
                      </div>
                      <div className="ml-13 space-y-1">
                        <p className="text-sm text-gray-300">
                          <span className="text-gray-500">Reason:</span> {customer.reason}
                        </p>
                        <p className="text-xs text-gray-500">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Blocked on {new Date(customer.blockedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblock(customer.customerWalletAddress)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-12 text-center">
              <Flag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No reports submitted</p>
              <p className="text-gray-500 text-sm mt-2">
                Report issues to admins for investigation
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          report.severity === "high"
                            ? "bg-red-500/10"
                            : report.severity === "medium"
                            ? "bg-yellow-500/10"
                            : "bg-blue-500/10"
                        }`}
                      >
                        <Flag
                          className={`w-5 h-5 ${
                            report.severity === "high"
                              ? "text-red-400"
                              : report.severity === "medium"
                              ? "text-yellow-400"
                              : "text-blue-400"
                          }`}
                        />
                      </div>
                      <div>
                        <h4 className="text-white font-medium capitalize">
                          {report.category.replace(/_/g, " ")}
                        </h4>
                        <p className="text-xs text-gray-400">
                          {new Date(report.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        report.status === "resolved"
                          ? "bg-green-500/10 text-green-400"
                          : report.status === "investigating"
                          ? "bg-blue-500/10 text-blue-400"
                          : report.status === "dismissed"
                          ? "bg-gray-500/10 text-gray-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 ml-13">{report.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Block Customer Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl max-w-md w-full p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-400" />
                Block Customer
              </h3>
              <button
                onClick={() => setShowBlockModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Customer Wallet Address *
                </label>
                <input
                  type="text"
                  value={blockForm.customerWalletAddress}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, customerWalletAddress: e.target.value })
                  }
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for Blocking *
                </label>
                <textarea
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="e.g., Multiple no-shows, abusive behavior, fraudulent activity..."
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] resize-none"
                />
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  This customer will not be able to book any services at your shop. Make sure
                  you have a valid reason before blocking.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBlockModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlockCustomer}
                  disabled={blocking}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {blocking ? "Blocking..." : "Block Customer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl max-w-lg w-full p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-400" />
                Report Issue to Admins
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category *
                </label>
                <select
                  value={reportForm.category}
                  onChange={(e) =>
                    setReportForm({
                      ...reportForm,
                      category: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                >
                  <option value="spam">Spam</option>
                  <option value="fraud">Fraud / Scam</option>
                  <option value="inappropriate_review">Inappropriate Review</option>
                  <option value="harassment">Harassment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Severity *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["low", "medium", "high"].map((severity) => (
                    <button
                      key={severity}
                      onClick={() =>
                        setReportForm({ ...reportForm, severity: severity as any })
                      }
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        reportForm.severity === severity
                          ? severity === "high"
                            ? "bg-red-600 text-white"
                            : severity === "medium"
                            ? "bg-yellow-600 text-white"
                            : "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={reportForm.description}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, description: e.target.value })
                  }
                  placeholder="Provide detailed information about the issue..."
                  rows={5}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Related To (Optional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={reportForm.relatedEntityType}
                    onChange={(e) =>
                      setReportForm({
                        ...reportForm,
                        relatedEntityType: e.target.value as any,
                      })
                    }
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                  >
                    <option value="">None</option>
                    <option value="customer">Customer</option>
                    <option value="review">Review</option>
                    <option value="order">Order</option>
                  </select>
                  {reportForm.relatedEntityType && (
                    <input
                      type="text"
                      value={reportForm.relatedEntityId}
                      onChange={(e) =>
                        setReportForm({ ...reportForm, relatedEntityId: e.target.value })
                      }
                      placeholder="ID"
                      className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                    />
                  )}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Your report will be reviewed by RepairCoin admins. False reports may result
                  in penalties.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReport}
                  disabled={reporting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {reporting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
