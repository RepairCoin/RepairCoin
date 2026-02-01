"use client";

import React, { useState } from "react";
import { Megaphone, ChevronRight, Bell, Mail, MessageSquare, X, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotificationStore } from "@/stores/notificationStore";
import { useNotificationActions } from "@/hooks/useNotifications";

// Render a design block for marketing campaigns
const renderMarketingBlock = (block: any, metadata: any) => {
  const style = block.style || {};

  switch (block.type) {
    case "headline":
      return (
        <h2
          key={block.id}
          style={{
            fontSize: style.fontSize || "24px",
            fontWeight: style.fontWeight || "bold",
            textAlign: style.textAlign || "center",
            color: style.color || "#111827",
            margin: "0 0 16px 0",
          }}
        >
          {block.content}
        </h2>
      );

    case "text":
      return (
        <div
          key={block.id}
          className="rich-text-content"
          style={{
            fontSize: style.fontSize || "14px",
            textAlign: style.textAlign || "left",
            color: style.color || "#374151",
            lineHeight: 1.6,
            margin: "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );

    case "button":
      const buttonUrl = metadata.serviceId
        ? `/customer?tab=marketplace&service=${metadata.serviceId}`
        : block.href || "#";

      return (
        <div key={block.id} style={{ textAlign: "center", margin: "16px 0" }}>
          <a
            href={buttonUrl}
            style={{
              display: "inline-block",
              backgroundColor: style.backgroundColor || "#eab308",
              color: style.textColor || "#000",
              padding: "12px 30px",
              borderRadius: "6px",
              border: "none",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            {block.content}
          </a>
        </div>
      );

    case "coupon":
      if (!metadata.couponValue) return null;
      const couponDisplay =
        metadata.couponType === "percentage"
          ? `${metadata.couponValue}%`
          : `$${metadata.couponValue}`;
      const expiryText = metadata.couponExpiresAt
        ? `Expires: ${new Date(metadata.couponExpiresAt).toLocaleDateString()}`
        : "";

      return (
        <div
          key={block.id}
          style={{
            backgroundColor: style.backgroundColor || "#10B981",
            color: style.textColor || "white",
            padding: "24px",
            borderRadius: "8px",
            textAlign: "center",
            margin: "16px 0",
          }}
        >
          <div style={{ fontSize: "42px", fontWeight: "bold", marginBottom: "8px" }}>
            {couponDisplay}
          </div>
          <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "4px" }}>
            OFF your next visit!
          </div>
          {expiryText && (
            <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "12px" }}>
              {expiryText}
            </div>
          )}
        </div>
      );

    case "service_card":
      return (
        <div
          key={block.id}
          style={{
            backgroundColor: style.backgroundColor || "#10B981",
            borderRadius: "12px",
            overflow: "hidden",
            margin: "16px 0",
          }}
        >
          {block.serviceImage ? (
            <div style={{ height: "140px", overflow: "hidden" }}>
              <img
                src={block.serviceImage}
                alt={block.serviceName || "Service"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                height: "100px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.2)",
              }}
            >
              <span style={{ fontSize: "32px" }}>🔧</span>
            </div>
          )}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#1a1a2e",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ color: "white", fontWeight: "bold", fontSize: "16px" }}>
              {block.serviceName || "Featured Service"}
            </div>
            {block.servicePrice !== undefined && block.servicePrice !== null && (
              <div style={{ color: "#10B981", fontWeight: "600", marginTop: "4px" }}>
                ${typeof block.servicePrice === "number" ? block.servicePrice.toFixed(2) : block.servicePrice}
              </div>
            )}
          </div>
        </div>
      );

    case "image":
      return (
        <div key={block.id} style={{ textAlign: "center", margin: "16px 0" }}>
          <img
            src={block.src}
            alt=""
            style={{ maxWidth: style.maxWidth || "100%", height: "auto", borderRadius: "4px" }}
          />
        </div>
      );

    case "divider":
      return <hr key={block.id} style={{ border: "none", borderTop: "1px solid #444", margin: "16px 0" }} />;

    case "spacer":
      return <div key={block.id} style={{ height: style.height || "16px" }} />;

    default:
      return null;
  }
};

