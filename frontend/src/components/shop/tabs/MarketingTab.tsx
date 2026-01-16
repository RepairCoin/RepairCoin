"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  Send,
  FileText,
  Users,
  Mail,
  Bell,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  X,
  ChevronRight,
  Gift,
  Megaphone,
  Newspaper,
  Sparkles,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MarketingCampaign,
  MarketingTemplate,
  CampaignStats,
  getCampaigns,
  getCampaignStats,
  getTemplates,
  deleteCampaign,
  sendCampaign,
  cancelCampaign,
} from "@/services/api/marketing";
import { CampaignBuilderModal } from "../marketing/CampaignBuilderModal";

interface MarketingTabProps {
  shopId: string;
  shopName?: string;
}

const campaignTypeLabels: Record<string, string> = {
  offer_coupon: "Coupon Offer",
  announce_service: "Service Announcement",
  newsletter: "Newsletter",
  custom: "Custom Campaign",
};

// New status badge colors matching Figma design
const statusBadgeStyles: Record<string, { bg: string; text: string; border?: string }> = {
  draft: { bg: "bg-gray-600/50", text: "text-gray-300" },
  active: { bg: "bg-green-500/20", text: "text-green-400", border: "border border-green-500/30" },
  sent: { bg: "bg-green-500/20", text: "text-green-400", border: "border border-green-500/30" },
  scheduled: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border border-purple-500/30" },
  expired: { bg: "bg-red-500/20", text: "text-red-400", border: "border border-red-500/30" },
  paused: { bg: "bg-amber-600/20", text: "text-amber-400", border: "border border-amber-600/30" },
  cancelled: { bg: "bg-red-500/20", text: "text-red-400", border: "border border-red-500/30" },
};

const statusFilterOptions = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "sent", label: "Sent" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
];

