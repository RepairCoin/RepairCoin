"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapPin, Navigation, Phone, Mail, Globe, Loader2 } from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";
import { ShopServiceWithShopInfo } from "@/services/api/services";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";

// Dynamic import for map to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const Circle = dynamic(() => import("react-leaflet").then((mod) => mod.Circle), {
  ssr: false,
});

// Custom marker icon configuration
const L = typeof window !== "undefined" ? require("leaflet") : null;
let customIcon: any = null;
let userLocationIcon: any = null;

if (L) {
  // Shop marker icon (yellow)
  customIcon = new L.Icon({
    iconUrl: "/marker-icon.png",
    iconRetinaUrl: "/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    shadowAnchor: [12, 41],
  });

  // User location marker (blue)
  userLocationIcon = new L.Icon({
    iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234299e1' stroke='white' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='8'/%3E%3C/svg%3E",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

// Map view controller component
const MapViewController = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { useMap } = mod;
      return function MapViewComponent({
        center,
        zoom,
      }: {
        center: [number, number];
        zoom: number;
      }) {
        const map = useMap();

        useEffect(() => {
          if (map && center && zoom) {
            map.flyTo(center, zoom, {
              animate: true,
              duration: 1,
            });
          }
        }, [map, center, zoom]);

        return null;
      };
    }),
  { ssr: false }
);

