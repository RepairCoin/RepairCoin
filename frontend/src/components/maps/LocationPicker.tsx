"use client";

import React, { useState, useRef, useEffect } from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { Icon, LatLng, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in react-leaflet (only on client side)
if (typeof window !== "undefined") {
  delete (Icon.Default.prototype as any)._getIconUrl;
  Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

interface LocationPickerProps {
  initialLocation?: LocationData;
  onLocationSelect: (location: LocationData) => void;
  className?: string;
  height?: string;
}

// Component to handle map clicks and marker placement
function MapClickHandler({ 
  onLocationSelect, 
  markerPosition, 
  setMarkerPosition 
}: {
  onLocationSelect: (location: LocationData) => void;
  markerPosition: LatLng | null;
  setMarkerPosition: (position: LatLng | null) => void;
}) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setMarkerPosition(e.latlng);
      
      // Try to get address from coordinates using reverse geocoding
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await response.json();
        
        onLocationSelect({
          latitude: lat,
          longitude: lng,
          address: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
      } catch (error) {
        console.error("Error getting address:", error);
        onLocationSelect({
          latitude: lat,
          longitude: lng,
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
      }
    },
  });

  return markerPosition ? <Marker position={markerPosition} /> : null;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLocation,
  onLocationSelect,
  className = "",
  height = "400px"
}) => {
  const [isClient, setIsClient] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<LatLng | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [center, setCenter] = useState<[number, number]>(
    initialLocation 
      ? [initialLocation.latitude, initialLocation.longitude]
      : [14.5995, 120.9842] // Default to Manila, Philippines
  );
  const mapRef = useRef<LeafletMap>(null);

  // Ensure component only renders on client side
  useEffect(() => {
    setIsClient(true);
    
    // Initialize marker position after client-side hydration
    if (initialLocation && typeof window !== "undefined") {
      setMarkerPosition(new LatLng(initialLocation.latitude, initialLocation.longitude));
    }
  }, [initialLocation]);

  // Handle search for addresses
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const newPosition = new LatLng(lat, lng);
        
        setMarkerPosition(newPosition);
        setCenter([lat, lng]);
        
        // Fly to the new location
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lng], 15);
        }
        
        onLocationSelect({
          latitude: lat,
          longitude: lng,
          address: result.display_name
        });
      }
    } catch (error) {
      console.error("Error searching for address:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Enter key for search
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Get user's current location
  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPosition = new LatLng(latitude, longitude);
          
          setMarkerPosition(newPosition);
          setCenter([latitude, longitude]);
          
          if (mapRef.current) {
            mapRef.current.flyTo([latitude, longitude], 15);
          }
          
          // Get address for current location
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(response => response.json())
            .then(data => {
              onLocationSelect({
                latitude,
                longitude,
                address: data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              });
            })
            .catch(() => {
              onLocationSelect({
                latitude,
                longitude,
                address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              });
            });
        },
        (error) => {
          console.error("Error getting current location:", error);
        }
      );
    }
  };

  // Show loading state during SSR or before client hydration
  if (!isClient) {
    return (
      <div className={`w-full ${className}`}>
        <div 
          className="flex items-center justify-center bg-[#2F2F2F] rounded-lg border border-gray-300"
          style={{ height }}
        >
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading map...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Search and controls */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Search for an address..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>
        
        <button
          onClick={getCurrentLocation}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          Use Current Location
        </button>
      </div>

      {/* Map container */}
      <div 
        className="relative rounded-lg overflow-hidden border border-gray-300"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler 
            onLocationSelect={onLocationSelect}
            markerPosition={markerPosition}
            setMarkerPosition={setMarkerPosition}
          />
        </MapContainer>
        
        {/* Instructions overlay */}
        <div className="absolute top-3 left-3 bg-black bg-opacity-75 text-white text-xs px-3 py-2 rounded-lg">
          Click on the map to select a location
        </div>
      </div>

      {/* Current selection info */}
      {markerPosition && (
        <div className="mt-3 p-3 bg-[#2F2F2F] rounded-lg">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-[#FFCC00] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <div className="font-medium">Selected Location:</div>
              <div className="text-xs text-gray-400 mt-1">
                Latitude: {markerPosition.lat.toFixed(6)}, Longitude: {markerPosition.lng.toFixed(6)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};