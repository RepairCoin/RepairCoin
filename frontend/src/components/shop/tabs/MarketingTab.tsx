"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  Send,
  Clock,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const campaignTypeIcons: Record<string, React.ReactNode> = {
  offer_coupon: <Gift className="w-5 h-5" />,
  announce_service: <Megaphone className="w-5 h-5" />,
  newsletter: <Newspaper className="w-5 h-5" />,
  custom: <Sparkles className="w-5 h-5" />,
};

const campaignTypeLabels: Record<string, string> = {
  offer_coupon: "Coupon Offer",
  announce_service: "Service Announcement",
  newsletter: "Newsletter",
  custom: "Custom Campaign",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  scheduled: "bg-blue-500",
  sent: "bg-green-500",
  cancelled: "bg-red-500",
};

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing</h1>
          <p className="text-gray-400">Create and manage campaigns to engage your customers</p>
        </div>
        <Button
          onClick={handleCreateCampaign}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Campaigns</p>
                  <p className="text-2xl font-bold text-white">{stats.totalCampaigns}</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Draft Campaigns</p>
                  <p className="text-2xl font-bold text-white">{stats.draftCampaigns}</p>
                </div>
                <div className="p-3 bg-gray-500/20 rounded-lg">
                  <Edit className="w-6 h-6 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">In-App Delivered</p>
                  <p className="text-2xl font-bold text-white">{stats.totalInAppSent}</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Bell className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Emails Sent</p>
                  <p className="text-2xl font-bold text-white">{stats.totalEmailsSent}</p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Mail className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Campaigns / Drafts */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
              <p className="text-gray-400 mb-4">
                Create your first campaign to start engaging with your customers
              </p>
              <Button
                onClick={handleCreateCampaign}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 bg-gray-900 rounded-lg hover:bg-gray-850 transition-colors cursor-pointer"
                  onClick={() => {
                    if (campaign.status === 'draft') {
                      handleEditCampaign(campaign);
                    } else {
                      handleViewCampaign(campaign);
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-700 rounded-lg">
                      {campaignTypeIcons[campaign.campaignType]}
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{campaign.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge className={`${statusColors[campaign.status]} text-white text-xs`}>
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </Badge>
                        <span className="text-gray-500 text-sm">
                          {campaignTypeLabels[campaign.campaignType]}
                        </span>
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          {getDeliveryMethodIcon(campaign.deliveryMethod)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {campaign.status === "sent" && (
                      <div className="text-right text-sm">
                        <p className="text-gray-400">
                          {campaign.inAppSent} in-app • {campaign.emailsSent} emails
                        </p>
                        <p className="text-gray-500">
                          {new Date(campaign.sentAt!).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {campaign.status === "scheduled" && campaign.scheduledAt && (
                      <div className="text-right text-sm">
                        <p className="text-blue-400 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Scheduled
                        </p>
                        <p className="text-gray-500">
                          {new Date(campaign.scheduledAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                        {campaign.status === "draft" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleEditCampaign(campaign)}
                              className="text-white hover:bg-gray-700"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSendCampaign(campaign.id)}
                              className="text-green-400 hover:bg-gray-700"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Send Now
                            </DropdownMenuItem>
                          </>
                        )}
                        {campaign.status === "scheduled" && (
                          <DropdownMenuItem
                            onClick={() => handleCancelCampaign(campaign.id)}
                            className="text-orange-400 hover:bg-gray-700"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                        {campaign.status !== "sent" && (
                          <DropdownMenuItem
                            onClick={() => handleDeleteCampaign(campaign.id)}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
