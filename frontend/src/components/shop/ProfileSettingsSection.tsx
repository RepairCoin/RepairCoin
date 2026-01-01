"use client";

import React, { useState, useEffect } from "react";
import { ImageUploader } from "./ImageUploader";
import {
  Image as ImageIcon,
  FileText,
  Trash2,
  GripVertical,
  Plus,
  Save,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import {
  updateShopProfile,
  getGalleryPhotos,
  addGalleryPhoto,
  deleteGalleryPhoto,
  updateGalleryPhotoCaption,
  type GalleryPhoto,
} from "@/services/api/shop";

interface ProfileSettingsSectionProps {
  shopId: string;
  currentBannerUrl?: string;
  currentLogoUrl?: string;
  currentAboutText?: string;
  onUpdate: () => void;
}

export const ProfileSettingsSection: React.FC<ProfileSettingsSectionProps> = ({
  shopId,
  currentBannerUrl,
  currentLogoUrl,
  currentAboutText,
  onUpdate,
}) => {
  const [bannerUrl, setBannerUrl] = useState(currentBannerUrl || "");
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl || "");
  const [aboutText, setAboutText] = useState(currentAboutText || "");
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [captionText, setCaptionText] = useState("");

  // Load gallery photos on mount
  useEffect(() => {
    loadGalleryPhotos();
  }, [shopId]);

  const loadGalleryPhotos = async () => {
    setLoadingGallery(true);
    try {
      const photos = await getGalleryPhotos(shopId);
      setGalleryPhotos(photos);
    } catch (error) {
      console.error("Error loading gallery:", error);
      toast.error("Failed to load gallery photos");
    } finally {
      setLoadingGallery(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const success = await updateShopProfile(shopId, {
        bannerUrl: bannerUrl || undefined,
        logoUrl: logoUrl || undefined,
        aboutText: aboutText || undefined,
      });

      if (success) {
        toast.success("Profile updated successfully!");
        onUpdate();
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleBannerUpload = (url: string) => {
    setBannerUrl(url);
    toast.success("Banner uploaded! Click 'Save Changes' to apply.");
  };

  const handleLogoUpload = (url: string) => {
    setLogoUrl(url);
    toast.success("Logo uploaded! Click 'Save Changes' to apply.");
  };

  const handleGalleryPhotoUpload = async (url: string) => {
    try {
      const result = await addGalleryPhoto(shopId, { photoUrl: url });
      if (result) {
        toast.success("Photo added to gallery!");
        loadGalleryPhotos();
      } else {
        toast.error("Failed to add photo");
      }
    } catch (error) {
      console.error("Error adding gallery photo:", error);
      toast.error("Failed to add photo");
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    try {
      const success = await deleteGalleryPhoto(shopId, photoId);
      if (success) {
        toast.success("Photo deleted successfully!");
        loadGalleryPhotos();
      } else {
        toast.error("Failed to delete photo");
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to delete photo");
    }
  };

  const handleSaveCaption = async (photoId: number) => {
    try {
      const success = await updateGalleryPhotoCaption(shopId, photoId, captionText);
      if (success) {
        toast.success("Caption updated!");
        setEditingCaption(null);
        setCaptionText("");
        loadGalleryPhotos();
      } else {
        toast.error("Failed to update caption");
      }
    } catch (error) {
      console.error("Error updating caption:", error);
      toast.error("Failed to update caption");
    }
  };

  const startEditingCaption = (photoId: number, currentCaption: string | null) => {
    setEditingCaption(photoId);
    setCaptionText(currentCaption || "");
  };

  const cancelEditingCaption = () => {
    setEditingCaption(null);
    setCaptionText("");
  };

  const characterCount = aboutText.length;
  const maxCharacters = 2000;

  return (
    <div className="space-y-8">
      {/* Banner Image Section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Shop Banner</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Upload a banner image for your shop profile (1200x300px recommended)
        </p>
        <ImageUploader
          currentImageUrl={bannerUrl}
          imageType="banner"
          onUploadSuccess={handleBannerUpload}
          onRemove={() => setBannerUrl("")}
          label="Banner Image"
          showPreview={true}
        />
      </div>

      {/* Logo Image Section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Shop Logo</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Upload a logo for your shop (200x200px square recommended)
        </p>
        <ImageUploader
          currentImageUrl={logoUrl}
          imageType="logo"
          onUploadSuccess={handleLogoUpload}
          onRemove={() => setLogoUrl("")}
          label="Shop Logo"
          showPreview={true}
        />
      </div>

      {/* About Section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">About Your Shop</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Tell customers about your shop, services, and what makes you special
        </p>
        <div className="space-y-2">
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            maxLength={maxCharacters}
            rows={8}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent resize-none"
            placeholder="Founded in 2010, we are a family-owned business specializing in auto repairs. Our ASE-certified technicians have over 50 years of combined experience..."
          />
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">
              Support for formatting, bullet points, and emphasis
            </span>
            <span className={`font-medium ${characterCount > maxCharacters * 0.9 ? 'text-yellow-500' : 'text-gray-400'}`}>
              {characterCount} / {maxCharacters}
            </span>
          </div>
        </div>
      </div>

      {/* Photo Gallery Section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="text-lg font-semibold text-white">Photo Gallery</h3>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Showcase your shop with up to 20 photos ({galleryPhotos.length}/20 used)
            </p>
          </div>
        </div>

        {/* Add New Photo */}
        {galleryPhotos.length < 20 && (
          <div className="mb-6">
            <ImageUploader
              imageType="service"
              onUploadSuccess={handleGalleryPhotoUpload}
              label="Add Photo to Gallery"
              showPreview={false}
            />
          </div>
        )}

        {/* Gallery Grid */}
        {loadingGallery ? (
          <div className="text-center py-8 text-gray-400">Loading gallery...</div>
        ) : galleryPhotos.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
            <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No photos in gallery yet</p>
            <p className="text-sm text-gray-500 mt-1">Upload your first photo above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleryPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative group bg-gray-900 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Image */}
                <div className="aspect-video relative">
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || "Gallery photo"}
                    className="w-full h-full object-cover"
                  />

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Drag Handle (for future reordering) */}
                  <div className="absolute top-2 left-2 p-1.5 bg-gray-800/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>

                {/* Caption */}
                <div className="p-3">
                  {editingCaption === photo.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={captionText}
                        onChange={(e) => setCaptionText(e.target.value)}
                        maxLength={200}
                        placeholder="Add a caption..."
                        className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#FFCC00]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveCaption(photo.id)}
                          className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center justify-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          Save
                        </button>
                        <button
                          onClick={cancelEditingCaption}
                          className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditingCaption(photo.id, photo.caption)}
                      className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {photo.caption || "Click to add caption..."}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};