interface Shop {
  shopId: string;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface ShopMapViewProps {
  services: ShopServiceWithShopInfo[];
  loading: boolean;
  onShopSelect: (shopId: string) => void;
}

export const ShopMapView: React.FC<ShopMapViewProps> = ({
  services,
  loading,
  onShopSelect,
}) => {
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]); // Manila default
  const [mapZoom, setMapZoom] = useState(12);
  const [requestingLocation, setRequestingLocation] = useState(false);

  // Extract unique shops from services
  const shops: Shop[] = React.useMemo(() => {
    const shopMap = new Map<string, Shop>();

    services.forEach((service) => {
      if (!shopMap.has(service.shopId)) {
        shopMap.set(service.shopId, {
          shopId: service.shopId,
          shopName: service.shopName,
          shopAddress: service.shopAddress,
          shopPhone: service.shopPhone,
          shopEmail: service.shopEmail,
          location:
            service.shopLocation?.lat && service.shopLocation?.lng
              ? {
                  lat: service.shopLocation.lat,
                  lng: service.shopLocation.lng,
                }
              : undefined,
        });
      }
    });

    return Array.from(shopMap.values()).filter((shop) => shop.location);
  }, [services]);

  // Set initial map center to first shop with location
  useEffect(() => {
    if (shops.length > 0 && shops[0].location) {
      setMapCenter([shops[0].location.lat, shops[0].location.lng]);
    }
  }, [shops]);

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setRequestingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setUserLocation(userPos);
        setMapCenter(userPos);
        setMapZoom(14);
        toast.success("Location found! Showing nearby shops");
        setRequestingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        let errorMessage = "Could not get your location";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }

        toast.error(errorMessage);
        setRequestingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleShopMarkerClick = (shop: Shop) => {
    setSelectedShop(shop);
    if (shop.location) {
      setMapCenter([shop.location.lat, shop.location.lng]);
      setMapZoom(16);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-[#1A1A1A] border border-gray-800 rounded-2xl">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white">Loading map...</p>
        </div>
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          No Shops with Locations
        </h3>
        <p className="text-gray-400 mb-6">
          No shops have location data available for map display
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Location Request Button */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Find Nearby Shops
            </h3>
            <p className="text-gray-400 text-sm">
              {userLocation
                ? "Showing shops near your location"
                : "Allow location access to find shops near you"}
            </p>
          </div>
          <button
            onClick={requestUserLocation}
            disabled={requestingLocation}
            className="flex items-center gap-2 bg-[#FFCC00] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#FFD700] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {requestingLocation ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Getting Location...
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                {userLocation ? "Update Location" : "Use My Location"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="h-[600px] rounded-xl overflow-hidden border border-gray-800">
            {typeof window !== "undefined" && (
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewController center={mapCenter} zoom={mapZoom} />

                {/* User Location Marker */}
                {userLocation && (
                  <>
                    <Marker
                      position={userLocation}
                      icon={userLocationIcon || undefined}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-semibold">Your Location</h4>
                          <p className="text-sm text-gray-600">You are here</p>
                        </div>
                      </Popup>
                    </Marker>
                    {/* Blue circle around user location */}
                    <Circle
                      center={userLocation}
                      radius={1000} // 1km radius
                      pathOptions={{
                        fillColor: "#4299e1",
                        fillOpacity: 0.1,
                        color: "#4299e1",
                        weight: 2,
                      }}
                    />
                  </>
                )}

                {/* Shop Markers */}
                {shops.map((shop) => (
                  <Marker
                    key={shop.shopId}
                    position={[shop.location!.lat, shop.location!.lng]}
                    icon={customIcon || undefined}
                    eventHandlers={{
                      click: () => handleShopMarkerClick(shop),
                    }}
                  >
                    <Popup>
                      <div className="p-2">
                        <h4 className="font-semibold">{shop.shopName}</h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {shop.shopAddress}
                        </p>
                        {shop.shopPhone && (
                          <p className="text-sm">
                            <Phone className="inline w-3 h-3 mr-1" />
                            {shop.shopPhone}
                          </p>
                        )}
                        <button
                          onClick={() => onShopSelect(shop.shopId)}
                          className="mt-2 w-full bg-[#FFCC00] text-black text-sm font-semibold px-3 py-1 rounded hover:bg-[#FFD700] transition-colors"
                        >
                          View Services
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Shop Details Sidebar */}
        <div className="lg:col-span-1">
          {selectedShop ? (
            <div className="bg-[#2F2F2F] rounded-xl p-6 border border-gray-600 sticky top-6">
              <h3 className="text-xl font-bold text-[#FFCC00] mb-4">
                {selectedShop.shopName}
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-[#FFCC00] mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-sm text-gray-300">{selectedShop.shopAddress}</p>
                </div>

                {selectedShop.shopPhone && (
                  <div className="flex items-center">
                    <Phone className="w-5 h-5 text-[#FFCC00] mr-3" />
                    <a
                      href={`tel:${selectedShop.shopPhone}`}
                      className="text-sm text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      {selectedShop.shopPhone}
                    </a>
                  </div>
                )}

                {selectedShop.shopEmail && (
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-[#FFCC00] mr-3" />
                    <a
                      href={`mailto:${selectedShop.shopEmail}`}
                      className="text-sm text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      {selectedShop.shopEmail}
                    </a>
                  </div>
                )}
              </div>

              <button
                onClick={() => onShopSelect(selectedShop.shopId)}
                className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
              >
                View Services
              </button>
            </div>
          ) : (
            <div className="bg-[#2F2F2F] rounded-xl p-8 border border-gray-600 text-center">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                Select a Shop
              </h3>
              <p className="text-gray-400 text-sm">
                Click on any marker on the map to view shop details
              </p>
            </div>
          )}

          {/* Shops List */}
          <div className="mt-6 bg-[#2F2F2F] rounded-xl border border-gray-600 max-h-[400px] overflow-y-auto">
            <div className="sticky top-0 bg-[#2F2F2F] border-b border-gray-700 px-4 py-3">
              <h4 className="font-semibold text-white">
                Nearby Shops ({shops.length})
              </h4>
            </div>
            <div className="p-2 space-y-2">
              {shops.map((shop) => (
                <button
                  key={shop.shopId}
                  onClick={() => handleShopMarkerClick(shop)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedShop?.shopId === shop.shopId
                      ? "bg-[#FFCC00] bg-opacity-20 border border-[#FFCC00]"
                      : "hover:bg-[#1A1A1A]"
                  }`}
                >
                  <h5
                    className={`font-medium ${
                      selectedShop?.shopId === shop.shopId
                        ? "text-[#FFCC00]"
                        : "text-white"
                    }`}
                  >
                    {shop.shopName}
                  </h5>
                  <p className="text-xs text-gray-400 mt-1">{shop.shopAddress}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