// Campaign Modal Component
interface CampaignModalProps {
  notification: any;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const CampaignModal: React.FC<CampaignModalProps> = ({ notification, onClose, onDelete }) => {
  const metadata = notification.metadata || {};
  const design = metadata.designContent;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1A1A1A] rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-[#FFCC00]/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <h3 className="text-lg font-semibold text-white">
              {metadata.campaignName || "Campaign"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {design?.blocks && Array.isArray(design.blocks) ? (
            <div className="bg-white rounded-lg overflow-hidden m-4">
              {/* Styles for rich text content */}
              <style>{`
                .rich-text-content p { margin: 0 0 8px 0; }
                .rich-text-content ul, .rich-text-content ol { margin: 8px 0; padding-left: 24px; }
                .rich-text-content li { margin: 4px 0; }
                .rich-text-content strong, .rich-text-content b { font-weight: bold; }
                .rich-text-content em, .rich-text-content i { font-style: italic; }
                .rich-text-content u { text-decoration: underline; }
                .rich-text-content a { color: #10B981; text-decoration: underline; }
              `}</style>
              {/* Header */}
              {design.header?.enabled !== false && (
                <div
                  className="p-6 text-center"
                  style={{ backgroundColor: design.header?.backgroundColor || "#1a1a2e" }}
                >
                  {design.header?.showLogo !== false && (
                    <img
                      src="/img/landing/repaircoin-icon.png"
                      alt="RepairCoin"
                      className="w-12 h-12 mx-auto mb-3"
                    />
                  )}
                  <h1 className="text-white text-xl font-bold m-0">{metadata.shopName}</h1>
                </div>
              )}

              {/* Blocks */}
              <div className="p-4 space-y-2">
                {design.blocks.map((block: any) => renderMarketingBlock(block, metadata))}
              </div>

              {/* Footer */}
              {(design.footer?.showSocial || design.footer?.showUnsubscribe) && (
                <div className="border-t border-gray-200 p-4 text-center text-sm text-gray-500 bg-gray-50">
                  {design.footer?.showSocial && (
                    <div className="mb-2">
                      <span className="mx-2">Website</span>
                      <span className="mx-2">Instagram</span>
                      <span className="mx-2">Facebook</span>
                    </div>
                  )}
                  {design.footer?.showUnsubscribe && (
                    <p className="text-xs text-gray-500">
                      You received this because you are a customer of {metadata.shopName}.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <p className="text-gray-300">{notification.message}</p>
            </div>
          )}

          {/* Timestamp */}
          <div className="px-6 pb-4 text-sm text-gray-500">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={() => {
              onDelete(notification.id);
              onClose();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface CampaignItemProps {
  notification: any;
  onViewDetails: (notification: any) => void;
}

const CampaignItem: React.FC<CampaignItemProps> = ({ notification, onViewDetails }) => {
  const metadata = notification.metadata || {};
  const shopName = metadata.shopName || "RepairCoin";
  const campaignName = metadata.campaignName || "Special Promotion";
  const channels = metadata.channels || ["in_app"];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="w-3 h-3" />;
      case "sms":
        return <MessageSquare className="w-3 h-3" />;
      default:
        return <Bell className="w-3 h-3" />;
    }
  };

  const formatChannels = (channels: string[]) => {
    const channelNames = channels.map((ch) => {
      switch (ch) {
        case "email":
          return "Email";
        case "sms":
          return "SMS";
        case "in_app":
          return "In-app";
        default:
          return ch;
      }
    });
    return channelNames.join(" & ");
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-[#1A1A1A] rounded-xl hover:bg-[#252525] transition-colors">
      {/* Campaign Icon */}
      <div className="w-10 h-10 rounded-full bg-[#FFCC00]/20 flex items-center justify-center flex-shrink-0">
        <Megaphone className="w-5 h-5 text-[#FFCC00]" />
      </div>

      {/* Campaign Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-semibold text-sm truncate">{campaignName}</h4>
        <p className="text-xs text-gray-400 mt-0.5">
          from: <span className="text-[#FFCC00]">{shopName}</span>
        </p>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
          {channels.slice(0, 1).map((channel: string) => (
            <span key={channel} className="flex items-center gap-1">
              {getChannelIcon(channel)}
              <span>{formatChannels([channel])}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* View Details */}
      <button
        onClick={() => onViewDetails(notification)}
        className="text-[#FFCC00] text-xs font-medium hover:underline flex items-center gap-0.5 flex-shrink-0"
      >
        View Details
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};

export const CampaignsPromosCard: React.FC = () => {
  const { notifications } = useNotificationStore();
  const { deleteNotification } = useNotificationActions();
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  // Filter for marketing campaign notifications
  const campaigns = notifications
    .filter((n) => n.notificationType === "marketing_campaign")
    .slice(0, 3);

  const handleViewDetails = (notification: any) => {
    setSelectedCampaign(notification);
  };

  if (campaigns.length === 0) {
    return (
      <div className="bg-[#212121] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <Megaphone className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-white font-semibold text-base">Campaigns & Promos</h3>
        </div>

        {/* Empty State */}
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#2A2A2A] flex items-center justify-center mx-auto mb-3">
            <Megaphone className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-gray-400 text-sm">No active campaigns</p>
          <p className="text-gray-500 text-xs mt-1">
            Check back later for special promotions!
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#212121] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <Megaphone className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-white font-semibold text-base">Campaigns & Promos</h3>
        </div>

        {/* Campaigns List */}
        <div className="p-3 space-y-2">
          {campaigns.map((campaign) => (
            <CampaignItem
              key={campaign.id}
              notification={campaign}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      </div>

      {/* Campaign Detail Modal */}
      {selectedCampaign && (
        <CampaignModal
          notification={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onDelete={deleteNotification}
        />
      )}
    </>
  );
};
