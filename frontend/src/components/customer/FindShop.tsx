"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, Phone, Mail, Globe, Star } from "lucide-react";
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
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// Fix for default marker icons in Leaflet
const L = typeof window !== "undefined" ? require("leaflet") : null;
if (L) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
}

// Create a separate component for map view control that will be imported dynamically
const MapViewController = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { useMap } = mod;
      return function MapViewComponent({ center, zoom }: { center: [number, number]; zoom: number }) {
        const map = useMap();
        
        useEffect(() => {
          if (map && center && zoom) {
            map.flyTo(center, zoom, {
              animate: true,
              duration: 1
            });
          }
        }, [map, center, zoom]);
        
        return null;
      };
    }),
  { ssr: false }
);

interface Shop {
  shop_id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  location_lat: number;
  location_lng: number;
  location_city: string;
  location_state: string;
  location_zip_code: string;
  verified: boolean;
  active: boolean;
  cross_shop_enabled: boolean;
  rating?: number;
  distance?: string;
}

// Dummy data for testing
const DUMMY_SHOPS: Shop[] = [
  {
    shop_id: "SHOP001",
    name: "Quick Fix Auto Repair",
    address: "123 Main Street",
    phone: "(555) 123-4567",
    email: "info@quickfixauto.com",
    location_lat: 40.7128,
    location_lng: -74.0060,
    location_city: "New York",
    location_state: "NY",
    location_zip_code: "10001",
    verified: true,
    active: true,
    cross_shop_enabled: true,
    rating: 4.8,
    distance: "0.5 mi",
  },
  {
    shop_id: "SHOP002",
    name: "Elite Car Care Center",
    address: "456 Broadway Avenue",
    phone: "(555) 234-5678",
    email: "service@elitecarcare.com",
    location_lat: 40.7260,
    location_lng: -73.9897,
    location_city: "New York",
    location_state: "NY",
    location_zip_code: "10003",
    verified: true,
    active: true,
    cross_shop_enabled: true,
    rating: 4.6,
    distance: "1.2 mi",
  },
  {
    shop_id: "SHOP003",
    name: "Precision Auto Works",
    address: "789 Park Plaza",
    phone: "(555) 345-6789",
    email: "contact@precisionauto.com",
    location_lat: 40.7489,
    location_lng: -73.9680,
    location_city: "New York",
    location_state: "NY",
    location_zip_code: "10016",
    verified: true,
    active: true,
    cross_shop_enabled: false,
    rating: 4.9,
    distance: "2.0 mi",
  },
  {
    shop_id: "SHOP004",
    name: "Downtown Motor Service",
    address: "321 Liberty Street",
    phone: "(555) 456-7890",
    email: "help@downtownmotor.com",
    location_lat: 40.7074,
    location_lng: -74.0113,
    location_city: "New York",
    location_state: "NY",
    location_zip_code: "10006",
    verified: true,
    active: true,
    cross_shop_enabled: true,
    rating: 4.5,
    distance: "0.8 mi",
  },
  {
    shop_id: "SHOP005",
    name: "Green Auto Solutions",
    address: "555 Eco Drive",
    phone: "(555) 567-8901",
    email: "info@greenauto.com",
    location_lat: 40.7614,
    location_lng: -73.9776,
    location_city: "New York",
    location_state: "NY",
    location_zip_code: "10019",
    verified: true,
    active: false,
    cross_shop_enabled: false,
    rating: 4.7,
    distance: "3.5 mi",
  },
];

