"use client";

/**
 * Services Map View — Progressive Disclosure Layout
 *
 * State 1: Full-width map with all shop markers + glowing "Update Location" button
 * State 2: After location obtained → sidebar slides in with Nearby Shops
 * State 3: Shop selected → Shop Info panel appears above Nearby Shops
 *
 * Consumes shared components from components/map/ and useShopMap hook.
 */

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin } from "lucide-react";
import { ShopMapData } from "@/services/api/shop";
import { useShopMap } from "@/hooks/useShopMap";
import { milesToMeters } from "@/utils/distance";
import { createShopIcon, createUserLocationIcon } from "@/components/map/ShopMarker";
import { RadiusControl } from "@/components/map/RadiusControl";
import { LocationButton } from "@/components/map/LocationButton";
import { ShopInfoPanel } from "@/components/map/ShopInfoPanel";
import { NearbyShopsList } from "@/components/map/NearbyShopsList";
import "leaflet/dist/leaflet.css";

// Dynamic imports for Leaflet (avoid SSR)
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
const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

// Map view controller — flies to new center/zoom
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
            map.flyTo(center, zoom, { animate: true, duration: 1 });
          }
        }, [map, center, zoom]);
        return null;
      };
    }),
  { ssr: false }
);

export const ShopMapView: React.FC = () => {
  const {
    shops,
    shopsLoading,
    nearbyShops,
    displayedShops,
    userLocation,
    hasLocation,
    mapCenter,
    mapZoom,
    requestingLocation,
    requestLocation,
    setMapCenter,
    setMapZoom,
    radiusMiles,
    increaseRadius,
    decreaseRadius,
    selectedShop,
    setSelectedShop,
    clearSelection,
    showDirections,
    routeData,
    isLoadingRoute,
    openDirections,
    closeDirections,
    isShowingNearest,
  } = useShopMap({ autoDetectLocation: false, defaultRadius: 1 });

  const [glowActive, setGlowActive] = useState(true);

  // Stop glow when location is obtained
  useEffect(() => {
    if (hasLocation) setGlowActive(false);
  }, [hasLocation]);

  const handleLocationClick = () => {
    requestLocation();
  };

  const handleShopSelect = (shop: ShopMapData) => {
    setSelectedShop(shop);
    if (shop.location) {
      setMapCenter([shop.location.lat, shop.location.lng]);
      if (mapZoom < 14) setMapZoom(15);
    }
  };

  const handleMapClick = () => {
    if (selectedShop) clearSelection();
  };

  // Find distance for selected shop
  const selectedDistance = selectedShop
    ? nearbyShops.find((s) => s.shopId === selectedShop.shopId)?.distance
    : undefined;

  if (shopsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-[#121212] border border-gray-800 rounded-2xl">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#FFCC00] animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading shops...</p>
        </div>
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="bg-[#121212] border border-gray-800 rounded-2xl p-12 text-center">
        <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white mb-1">No Shops on Map</h3>
        <p className="text-gray-500 text-sm">No shops have set their location yet. Try Grid view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Find Nearby Shops</h3>
          <p className="text-gray-500 text-sm">
            {hasLocation
              ? `${nearbyShops.length} shops within ${radiusMiles} mi`
              : `${shops.length} shops on map`}
          </p>
        </div>
        <LocationButton
          hasLocation={hasLocation}
          requesting={requestingLocation}
          glowActive={glowActive}
          onClick={handleLocationClick}
        />
      </div>

      {/* Map + Sidebar Layout — always 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 relative">
          <div className="h-[600px] rounded-xl overflow-hidden border border-gray-800">
            {typeof window !== "undefined" && (
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewController center={mapCenter} zoom={mapZoom} />

                {/* User location marker */}
                {userLocation && (
                  <Marker position={userLocation} icon={createUserLocationIcon()} />
                )}

                {/* Radius circle (only after location obtained) */}
                {hasLocation && userLocation && (
                  <Circle
                    center={userLocation}
                    radius={milesToMeters(radiusMiles)}
                    pathOptions={{
                      color: "rgba(255, 204, 0, 0.8)",
                      fillColor: "rgba(255, 204, 0, 0.1)",
                      fillOpacity: 0.1,
                      weight: 2,
                    }}
                  />
                )}

                {/* Route polyline */}
                {showDirections && routeData && routeData.coordinates.length > 0 && (
                  <Polyline
                    positions={routeData.coordinates}
                    pathOptions={{ color: "#FFCC00", weight: 5, opacity: 0.9 }}
                  />
                )}

                {/* Shop markers */}
                {shops.map((shop) => (
                  <Marker
                    key={shop.shopId}
                    position={[shop.location.lat, shop.location.lng]}
                    icon={createShopIcon(selectedShop?.shopId === shop.shopId)}
                    eventHandlers={{ click: () => handleShopSelect(shop) }}
                  />
                ))}
              </MapContainer>
            )}
          </div>

          {/* Radius control overlay (only after location) */}
          {hasLocation && (
            <RadiusControl
              radiusMiles={radiusMiles}
              shopCount={nearbyShops.length}
              onIncrease={increaseRadius}
              onDecrease={decreaseRadius}
            />
          )}
        </div>

        {/* Right Column — always visible, matches map height on desktop */}
        <div className="lg:col-span-1 flex flex-col gap-4 lg:h-[600px]">
          {/* Shop Info (when selected) */}
          {selectedShop ? (
            <ShopInfoPanel
              shop={selectedShop}
              distance={selectedDistance}
              hasLocation={hasLocation}
              showDirections={showDirections}
              routeData={routeData}
              isLoadingRoute={isLoadingRoute}
              onGetDirections={() => openDirections(selectedShop)}
              onCloseDirections={closeDirections}
              onClose={clearSelection}
            />
          ) : (
            /* Placeholder when no shop selected */
            <div className="bg-[#1a1a1a] rounded-xl p-8 border border-gray-800 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-300 mb-1">Select a Shop</h3>
              <p className="text-gray-500 text-sm">
                Click on any marker on the map to view shop details
              </p>
            </div>
          )}

          {/* Nearby Shops list — fills remaining height */}
          <div className="flex-1 min-h-0">
            <NearbyShopsList
              shops={displayedShops}
              selectedShopId={selectedShop?.shopId}
              radiusMiles={radiusMiles}
              hasLocation={hasLocation}
              totalShopCount={shops.length}
              isShowingNearest={isShowingNearest}
              onSelect={handleShopSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
