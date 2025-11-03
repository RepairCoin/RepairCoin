"use client";

import React, { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import toast from "react-hot-toast";
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

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setLocationFormData((prev) => ({
      ...prev,
      address: value,
    }));
  };

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
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("shopAuthToken") ||
        sessionStorage.getItem("shopAuthToken");

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/details`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            address: locationFormData.address,
            location: {
              lat: locationFormData.location.lat,
              lng: locationFormData.location.lng,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(
          errorData.error ||
            `Failed to update location (${response.status})`
        );
      }

      const data = await response.json();
      toast.success(data.message || "Location updated successfully!");
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
      <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
        <div
          className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Pinpoint Your Shop Location
          </p>
          {!isEditingLocation ? (
            <button
              onClick={() => setIsEditingLocation(true)}
              className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors"
            >
              Edit Location
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelLocationEdit}
                className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={loadingLocationUpdate}
                className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {loadingLocationUpdate ? "Saving..." : "Save Location"}
              </button>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {/* Address Input */}
          <div className="mb-6">
            <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
              <MapPin className="w-6 h-6 inline mr-1" />
              Shop Address
            </label>
            <input
              type="text"
              value={locationFormData.address}
              onChange={handleLocationInputChange}
              disabled={!isEditingLocation}
              className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              placeholder="123 Main St, City, State ZIP"
            />

            {/* Current coordinates display */}
            {locationFormData.location.lat && locationFormData.location.lng && (
              <div className="mt-2 text-xs text-gray-400">
                Coordinates: {locationFormData.location.lat.toFixed(6)},{" "}
                {locationFormData.location.lng.toFixed(6)}
              </div>
            )}
          </div>

          {/* Map Section */}
          <div className="bg-[#2F2F2F] rounded-xl p-4">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#FFCC00]" />
              {isEditingLocation ? "Click on the map to update your location" : "Your Shop Location"}
            </h4>

            <div className={!isEditingLocation ? "pointer-events-none opacity-70" : ""}>
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
                height="450px"
              />
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-1">
              📍 How to Use
            </h4>
            <p className="text-sm text-blue-300">
              Click &ldquo;Edit Location&rdquo; to update your shop&rsquo;s address and location.
              You can either type your address directly or click on the map to pinpoint
              your exact location. The address will be automatically filled when you
              select a location on the map.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