export function FindShop() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [filteredShops, setFilteredShops] = useState<Shop[]>(DUMMY_SHOPS);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.0060]);
  const [mapZoom, setMapZoom] = useState(12);

  useEffect(() => {
    // Filter shops based on search query
    if (searchQuery.trim() === "") {
      setFilteredShops(DUMMY_SHOPS);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = DUMMY_SHOPS.filter(
        (shop) =>
          shop.name.toLowerCase().includes(query) ||
          shop.address.toLowerCase().includes(query) ||
          shop.location_city.toLowerCase().includes(query) ||
          shop.shop_id.toLowerCase().includes(query)
      );
      setFilteredShops(filtered);
    }
  }, [searchQuery]);

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
    setMapCenter([shop.location_lat, shop.location_lng]);
    setMapZoom(16); // Increased zoom for better focus on the shop
  };

  const handleMarkerClick = (shop: Shop) => {
    setSelectedShop(shop);
    setMapCenter([shop.location_lat, shop.location_lng]);
    setMapZoom(16); // Also zoom when clicking on marker
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center mb-6">
        <MapPin className="w-8 h-8 text-blue-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">Find Repair Shops</h2>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by shop name, address, city, or shop ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shop List */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Available Shops ({filteredShops.filter(s => s.active).length})
          </h3>
          {filteredShops.map((shop) => (
            <div
              key={shop.shop_id}
              onClick={() => handleShopSelect(shop)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedShop?.shop_id === shop.shop_id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-md"
              } ${!shop.active ? "opacity-60" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{shop.name}</h4>
                  <p className="text-sm text-gray-500">{shop.shop_id}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {shop.verified && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      Verified
                    </span>
                  )}
                  {!shop.active && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-1">
                <MapPin className="inline w-4 h-4 mr-1" />
                {shop.address}, {shop.location_city}, {shop.location_state} {shop.location_zip_code}
              </p>
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center space-x-3 text-sm">
                  {shop.rating && (
                    <span className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-500 mr-1 fill-current" />
                      {shop.rating}
                    </span>
                  )}
                  {shop.distance && (
                    <span className="text-gray-500">{shop.distance}</span>
                  )}
                </div>
                {shop.cross_shop_enabled && (
                  <span className="text-xs text-blue-600 font-medium">
                    Cross-Shop ✓
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredShops.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No shops found matching your search.
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="relative">
          <div className="h-[600px] rounded-lg overflow-hidden border border-gray-200">
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
                {filteredShops.map((shop) => (
                  <Marker
                    key={shop.shop_id}
                    position={[shop.location_lat, shop.location_lng]}
                    eventHandlers={{
                      click: () => handleMarkerClick(shop),
                    }}
                  >
                    <Popup>
                      <div className="p-2">
                        <h4 className="font-semibold">{shop.name}</h4>
                        <p className="text-sm text-gray-600">{shop.address}</p>
                        <p className="text-sm text-gray-600">
                          {shop.location_city}, {shop.location_state} {shop.location_zip_code}
                        </p>
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
        </div>
      </div>

      {/* Selected Shop Details */}
      {selectedShop && (
        <div className="mt-6 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Shop Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-800">{selectedShop.name}</h4>
              <p className="text-sm text-gray-500 mb-3">{selectedShop.shop_id}</p>
              
              <div className="space-y-2">
                <p className="text-sm flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  {selectedShop.address}
                  <br />
                  <span className="ml-6">
                    {selectedShop.location_city}, {selectedShop.location_state} {selectedShop.location_zip_code}
                  </span>
                </p>
                
                {selectedShop.phone && (
                  <p className="text-sm flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    {selectedShop.phone}
                  </p>
                )}
                
                {selectedShop.email && (
                  <p className="text-sm flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    {selectedShop.email}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col justify-between">
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedShop.verified && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    ✓ Verified Shop
                  </span>
                )}
                {selectedShop.active ? (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    Active
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                    Inactive
                  </span>
                )}
                {selectedShop.cross_shop_enabled && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                    Cross-Shop Network
                  </span>
                )}
              </div>
              
              {selectedShop.rating && (
                <div className="flex items-center">
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  <span className="ml-1 font-semibold">{selectedShop.rating}</span>
                  <span className="ml-2 text-gray-500 text-sm">Customer Rating</span>
                </div>
              )}
              
              <button
                className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => console.log("Navigate to shop:", selectedShop.shop_id)}
              >
                Visit This Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}