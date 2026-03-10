"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  Phone,
  Globe,
  CheckCircle,
  Store,
  Clock,
  ExternalLink,
  Share2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { ShopService } from "@/services/shopService";
import { getShopServices } from "@/services/api/services";
import type { ShopService as ShopServiceType } from "@/services/api/services";
import { StarRating } from "./StarRating";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";

// Custom styles for Leaflet popups
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    .leaflet-popup-content-wrapper {
      background-color: #1F2937 !important;
      color: white !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
      padding: 0 !important;
      border: 1px solid #374151 !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      min-width: 200px !important;
    }
    .leaflet-popup-tip-container {
      display: none !important;
    }
    .leaflet-popup-close-button {
      color: #9CA3AF !important;
      font-size: 22px !important;
      font-weight: normal !important;
      width: 24px !important;
      height: 24px !important;
      top: 6px !important;
      right: -8px !important;
      text-align: center !important;
      text-decoration: none !important;
      padding: 0 !important;
      margin-right: 16px !important;
    }
    .leaflet-popup-close-button:hover {
      color: #FFCC00 !important;
    }
  `;
  if (!document.getElementById("leaflet-findshop-popup-styles")) {
    style.id = "leaflet-findshop-popup-styles";
    document.head.appendChild(style);
  }
}

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
}

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
  category?: string;
  tier?: string;
  facebook?: string;
  x?: string;
  instagram?: string;
  linkedin?: string;
  avgRating?: number;
  totalReviews?: number;
  reviewCount?: number;
  distance?: number;
  estimatedTime?: number;
  location?: {
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  joinDate: string;
}

// Helper to format tier label
function getTierLabel(tier?: string): string {
  if (!tier) return "Standard Shop";
  const t = tier.toLowerCase();
  if (t.includes("elite")) return "Elite Shop";
  if (t.includes("premium")) return "Premium Shop";
  return "Standard Shop";
}

function getTierBadgeColor(tier?: string): string {
  if (!tier) return "bg-gray-600 text-gray-300";
  const t = tier.toLowerCase();
  if (t.includes("elite")) return "bg-purple-600/20 text-purple-400 border border-purple-500/30";
  if (t.includes("premium")) return "bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/30";
  return "bg-gray-600/20 text-gray-300 border border-gray-500/30";
}


export function FindShop() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]);
  const [mapZoom, setMapZoom] = useState(12);
  const [activeDetailTab, setActiveDetailTab] = useState<"services" | "rewards">("services");
  const [shopServices, setShopServices] = useState<ShopServiceType[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number; limit: number; totalItems: number; totalPages: number; hasMore: boolean;
  } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // Debounce search input by 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when category changes
  useEffect(() => {
    setPage(1);
  }, [filterCategory]);

  // Fetch shops from server whenever search/category/page changes
  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);
      const result = await ShopService.getAllShops({
        search: debouncedSearch || undefined,
        category: filterCategory !== "all" ? filterCategory : undefined,
        page,
        limit: ITEMS_PER_PAGE,
      });
      setShops(result.shops);
      setPagination(result.pagination || null);

      // On first load with no filters, populate categories list
      if (!categoriesLoaded && !debouncedSearch && filterCategory === "all" && page === 1) {
        const cats = new Set<string>();
        result.shops.forEach((s: Shop) => {
          if (s.category) cats.add(s.category);
        });
        // Only set if we got results — for a more complete list, fetch all on first load
        if (cats.size > 0) {
          setCategories(Array.from(cats).sort());
          setCategoriesLoaded(true);
        }
      }

      // Center map on first shop with location (only on first page load)
      if (page === 1 && !debouncedSearch && filterCategory === "all") {
        const shopWithLocation = result.shops.find(
          (shop: Shop) => shop.location?.lat && shop.location?.lng
        );
        if (shopWithLocation) {
          setMapCenter([
            shopWithLocation.location!.lat!,
            shopWithLocation.location!.lng!,
          ]);
        }
      }
    } catch (error) {
      console.error("Error fetching shops:", error);
      toast.error("Failed to load shops. Please try again.");
      setShops([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterCategory, page, categoriesLoaded]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Load all categories once on mount (separate lightweight call)
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await ShopService.getAllShops({ limit: 100 });
        const cats = new Set<string>();
        result.shops.forEach((s: any) => {
          if (s.category) cats.add(s.category);
        });
        if (cats.size > 0) {
          setCategories(Array.from(cats).sort());
          setCategoriesLoaded(true);
        }
      } catch {
        // Categories will be populated from the main fetch
      }
    };
    loadCategories();
  }, []);

  // Fetch services when a shop is selected
  useEffect(() => {
    if (selectedShop) {
      const fetchServices = async () => {
        setLoadingServices(true);
        try {
          const result = await getShopServices(selectedShop.shopId);
          if (result && result.data) {
            setShopServices(result.data);
          } else {
            setShopServices([]);
          }
        } catch {
          setShopServices([]);
        } finally {
          setLoadingServices(false);
        }
      };
      fetchServices();
      setActiveDetailTab("services");
    }
  }, [selectedShop?.shopId]);

  // Shops are already sorted by server (avgRating DESC, totalReviews DESC)
  const filteredShops = shops;

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
    if (shop.location?.lat && shop.location?.lng) {
      setMapCenter([shop.location.lat, shop.location.lng]);
      setMapZoom(16);
    }
  };

  const handleMarkerClick = (shop: Shop) => {
    setSelectedShop(shop);
  };

  const handleViewService = (serviceId: string) => {
    // Navigate to marketplace with the service param to auto-open the modal
    router.push(`/customer?tab=marketplace&service=${serviceId}`);
  };

  const fullAddress = (shop: Shop) => {
    let addr = shop.address;
    if (shop.location?.city) addr += `, ${shop.location.city}`;
    if (shop.location?.state) addr += `, ${shop.location.state}`;
    if (shop.location?.zipCode) addr += ` ${shop.location.zipCode}`;
    return addr;
  };

  return (
    <div className="space-y-6">
      {/* Main Content Card */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
        {/* Section Header */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-[#FFCC00]" />
            <h2 className="text-[#FFCC00] font-semibold text-lg">Find RepairCoin Shop Partners</h2>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Search + Shop List */}
            <div>
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by shop name, address, city or shop id..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#212121] text-white text-sm rounded-lg pl-10 border border-gray-700 focus:border-[#FFCC00] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Available Shops Count + Filter */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">
                  Available Shops ({loading ? "..." : pagination?.totalItems ?? filteredShops.length})
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Filter by:</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-[#212121] border border-gray-700 text-gray-300 text-xs rounded-md px-2 py-1 focus:border-[#FFCC00] focus:outline-none"
                  >
                    <option value="all">All</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shop List */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
                    <span className="ml-3 text-gray-400">Loading shops...</span>
                  </div>
                )}

                {!loading && filteredShops.map((shop) => (
                  <div
                    key={shop.shopId}
                    onClick={() => handleShopSelect(shop)}
                    className={`p-4 rounded-lg cursor-pointer transition-all border ${
                      selectedShop?.shopId === shop.shopId
                        ? "border-[#FFCC00] bg-[#FFCC00]/5"
                        : "border-gray-800 bg-[#212121] hover:border-gray-600"
                    }`}
                  >
                    {/* Shop Name Row */}
                    <div className="flex items-start gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-full bg-[#FFCC00]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Store className="w-3.5 h-3.5 text-[#FFCC00]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-sm truncate">{shop.name}</h4>
                        {/* Rating + Distance + Time */}
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <StarRating value={shop.avgRating || 0} size="sm" showNumber showCount totalCount={shop.totalReviews || 0} />
                          {shop.distance !== undefined && (
                            <span className="flex items-center gap-0.5 text-gray-500 text-xs">
                              <MapPin className="w-3 h-3" />
                              {shop.distance} miles
                            </span>
                          )}
                          {shop.estimatedTime !== undefined && (
                            <span className="flex items-center gap-0.5 text-gray-500 text-xs">
                              <Clock className="w-3 h-3" />
                              ~ {shop.estimatedTime} mins
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <p className="text-gray-400 text-xs ml-9 mb-2">
                      {fullAddress(shop)}
                    </p>

                    {/* Bottom: Category + Tier + Verified + Location status */}
                    <div className="flex items-center justify-between ml-9">
                      <span className="text-gray-500 text-xs">
                        {shop.category || "General"} &bull; {getTierLabel(shop.tier)}
                      </span>
                      <div className="flex items-center gap-2">
                        {!shop.location?.lat && !shop.location?.lng && (
                          <span className="flex items-center gap-1 text-gray-500 text-xs">
                            <MapPin className="w-3 h-3" />
                            No map
                          </span>
                        )}
                        {shop.verified && (
                          <span className="flex items-center gap-1 text-green-500 text-xs font-medium">
                            <CheckCircle className="w-3.5 h-3.5 fill-green-500 text-black" />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {!loading && filteredShops.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No shops found matching your search.
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#212121] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-[#FFCC00]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </button>
                  <span className="text-gray-400 text-xs">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasMore}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#212121] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-[#FFCC00]"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Map + Shop Details */}
            <div className="space-y-4">
              {/* Map */}
              <div className="h-[280px] rounded-lg overflow-hidden border border-gray-800">
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
                          <Popup autoPan={true} autoPanPadding={[50, 100]} keepInView={true}>
                            <div className="p-2">
                              <h4 className="font-semibold">{shop.name}</h4>
                              {shop.category && (
                                <p className="text-xs text-gray-500 mb-1">{shop.category}</p>
                              )}
                              <p className="text-sm text-gray-600">{shop.address}</p>
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

              {/* Shop Detail Panel */}
              {selectedShop ? (
                <div className="bg-[#212121] border border-gray-800 rounded-lg p-5">
                  {/* Shop Name + View Profile Link */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-white font-bold text-lg">{selectedShop.name}</h3>
                    <button
                      onClick={() => router.push(`/customer/shop/${selectedShop.shopId}`)}
                      className="flex items-center gap-1 text-gray-400 text-xs hover:text-[#FFCC00] transition-colors"
                    >
                      View Shop Profile
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Badges: Category, Tier, Verified */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {selectedShop.category && (
                      <span className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-xs rounded-full border border-gray-600">
                        {selectedShop.category}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getTierBadgeColor(selectedShop.tier)}`}>
                      {getTierLabel(selectedShop.tier).replace(" Shop", " Tier")}
                    </span>
                    {selectedShop.verified && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-600/20 text-green-500 text-xs rounded-full border border-green-600/30">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>

                  {/* Rating + Distance + Time */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <StarRating value={selectedShop.avgRating || 0} size="sm" showNumber showCount totalCount={selectedShop.totalReviews || 0} />
                    {selectedShop.distance !== undefined && (
                      <span className="flex items-center gap-1 text-gray-500 text-xs">
                        <MapPin className="w-3 h-3" />
                        {selectedShop.distance} miles
                      </span>
                    )}
                    {selectedShop.estimatedTime !== undefined && (
                      <span className="flex items-center gap-1 text-gray-500 text-xs">
                        <Clock className="w-3 h-3" />
                        ~ {selectedShop.estimatedTime} mins
                      </span>
                    )}
                  </div>

                  {/* Map location notice */}
                  {!selectedShop.location?.lat && !selectedShop.location?.lng && (
                    <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-gray-800/50 border border-gray-700">
                      <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-500 text-xs">Map location not available for this shop</span>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-gray-500 text-xs font-semibold block">Address</span>
                        <span className="text-gray-300 text-sm">{fullAddress(selectedShop)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {selectedShop.phone && (
                        <div className="flex items-start gap-2">
                          <Phone className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-500 text-xs font-semibold block">Phone</span>
                            <span className="text-gray-300 text-sm">{selectedShop.phone}</span>
                          </div>
                        </div>
                      )}
                      {selectedShop.website && (
                        <div className="flex items-start gap-2">
                          <Globe className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-500 text-xs font-semibold block">Website</span>
                            <a
                              href={selectedShop.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-300 text-sm hover:text-[#FFCC00] transition-colors"
                            >
                              {selectedShop.website.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Social Media */}
                  {(selectedShop.facebook || selectedShop.x || selectedShop.instagram || selectedShop.linkedin) && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Share2 className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-gray-500 text-xs font-semibold">Social Media</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedShop.facebook && (
                          <a href={selectedShop.facebook} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors">
                            <FaFacebook className="w-4 h-4 text-gray-300" />
                          </a>
                        )}
                        {selectedShop.instagram && (
                          <a href={selectedShop.instagram} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors">
                            <FaInstagram className="w-4 h-4 text-gray-300" />
                          </a>
                        )}
                        {selectedShop.linkedin && (
                          <a href={selectedShop.linkedin} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors">
                            <FaLinkedin className="w-4 h-4 text-gray-300" />
                          </a>
                        )}
                        {selectedShop.x && (
                          <a href={selectedShop.x} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors">
                            <FaXTwitter className="w-4 h-4 text-gray-300" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Services / Rewards Tabs */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex rounded-lg overflow-hidden mb-3">
                      <button
                        onClick={() => setActiveDetailTab("services")}
                        className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                          activeDetailTab === "services"
                            ? "bg-[#FFCC00] text-black"
                            : "bg-gray-800 text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        Services ({shopServices.length})
                      </button>
                      <button
                        onClick={() => setActiveDetailTab("rewards")}
                        className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                          activeDetailTab === "rewards"
                            ? "bg-[#FFCC00] text-black"
                            : "bg-gray-800 text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        Rewards
                      </button>
                    </div>

                    {activeDetailTab === "services" && (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {loadingServices ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FFCC00]"></div>
                            <span className="ml-2 text-gray-400 text-sm">Loading services...</span>
                          </div>
                        ) : shopServices.length > 0 ? (
                          [...shopServices]
                            .sort((a, b) => {
                              const rA = a.avgRating || 0;
                              const rB = b.avgRating || 0;
                              if (rB !== rA) return rB - rA;
                              return (b.reviewCount || 0) - (a.reviewCount || 0);
                            })
                            .map((service) => (
                            <div
                              key={service.serviceId}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                            >
                              {/* Service Image */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                                {service.imageUrl ? (
                                  <img
                                    src={service.imageUrl}
                                    alt={service.serviceName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Store className="w-5 h-5 text-gray-600" />
                                  </div>
                                )}
                              </div>
                              {/* Service Info */}
                              <div className="flex-1 min-w-0">
                                <h5 className="text-white text-sm font-medium truncate">
                                  {service.serviceName}
                                </h5>
                                <StarRating value={service.avgRating || 0} size="sm" showNumber showCount totalCount={service.reviewCount || 0} className="mt-0.5" />
                              </div>
                              {/* View Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewService(service.serviceId);
                                }}
                                className="text-[#FFCC00] text-xs font-semibold hover:underline flex-shrink-0"
                              >
                                View
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-gray-500 text-sm">
                            No services available yet.
                          </div>
                        )}
                      </div>
                    )}

                    {activeDetailTab === "rewards" && (
                      <div className="text-center py-6 text-gray-500 text-sm">
                        <p>RCN rewards information coming soon.</p>
                        <p className="text-xs mt-1 text-gray-600">
                          Earn tokens every time you book services at this shop.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#212121] border border-gray-800 rounded-lg p-8 text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                  <h3 className="text-gray-400 font-semibold mb-2">Select a Shop to View Details</h3>
                  <p className="text-gray-600 text-sm max-w-xs mx-auto">
                    Click on any shop from the list or map to see detailed information, services, and contact details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
