"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Globe,
  Link as LinkIcon,
  ExternalLink,
  TrendingUp,
  Users,
  Eye,
  Settings,
} from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import toast from "react-hot-toast";
import apiClient from "@/services/api/client";

interface SocialMediaLinks {
  facebook?: string;
  instagram?: string;
  x?: string;
  linkedin?: string;
  youtube?: string;
  website?: string;
  tiktok?: string;
  pinterest?: string;
}

interface SocialMediaSettingsProps {
  shopId: string;
  initialLinks?: SocialMediaLinks;
  onUpdate?: () => void;
}

export const SocialMediaSettings: React.FC<SocialMediaSettingsProps> = ({
  shopId,
  initialLinks = {},
  onUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const [links, setLinks] = useState<SocialMediaLinks>({
    facebook: initialLinks.facebook || "",
    instagram: initialLinks.instagram || "",
    x: initialLinks.x || "",
    linkedin: initialLinks.linkedin || "",
    youtube: initialLinks.youtube || "",
    website: initialLinks.website || "",
    tiktok: initialLinks.tiktok || "",
    pinterest: initialLinks.pinterest || "",
  });

  const [originalLinks, setOriginalLinks] = useState<SocialMediaLinks>(links);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(links) !== JSON.stringify(originalLinks);
    setHasChanges(changed);
  }, [links, originalLinks]);

  const handleInputChange = (platform: keyof SocialMediaLinks, value: string) => {
    setLinks((prev) => ({
      ...prev,
      [platform]: value,
    }));
    setError("");
    setSuccess(false);
  };

  const validateUrl = (url: string, platform: string): boolean => {
    if (!url) return true; // Empty is valid

    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      toast.error(`Invalid URL for ${platform}. Please include http:// or https://`);
      return false;
    }
  };

  const handleSave = async () => {
    // Validate all URLs
    for (const [platform, url] of Object.entries(links)) {
      if (url && !validateUrl(url, platform)) {
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      // Filter out empty fields and map 'x' to 'twitter' for backend
      const validFields = Object.entries(links).reduce((acc, [key, value]) => {
        if (value && value.trim()) {
          const fieldName = key === 'x' ? 'twitter' : key;
          acc[fieldName] = value.trim();
        }
        return acc;
      }, {} as Record<string, string>);

      await apiClient.put(`/shops/${shopId}/details`, validFields);

      setOriginalLinks({ ...links });
      setSuccess(true);
      setHasChanges(false);
      toast.success("Social media links updated successfully!");

      // Call onUpdate callback if provided
      if (onUpdate) {
        onUpdate();
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update social media links";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLinks({ ...originalLinks });
    setHasChanges(false);
    setError("");
    setSuccess(false);
  };

  const openLink = (url: string) => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const socialPlatforms = [
    {
      key: "facebook" as const,
      label: "Facebook",
      icon: Facebook,
      placeholder: "https://facebook.com/yourshop",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      description: "Connect with customers on Facebook",
    },
    {
      key: "instagram" as const,
      label: "Instagram",
      icon: Instagram,
      placeholder: "https://instagram.com/yourshop",
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
      borderColor: "border-pink-500/30",
      description: "Share photos and stories on Instagram",
    },
    {
      key: "x" as const,
      label: "X (Twitter)",
      icon: FaXTwitter,
      placeholder: "https://x.com/yourshop",
      color: "text-white",
      bgColor: "bg-gray-800",
      borderColor: "border-gray-600",
      description: "Tweet updates and engage on X",
    },
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      icon: Linkedin,
      placeholder: "https://linkedin.com/company/yourshop",
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
      borderColor: "border-blue-600/30",
      description: "Professional networking on LinkedIn",
    },
    {
      key: "youtube" as const,
      label: "YouTube",
      icon: Youtube,
      placeholder: "https://youtube.com/@yourshop",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      description: "Share video content on YouTube",
    },
    {
      key: "tiktok" as const,
      label: "TikTok",
      icon: TrendingUp,
      placeholder: "https://tiktok.com/@yourshop",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
      description: "Create short videos on TikTok",
    },
    {
      key: "pinterest" as const,
      label: "Pinterest",
      icon: Eye,
      placeholder: "https://pinterest.com/yourshop",
      color: "text-red-600",
      bgColor: "bg-red-600/10",
      borderColor: "border-red-600/30",
      description: "Pin ideas and inspiration",
    },
    {
      key: "website" as const,
      label: "Website",
      icon: Globe,
      placeholder: "https://yourshop.com",
      color: "text-[#FFCC00]",
      bgColor: "bg-[#FFCC00]/10",
      borderColor: "border-[#FFCC00]/30",
      description: "Your official website",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-300">
              <strong>Tip:</strong> Add your social media links to help customers find and
              connect with you across multiple platforms. These links will appear on your
              shop profile and service pages.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Social Media Accounts</h2>
          <p className="text-sm text-gray-400">
            Connect your social media profiles and website
          </p>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 inline mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 inline mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-400">Social media links saved successfully!</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Social Media Links Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {socialPlatforms.map((platform) => {
          const Icon = platform.icon;
          const hasLink = links[platform.key] && links[platform.key]!.trim() !== "";

          return (
            <div
              key={platform.key}
              className={`bg-[#0D0D0D] border ${platform.borderColor} rounded-xl p-5 transition-all duration-200 hover:shadow-lg ${hasLink ? "ring-1 ring-green-500/20" : ""}`}
            >
              {/* Platform Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`${platform.bgColor} p-2 rounded-lg`}>
                    <Icon className={`w-5 h-5 ${platform.color}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {platform.label}
                    </h3>
                    <p className="text-xs text-gray-500">{platform.description}</p>
                  </div>
                </div>
                {hasLink && (
                  <button
                    onClick={() => openLink(links[platform.key]!)}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* URL Input */}
              <div className="relative">
                <input
                  type="url"
                  value={links[platform.key] || ""}
                  onChange={(e) => handleInputChange(platform.key, e.target.value)}
                  placeholder={platform.placeholder}
                  className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-600 text-sm"
                />
                {hasLink && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Card */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Connected Platforms</h3>
            <p className="text-sm text-gray-400">Your social media presence</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#FFCC00]">
              {Object.values(links).filter((link) => link && link.trim()).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total Links</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {[links.facebook, links.instagram, links.x, links.tiktok].filter(
                (link) => link && link.trim()
              ).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Social Media</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {links.website && links.website.trim() ? "✓" : "✗"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Website</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">
              {[links.linkedin, links.youtube, links.pinterest].filter(
                (link) => link && link.trim()
              ).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Other</p>
          </div>
        </div>
      </div>

      {/* Tips & Best Practices */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-[#FFCC00]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Best Practices</h3>
            <p className="text-sm text-gray-400">Tips for social media success</p>
          </div>
        </div>

        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">
              <strong className="text-white">Complete URLs:</strong> Always include
              https:// or http:// in your links
            </p>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">
              <strong className="text-white">Active Accounts:</strong> Only add links to
              accounts you actively maintain
            </p>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">
              <strong className="text-white">Brand Consistency:</strong> Use the same
              branding across all platforms
            </p>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">
              <strong className="text-white">Regular Updates:</strong> Post consistently
              to engage your audience
            </p>
          </li>
        </ul>
      </div>

      {/* Save Button (Mobile) */}
      {hasChanges && (
        <div className="sm:hidden flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 inline mr-2" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
};