export function MarketingTab({ shopId, shopName }: MarketingTabProps) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<MarketingTemplate | null>(null);
  const [selectedCampaignType, setSelectedCampaignType] = useState<string | null>(null);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter campaigns based on status
  const filteredCampaigns = campaigns.filter((campaign) => {
    if (statusFilter === "all") return true;
    return campaign.status === statusFilter;
  });

  useEffect(() => {
    loadData();
  }, [shopId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [campaignsData, statsData, templatesData] = await Promise.all([
        getCampaigns(shopId, 1, 50),
        getCampaignStats(shopId),
        getTemplates(),
      ]);
      setCampaigns(campaignsData.items);
      setStats(statsData);
      setTemplates(templatesData);
    } catch (error) {
      console.error("Error loading marketing data:", error);
      toast.error("Failed to load marketing data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    setShowCampaignPicker(true);
  };

  const handleSelectCampaignType = (type: string, template?: MarketingTemplate) => {
    setSelectedCampaignType(type);
    setSelectedTemplate(template || null);
    setSelectedCampaign(null);
    setShowCampaignPicker(false);
    setShowBuilder(true);
  };

  const handleEditCampaign = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    setSelectedTemplate(null);
    setSelectedCampaignType(campaign.campaignType);
    setViewOnlyMode(false);
    setShowBuilder(true);
  };

  const handleViewCampaign = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    setSelectedTemplate(null);
    setSelectedCampaignType(campaign.campaignType);
    setViewOnlyMode(true);
    setShowBuilder(true);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      await deleteCampaign(campaignId);
      toast.success("Campaign deleted");
      loadData();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Failed to delete campaign");
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to send this campaign now?")) return;

    try {
      const result = await sendCampaign(campaignId);
      toast.success(
        `Campaign sent to ${result.totalRecipients} recipients! (${result.inAppSent} in-app, ${result.emailsSent} emails)`
      );
      loadData();
    } catch (error) {
      console.error("Error sending campaign:", error);
      toast.error("Failed to send campaign");
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    try {
      await cancelCampaign(campaignId);
      toast.success("Campaign cancelled");
      loadData();
    } catch (error) {
      console.error("Error cancelling campaign:", error);
      toast.error("Failed to cancel campaign");
    }
  };

  const handleBuilderClose = (saved: boolean) => {
    setShowBuilder(false);
    setSelectedCampaign(null);
    setSelectedTemplate(null);
    setSelectedCampaignType(null);
    setViewOnlyMode(false);
    if (saved) {
      loadData();
    }
  };

  const getDeliveryMethodIcon = (method: string) => {
    switch (method) {
      case "email":
        return <Mail className="w-4 h-4" />;
      case "in_app":
        return <Bell className="w-4 h-4" />;
      case "both":
        return (
          <div className="flex gap-1">
            <Mail className="w-4 h-4" />
            <Bell className="w-4 h-4" />
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  // Helper function to get status badge style
  const getStatusBadgeStyle = (status: string) => {
    const style = statusBadgeStyles[status] || statusBadgeStyles.draft;
    return `${style.bg} ${style.text} ${style.border || ""}`;
  };

  // Helper function to format date nicely
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary - Unified container with dividers */}
      {stats && (
        <div className="flex flex-col sm:flex-row bg-[#1a1a1a] rounded-xl overflow-hidden">
          {/* Total Campaigns */}
          <div className="flex-1 flex items-center gap-4 p-4 sm:border-r border-b sm:border-b-0 border-gray-700">
            <div className="flex items-center justify-center w-10 h-10 bg-yellow-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Campaigns</p>
              <p className="text-2xl font-bold text-white">{stats.totalCampaigns}</p>
            </div>
          </div>

          {/* Draft Campaigns */}
          <div className="flex-1 flex items-center gap-4 p-4 sm:border-r border-b sm:border-b-0 border-gray-700">
            <div className="flex items-center justify-center w-10 h-10 bg-yellow-500/20 rounded-lg">
              <Edit className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Draft Campaigns</p>
              <p className="text-2xl font-bold text-white">{stats.draftCampaigns}</p>
            </div>
          </div>

          {/* In-App Delivered */}
          <div className="flex-1 flex items-center gap-4 p-4 sm:border-r border-b sm:border-b-0 border-gray-700">
            <div className="flex items-center justify-center w-10 h-10 bg-yellow-500/20 rounded-lg">
              <Bell className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">In-App Delivered</p>
              <p className="text-2xl font-bold text-white">{stats.totalInAppSent}</p>
            </div>
          </div>

          {/* Email Sent */}
          <div className="flex-1 flex items-center gap-4 p-4">
            <div className="flex items-center justify-center w-10 h-10 bg-yellow-500/20 rounded-lg">
              <Mail className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Email Sent</p>
              <p className="text-2xl font-bold text-white">{stats.totalEmailsSent}</p>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Section - New Design */}
      <div className="bg-[#1a1a1a] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-yellow-400">Campaigns</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Status Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-transparent border-gray-600 text-white hover:bg-gray-800 hover:text-white"
                >
                  {statusFilterOptions.find((opt) => opt.value === statusFilter)?.label || "All Status"}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                {statusFilterOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setStatusFilter(option.value)}
                    className={`text-white hover:bg-gray-700 ${
                      statusFilter === option.value ? "bg-gray-700" : ""
                    }`}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Create Campaign Button */}
            <Button
              onClick={handleCreateCampaign}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium border border-yellow-400"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </div>

        {/* Campaign List */}
        <div className="divide-y divide-gray-800">
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="flex items-center justify-center w-16 h-16 bg-yellow-500/20 rounded-full mx-auto mb-4">
                <Megaphone className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
              <p className="text-gray-400 mb-4">
                Create your first campaign to start engaging with your customers
              </p>
              <Button
                onClick={handleCreateCampaign}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium border border-yellow-400"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => {
                  if (campaign.status === "draft") {
                    handleEditCampaign(campaign);
                  } else {
                    handleViewCampaign(campaign);
                  }
                }}
              >
                {/* Left side - Icon, Name, Status, Description */}
                <div className="flex items-center gap-4">
                  {/* Yellow circular icon */}
                  <div className="flex items-center justify-center w-10 h-10 bg-yellow-500 rounded-full">
                    <Megaphone className="w-5 h-5 text-black" />
                  </div>

                  <div className="flex flex-col gap-1">
                    {/* Campaign name and status badges */}
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-medium">{campaign.name}</h4>
                      {/* Status badge */}
                      <Badge
                        className={`${getStatusBadgeStyle(campaign.status)} text-xs px-2 py-0.5 rounded-md`}
                      >
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                    </div>

                    {/* Description row with Sent badge, type, and delivery method icons */}
                    <div className="flex items-center gap-2 text-sm">
                      {/* Show "Sent" badge with checkmark for sent campaigns */}
                      {campaign.status === "sent" && (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Sent
                        </span>
                      )}
                      <span className="text-gray-400">
                        {campaignTypeLabels[campaign.campaignType]}
                      </span>
                      <span className="text-gray-500 flex items-center gap-1">
                        {getDeliveryMethodIcon(campaign.deliveryMethod)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side - Stats and date */}
                <div className="flex items-center gap-4">
                  {((campaign.status as string) === "sent" || (campaign.status as string) === "active") && (
                    <div className="text-right text-sm">
                      <p className="text-gray-300">
                        {campaign.inAppSent} in app • {campaign.emailsSent} email
                      </p>
                      <p className="text-gray-500">
                        {campaign.sentAt ? formatDate(campaign.sentAt) : ""}
                      </p>
                    </div>
                  )}
                  {(campaign.status as string) === "scheduled" && campaign.scheduledAt && (
                    <div className="text-right text-sm">
                      <p className="text-gray-300">
                        {campaign.inAppSent || 0} in app • {campaign.emailsSent || 0} email
                      </p>
                      <p className="text-gray-500">
                        Scheduled for {formatDate(campaign.scheduledAt)}
                      </p>
                    </div>
                  )}
                  {(campaign.status as string) === "paused" && campaign.scheduledAt && (
                    <div className="text-right text-sm">
                      <p className="text-gray-300">
                        {campaign.inAppSent || 0} in app • {campaign.emailsSent || 0} email
                      </p>
                      <p className="text-gray-500">
                        Scheduled for {formatDate(campaign.scheduledAt)}
                      </p>
                    </div>
                  )}
                  {(campaign.status as string) === "expired" && (
                    <div className="text-right text-sm">
                      <p className="text-gray-300">
                        {campaign.inAppSent || 0} in app • {campaign.emailsSent || 0} email
                      </p>
                      <p className="text-gray-500">
                        {campaign.sentAt ? formatDate(campaign.sentAt) : ""}
                      </p>
                    </div>
                  )}

                  {/* Actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                      {campaign.status === "draft" && (
                        <>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCampaign(campaign);
                            }}
                            className="text-white hover:bg-gray-700"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendCampaign(campaign.id);
                            }}
                            className="text-green-400 hover:bg-gray-700"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Send Now
                          </DropdownMenuItem>
                        </>
                      )}
                      {campaign.status === "scheduled" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelCampaign(campaign.id);
                          }}
                          className="text-orange-400 hover:bg-gray-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                      )}
                      {(campaign.status as string) !== "sent" && (campaign.status as string) !== "active" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCampaign(campaign.id);
                          }}
                          className="text-red-400 hover:bg-gray-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewCampaign(campaign);
                        }}
                        className="text-gray-400 hover:bg-gray-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Campaign Type Picker Dialog */}
      <Dialog open={showCampaignPicker} onOpenChange={setShowCampaignPicker}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">Choose a campaign</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Target your best customers */}
            <div>
              <h3 className="text-gray-400 text-sm font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Target your best customers
              </h3>
              <p className="text-gray-500 text-sm mb-3">
                Smart groups are recommended customer segments. You can modify them in the Audience step.
              </p>
              <div className="space-y-2">
                {[
                  { label: "Reward top spenders", audience: "top_spenders" },
                  { label: "Reward frequent visitors", audience: "frequent_visitors" },
                  { label: "Engage active customers", audience: "active_customers" },
                ].map((item) => (
                  <button
                    key={item.audience}
                    onClick={() => handleSelectCampaignType("offer_coupon")}
                    className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors"
                  >
                    <span className="text-white">{item.label}</span>
                    <Badge className="bg-blue-500/20 text-blue-400 text-xs">Smart group</Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Promote sales and visits */}
            <div>
              <h3 className="text-gray-400 text-sm font-medium mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Promote sales and visits
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Offer a coupon", type: "offer_coupon", icon: <Gift className="w-5 h-5" /> },
                  { label: "Announce new products or services", type: "announce_service", icon: <Megaphone className="w-5 h-5" /> },
                  { label: "Announce RCN rewards program", type: "custom", icon: <Sparkles className="w-5 h-5" /> },
                ].map((item) => (
                  <button
                    key={item.type + item.label}
                    onClick={() => handleSelectCampaignType(item.type)}
                    className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-gray-400">{item.icon}</div>
                      <span className="text-white">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* Update and engage */}
            <div>
              <h3 className="text-gray-400 text-sm font-medium mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Update and engage
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Send a quick update", type: "custom" },
                  { label: "Create a newsletter", type: "newsletter" },
                ].map((item) => (
                  <button
                    key={item.type + item.label}
                    onClick={() => handleSelectCampaignType(item.type)}
                    className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors"
                  >
                    <span className="text-white">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* Templates */}
            {templates.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-3">
                  Start from a template
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {templates.slice(0, 4).map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectCampaignType(
                        template.category === 'coupon' ? 'offer_coupon' :
                        template.category === 'announcement' ? 'announce_service' :
                        template.category === 'newsletter' ? 'newsletter' : 'custom',
                        template
                      )}
                      className="p-4 bg-gray-800 hover:bg-gray-750 rounded-lg text-left transition-colors"
                    >
                      <div className="text-white font-medium">{template.name}</div>
                      <div className="text-gray-500 text-sm mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Builder Modal */}
      {showBuilder && selectedCampaignType && (
        <CampaignBuilderModal
          open={showBuilder}
          onClose={handleBuilderClose}
          shopId={shopId}
          shopName={shopName}
          campaignType={selectedCampaignType as any}
          existingCampaign={selectedCampaign}
          template={selectedTemplate}
          viewOnly={viewOnlyMode}
        />
      )}
    </div>
  );
}
