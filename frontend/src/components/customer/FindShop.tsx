"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Search,
  MapPin,
  Phone,
  Mail,
  Globe,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";
import { ShopService } from "@/services/shopService";
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

// Custom marker icon configuration
const L = typeof window !== "undefined" ? require("leaflet") : null;
let customIcon: any = null;

if (L) {
  // Create custom icon
  customIcon = new L.Icon({
    iconUrl: "/marker-icon.png",
    iconRetinaUrl: "/marker-icon.png", // Use same icon for retina displays
    shadowUrl: "/leaflet/marker-shadow.png",
    iconSize: [25, 41], // Size of the icon
    iconAnchor: [12, 41], // Point of the icon which will correspond to marker's location
    popupAnchor: [1, -34], // Point from which the popup should open relative to the iconAnchor
    shadowSize: [41, 41], // Size of the shadow
    shadowAnchor: [12, 41], // Point from which the shadow should open relative to the iconAnchor
  });
}

// Create a separate component for map view control that will be imported dynamically
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
  name: string;
  active: boolean;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  verified: boolean;
  crossShopEnabled: boolean;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  location?: {
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  joinDate: string;
}

export function FindShop() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    14.5995, 120.9842,
  ]); // Manila, Philippines
  const [mapZoom, setMapZoom] = useState(12);

  // Fetch shops from API on component mount
  useEffect(() => {
    const fetchShops = async () => {
      try {
        setLoading(true);
        const shopsData = await ShopService.getAllShops();
        setShops(shopsData);

        // Set map center to first shop with location data or keep default
        const shopWithLocation = shopsData.find(
          (shop) => shop.location?.lat && shop.location?.lng
        );
        if (shopWithLocation) {
          setMapCenter([
            shopWithLocation.location!.lat!,
            shopWithLocation.location!.lng!,
          ]);
        }
      } catch (error) {
        console.error("Error fetching shops:", error);
        toast.error("Failed to load shops. Please try again.");
        setShops([]);
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, []);

  // Memoized filtered shops for performance optimization
  const filteredShops = useMemo(() => {
    if (searchQuery.trim() === "") {
      return shops;
    }

    const query = searchQuery.toLowerCase();
    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(query) ||
        shop.address.toLowerCase().includes(query) ||
        shop.location?.city?.toLowerCase().includes(query) ||
        shop.shopId.toLowerCase().includes(query)
    );
  }, [searchQuery, shops]);

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
    if (shop.location?.lat && shop.location?.lng) {
      setMapCenter([shop.location.lat, shop.location.lng]);
      setMapZoom(16); // Increased zoom for better focus on the shop
    } else {
      // If shop has no coordinates, show a message
      toast.error(`${shop.name} doesn't have map coordinates yet`);
    }
  };

  const handleMarkerClick = (shop: Shop) => {
    setSelectedShop(shop);
    if (shop.location?.lat && shop.location?.lng) {
      setMapCenter([shop.location.lat, shop.location.lng]);
      setMapZoom(16); // Also zoom when clicking on marker
    }
  };

  console.log("filteredShopsfilteredShops: ", filteredShops);

  return (
    <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden mb-6 sm:mb-8">
      <div
        className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl flex justify-between items-center"
        style={{
          backgroundImage: `url('/img/cust-ref-widget3.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <p className="text-lg md:text-xl text-gray-900 font-semibold">
          Find Repair Shops
        </p>
      </div>

      <div className="bg-[#212121] p-4">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by shop name, address, city, or shop ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-[#2F2F2F] text-white rounded-xl transition-all pl-10 border-2 border-transparent focus:border-[#FFCC00]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shop List */}
          <div className="space-y-4 max-h-[650px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-gray-100">
                Available Shops (
                {loading
                  ? "..."
                  : filteredShops.filter((s) => s.verified).length}
                )
              </h3>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading shops...</span>
              </div>
            )}
            {!loading &&
              filteredShops.map((shop) => (
                <div
                  key={shop.shopId}
                  onClick={() => handleShopSelect(shop)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedShop?.shopId === shop.shopId
                      ? "border-blue-500 bg-[#FFCC00] bg-opacity-60"
                      : "border-gray-600 hover:border-gray-300 hover:shadow-md"
                  } ${!shop.verified ? "opacity-60" : ""}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4
                        className={`font-semibold ${
                          selectedShop?.shopId === shop.shopId
                            ? "text-black"
                            : "text-[#FFCC00]"
                        }`}
                      >
                        {shop.name}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      {shop.verified && (
                        <span className="px-2 py-1 bg-[#00880E] text-gray-100 text-xs font-medium rounded-full">
                          Verified
                        </span>
                      )}
                      {!shop.verified && (
                        <span className="px-2 py-1 bg-[#FFCC00] text-gray-100 text-xs font-medium rounded-full">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    className={`${
                      selectedShop?.shopId === shop.shopId
                        ? "text-black"
                        : "text-gray-100"
                    } text-sm mb-1`}
                  >
                    <MapPin
                      className={`inline w-4 h-4 mr-1 ${
                        !shop.location?.lat || !shop.location?.lng
                          ? selectedShop?.shopId === shop.shopId
                            ? "text-black"
                            : "text-[#FFCC00]"
                          : ""
                      }`}
                    />
                    {shop.address}
                    {shop.location?.city && `, ${shop.location.city}`}
                    {shop.location?.state && `, ${shop.location.state}`}
                    {shop.location?.zipCode && ` ${shop.location.zipCode}`}
                    {(!shop.location?.lat || !shop.location?.lng) && (
                      <span
                        className={`${
                          selectedShop?.shopId === shop.shopId
                            ? "text-gray-900"
                            : "text-gray-300"
                        } text-xs block mt-1`}
                      >
                        📍 Location coordinates not available
                      </span>
                    )}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    {shop.crossShopEnabled && (
                      <span className="text-xs text-blue-600 font-medium">
                        Cross-Shop ✓
                      </span>
                    )}
                  </div>
                </div>
              ))}
            {!loading && filteredShops.length === 0 && (
              <div className="text-center py-8 text-gray-100">
                {shops.length === 0
                  ? "No shops available yet."
                  : "No shops found matching your search."}
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="relative">
            <div className="h-[400px] rounded-lg overflow-hidden border border-gray-200">
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
                  {filteredShops
                    .filter((shop) => shop.location?.lat && shop.location?.lng)
                    .map((shop) => (
                      <Marker
                        key={shop.shopId}
                        position={[shop.location!.lat!, shop.location!.lng!]}
                        icon={customIcon || undefined}
                        eventHandlers={{
                          click: () => handleMarkerClick(shop),
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <h4 className="font-semibold">{shop.name}</h4>
                            <p className="text-sm text-gray-600">
                              {shop.address}
                            </p>
                            {shop.location?.city && shop.location?.state && (
                              <p className="text-sm text-gray-600">
                                {shop.location.city}, {shop.location.state}{" "}
                                {shop.location.zipCode || ""}
                              </p>
                            )}
                            {shop.phone && (
                              <p className="text-sm mt-1">
                                <Phone className="inline w-3 h-3 mr-1" />
                                {shop.phone}
                              </p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                </MapContainer>
              )}
            </div>

            {/* Shop Details Container */}
            {selectedShop && (
              <div className="mt-6 bg-[#2F2F2F] rounded-xl p-4 border border-gray-600 shadow-xl">
                {/* Contact Information */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-[#FFCC00] mb-3">
                    {selectedShop.name}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <MapPin className="w-4 h-4 text-[#FFCC00] mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-sm text-gray-300">
                        {selectedShop.address}
                      </p>
                    </div>
                    {selectedShop.phone && (
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-[#FFCC00] mr-2" />
                        <p className="text-sm text-gray-300">
                          {selectedShop.phone}
                        </p>
                      </div>
                    )}
                    {selectedShop.email && (
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 text-[#FFCC00] mr-2" />
                        <p className="text-sm text-gray-300">
                          {selectedShop.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Social Media and Website */}
                <div className="flex items-center w-full pt-4 border-t border-gray-700">
                  {/* Social Media */}
                  <div className="w-full">
                    <h4 className="text-sm font-semibold text-white mb-2">
                      Follow Us
                    </h4>
                    <div className="flex items-center justy-center w-full gap-2">
                      <div className="flex items-center gap-2">
                        {selectedShop.facebook ? (
                          <a
                            href={selectedShop.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full transition-all duration-200 group shadow hover:shadow-blue-600/25 hover:scale-105"
                            title="Visit our Facebook page"
                          >
                            <FaFacebook className="w-4 h-4 text-white" />
                          </a>
                        ) : (
                          <div className="flex items-center justify-center w-8 h-8 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                            <FaFacebook className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        {selectedShop.twitter ? (
                          <a
                            href={selectedShop.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 bg-sky-500 hover:bg-sky-600 rounded-full transition-all duration-200 group shadow hover:shadow-sky-500/25 hover:scale-105"
                            title="Follow us on Twitter"
                          >
                            <FaTwitter className="w-4 h-4 text-white" />
                          </a>
                        ) : (
                          <div className="flex items-center justify-center w-8 h-8 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                            <FaTwitter className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        {selectedShop.instagram ? (
                          <a
                            href={selectedShop.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full transition-all duration-200 group shadow hover:shadow-purple-500/25 hover:scale-105"
                            title="Follow us on Instagram"
                          >
                            <FaInstagram className="w-4 h-4 text-white" />
                          </a>
                        ) : (
                          <div className="flex items-center justify-center w-8 h-8 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                            <FaInstagram className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="w-full">
                        {selectedShop.website ? (
                          <a
                            href={selectedShop.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center w-full justify-center px-3 py-2 bg-[#FFCC00] text-[#2F2F2F] text-sm rounded-lg hover:bg-[#FFCC00] transition-all duration-200 font-medium shadow hover:shadow-blue-600/25 hover:scale-105"
                          >
                            <Globe className="w-4 h-4 mr-1.5" />
                            Website
                          </a>
                        ) : (
                          <div className="flex items-center w-full justify-center px-3 py-2 bg-gray-600 opacity-50 text-gray-400 text-sm rounded-lg cursor-not-allowed">
                            <Globe className="w-4 h-4 mr-1.5" />
                            Website
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedShop && (
              <div className="mt-6 bg-[#2F2F2F] rounded-xl p-6 sm:p-8 border border-gray-600 text-center">
                <div className="text-gray-400 mb-4">
                  <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-300 mb-3">
                  Select a Shop to View Details
                </h3>
                <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                  Click on any shop from the list or map to see detailed
                  information, contact details, and social media links.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
