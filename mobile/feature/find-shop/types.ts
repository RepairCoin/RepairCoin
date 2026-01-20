import { ShopData } from "@/interfaces/shop.interface";
import { Region, LatLng } from "react-native-maps";

export type ViewMode = "map" | "list";

export interface ShopWithLocation extends ShopData {
  lat?: number;
  lng?: number;
  distance?: number;
  hasValidLocation: boolean;
}

export interface RouteInfo {
  coordinates: LatLng[];
  distance: number | null;
  duration: number | null;
}

export interface GeocodedCoords {
  lat: number;
  lng: number;
}

export interface FindShopState {
  viewMode: ViewMode;
  searchQuery: string;
  selectedShop: ShopWithLocation | null;
  userLocation: { latitude: number; longitude: number } | null;
  locationLoading: boolean;
  initialMapRegion: Region | null;
  geocodedShops: Record<string, GeocodedCoords>;
  isGeocoding: boolean;
  pendingRegion: Region | null;
  showDirections: boolean;
  routeCoordinates: LatLng[];
  isLoadingRoute: boolean;
  routeDistance: number | null;
  routeDuration: number | null;
  isDirectionsPanelMinimized: boolean;
  isShopPopupMinimized: boolean;
  radiusMiles: number;
}
