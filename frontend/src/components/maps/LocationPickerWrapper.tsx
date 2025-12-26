"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import LocationPicker with no SSR to avoid hydration issues
const LocationPicker = dynamic(() => import("./LocationPicker").then(mod => ({ default: mod.LocationPicker })), {
  ssr: false,
  loading: () => (
    <div className="w-full">
      <div
        className="flex items-center justify-center bg-[#F6F8FA] rounded-lg border border-[#3F3F3F]"
        style={{ height: "350px" }}
      >
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading map...</span>
        </div>
      </div>
    </div>
  ),
});

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

interface LocationPickerWrapperProps {
  initialLocation?: LocationData;
  onLocationSelect: (location: LocationData) => void;
  className?: string;
  height?: string;
  version?: 'UPDATES2'
}

export const LocationPickerWrapper: React.FC<LocationPickerWrapperProps> = (props) => {
  return <LocationPicker {...props} />;
};

export default LocationPickerWrapper;