"use client";

import React, { useState, useEffect } from "react";
import { MapPin, MapPinned, Pencil, Info, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from '@/services/api/client';
import { LocationPickerWrapper } from "../../maps/LocationPickerWrapper";

interface ShopData {
  walletAddress: string;
  address?: string;
  location?: {
    lat?: number;
    lng?: number;
  };
}

interface ShopLocationTabProps {
  shopId: string;
  shopData: ShopData | null;
  onLocationUpdate: () => void;
}

export const ShopLocationTab: React.FC<ShopLocationTabProps> = ({
  shopId,
  shopData,
  onLocationUpdate,
}) => {
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationFormData, setLocationFormData] = useState({
    address: "",
    location: {
      lat: undefined as number | undefined,
      lng: undefined as number | undefined,
    },
  });
  const [loadingLocationUpdate, setLoadingLocationUpdate] = useState(false);

  // Initialize location form data
  useEffect(() => {
    if (shopData) {
      setLocationFormData({
        address: shopData.address || "",
        location: {
          lat: shopData.location?.lat,
          lng: shopData.location?.lng,
        },
      });
    }
  }, [shopData]);

  const handleLocationMapSelect = (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    setLocationFormData((prev) => ({
      ...prev,
      location: {
        lat: location.latitude,
        lng: location.longitude,
      },
      ...(location.address ? { address: location.address } : {}),
    }));

    if (location.address) {
      toast.success("Location pinpointed! Address automatically updated.");
    } else {
      toast.success("Location coordinates updated.");
    }
  };

  const handleSaveLocation = async () => {
    setLoadingLocationUpdate(true);
    try {
      const data = await apiClient.put<{ message?: string }>(
        `/shops/${shopId}/details`,
        {
          address: locationFormData.address,
          location: {
            lat: locationFormData.location.lat,
            lng: locationFormData.location.lng,
          },
        }
      );

      toast.success((data as { message?: string })?.message || "Location updated successfully!");
      setIsEditingLocation(false);
      onLocationUpdate();
    } catch (error) {
      console.error("Error updating location:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update location. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoadingLocationUpdate(false);
    }
  };

  const handleCancelLocationEdit = () => {
    setLocationFormData({
      address: shopData?.address || "",
      location: {
        lat: shopData?.location?.lat,
        lng: shopData?.location?.lng,
      },
    });
    setIsEditingLocation(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#101010] rounded-xl overflow-hidden">
        {/* Header with Edit Location button */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#303236]">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-[#FFCC00]" />
            <h3 className="text-lg font-semibold text-[#FFCC00]">Pin Your Shop Location</h3>
          </div>

          {!isEditingLocation ? (
            <button
              onClick={() => setIsEditingLocation(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black text-sm font-medium rounded-md hover:bg-yellow-400 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit Location
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelLocationEdit}
                className="px-4 py-2 bg-[#303236] text-white text-sm font-medium rounded-md hover:bg-[#404040] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={loadingLocationUpdate}
                className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black text-sm font-medium rounded-md hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {loadingLocationUpdate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Location"
                )}
              </button>
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Current Shop Address Section */}
          <div>
            <p className="text-sm font-semibold text-white mb-2">Current Shop Address</p>
            <div className="bg-white border border-[#e2e8f0] rounded px-3 py-2 shadow-sm">
              <p className="text-sm text-[#101010] font-medium">
                {locationFormData.address || "No address set"}
              </p>
            </div>

            {/* Coordinates display */}
            {locationFormData.location.lat && locationFormData.location.lng && (
              <p className="text-sm font-semibold text-white mt-3">
                Coordinates: {locationFormData.location.lat.toFixed(6)}, {locationFormData.location.lng.toFixed(6)}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#303236]" />

          {/* Update Your Shop Location Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <MapPinned className="w-6 h-6 text-[#FFCC00]" />
              <h3 className="text-base font-semibold text-[#FFCC00]">Update Your Shop Location</h3>
            </div>

            {/* Location Picker with Map */}
            <div className={!isEditingLocation ? "pointer-events-none opacity-60" : ""}>
              <LocationPickerWrapper
                initialLocation={
                  locationFormData.location.lat && locationFormData.location.lng
                    ? {
                        latitude: locationFormData.location.lat,
                        longitude: locationFormData.location.lng,
                        address: locationFormData.address,
                      }
                    : undefined
                }
                onLocationSelect={handleLocationMapSelect}
                height="458px"
              />
            </div>
          </div>

          {/* Selected Location Coordinates */}
          {locationFormData.location.lat && locationFormData.location.lng && (
            <p className="text-sm font-semibold">
              <span className="text-[#FFCC00]">Selected Location Coordinates:</span>
              <span className="text-white"> {locationFormData.location.lat.toFixed(6)}, {locationFormData.location.lng.toFixed(6)}</span>
            </p>
          )}

          {/* Help/Alert Section */}
          <div className="bg-[#191919] border border-[#e2e8f0] rounded-lg p-4 flex gap-3">
            <div className="flex-shrink-0 pt-0.5">
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-white mb-1">How to Update your Location</p>
              <p className="text-sm text-white">
                Click <span className="text-[#FFCC00] font-bold">&quot;Edit Location&quot;</span> to update your shop&apos;s address and location. You can either type your address directly or click on the map to pinpoint your exact location. The address will be automatically filled when you select a location on the map.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
