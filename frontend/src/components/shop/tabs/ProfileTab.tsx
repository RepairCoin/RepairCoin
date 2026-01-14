"use client";

import React, { useState } from "react";
import { ProfileSettingsSection } from "../ProfileSettingsSection";
import { Eye, User, Edit, ArrowLeft } from "lucide-react";
import { ShopProfilePreviewModal } from "../ShopProfilePreviewModal";
import { ShopProfileClient } from "../../customer/ShopProfileClient";

interface ProfileTabProps {
  shopId: string;
  shopData: any;
  onUpdate: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  shopId,
  shopData,
  onUpdate,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <>
      <div className="bg-[#101010] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white border-b border-[#303236]">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#FFCC00]" />
            <p className="text-base sm:text-lg md:text-xl text-[#FFCC00] font-semibold">
              Shop Profile
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <button
                onClick={() => setIsEditMode(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Profile</span>
                <span className="sm:hidden">Back</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Preview as Customer</span>
                  <span className="sm:hidden">Preview</span>
                </button>
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-semibold rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit Profile</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {isEditMode ? (
            // Edit Mode - Centered with max width
            <div className="max-w-5xl mx-auto">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white">
                  Edit Your Shop Profile
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Customize how your shop appears to customers with banner, logo, about text, and photo gallery
                </p>
              </div>

              <ProfileSettingsSection
                shopId={shopId}
                currentBannerUrl={shopData?.bannerUrl}
                currentLogoUrl={shopData?.logoUrl}
                currentAboutText={shopData?.aboutText}
                onUpdate={() => {
                  onUpdate();
                  setIsEditMode(false);
                }}
              />
            </div>
          ) : (
            // View Mode - Show profile as it appears
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white">
                  Your Shop Profile
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  This is how your shop appears to customers. Click "Edit Profile" to make changes.
                </p>
              </div>

              <div className="bg-[#0A0A0A] rounded-lg overflow-hidden">
                <ShopProfileClient shopId={shopId} isPreviewMode={true} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <ShopProfilePreviewModal
          shopId={shopId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
};
