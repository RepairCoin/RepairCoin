import { useState, useEffect, useMemo, useRef } from "react";
import { Alert, Linking, Platform } from "react-native";
import MapView, { Region, LatLng } from "react-native-maps";
import { useShop } from "@/shared/hooks/shop/useShop";
import {
  getCurrentLocation,
  geocodeAddress,
  Coordinates,
} from "@/shared/services/geocoding.service";
import {
  fetchRoute,
  metersToMiles,
  milesToMeters,
  formatDuration,
} from "@/providers/RouteProvider";
import { WebViewMapRef } from "@/components/maps/WebViewMap";
import { ShopData } from "@/interfaces/shop.interface";
import { ViewMode, ShopWithLocation, GeocodedCoords } from "../../types";
import {
  DEFAULT_RADIUS_MILES,
  MIN_RADIUS_MILES,
  MAX_RADIUS_MILES,
  DEFAULT_LAT_DELTA,
  DEFAULT_LNG_DELTA,
  ZOOM_LAT_DELTA,
  ZOOM_LNG_DELTA,
} from "../../constants";
import { calculateDistance, buildFullAddress } from "../../utils";

export function useFindShop() {
  const { useGetShops } = useShop();
  const { data: shops, isLoading } = useGetShops();
  const mapRef = useRef<MapView>(null);
  const webViewMapRef = useRef<WebViewMapRef>(null);
  const isAndroid = Platform.OS === "android";

  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShop, setSelectedShop] = useState<ShopWithLocation | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [initialMapRegion, setInitialMapRegion] = useState<Region | null>(null);
  const [geocodedShops, setGeocodedShops] = useState<Record<string, GeocodedCoords>>({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isDirectionsPanelMinimized, setIsDirectionsPanelMinimized] = useState(false);
  const [isShopPopupMinimized, setIsShopPopupMinimized] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);

  // Request location permission and get user's location
  useEffect(() => {
    (async () => {
      try {
        const location = await getCurrentLocation();
        if (location) {
          setUserLocation(location);
          setInitialMapRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: DEFAULT_LAT_DELTA,
            longitudeDelta: DEFAULT_LNG_DELTA,
          });
        }
      } catch (error) {
        console.log("Error getting location:", error);
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  // Process shops with location data and distances
  const shopsWithLocation = useMemo(() => {
    if (!shops?.shops) return [];

    return shops.shops
      .map((shop: ShopData) => {
        const shopLocation = shop.location;
        const geocoded = geocodedShops[shop.shopId];

        let lat = shopLocation?.lat ? parseFloat(shopLocation.lat) : undefined;
        let lng = shopLocation?.lng ? parseFloat(shopLocation.lng) : undefined;

        if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && geocoded) {
          lat = geocoded.lat;
          lng = geocoded.lng;
        }

        const hasValidLocation = !!(lat && lng && !isNaN(lat) && !isNaN(lng));

        let distance: number | undefined;
        if (userLocation && hasValidLocation && lat && lng) {
          distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            lat,
            lng
          );
        }

        return {
          ...shop,
          lat,
          lng,
          distance,
          hasValidLocation,
        } as ShopWithLocation;
      })
      .sort((a: ShopWithLocation, b: ShopWithLocation) => {
        if (a.hasValidLocation && !b.hasValidLocation) return -1;
        if (!a.hasValidLocation && b.hasValidLocation) return 1;
        if (a.distance && b.distance) return a.distance - b.distance;
        return 0;
      });
  }, [shops, userLocation, geocodedShops]);

  // Filter shops based on search query
  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) return shopsWithLocation;

    const query = searchQuery.toLowerCase();
    return shopsWithLocation.filter(
      (shop: ShopWithLocation) =>
        shop.name?.toLowerCase().includes(query) ||
        shop.address?.toLowerCase().includes(query)
    );
  }, [shopsWithLocation, searchQuery]);

  // Center map on first shop with valid location if user location is not available
  useEffect(() => {
    if (!locationLoading && !initialMapRegion && shopsWithLocation.length > 0) {
      const firstShopWithLocation = shopsWithLocation.find(
        (shop: ShopWithLocation) => shop.hasValidLocation
      );
      if (firstShopWithLocation?.lat && firstShopWithLocation?.lng) {
        setInitialMapRegion({
          latitude: firstShopWithLocation.lat,
          longitude: firstShopWithLocation.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    }
  }, [locationLoading, initialMapRegion, shopsWithLocation]);

  // Animate to pending region when map is ready
  useEffect(() => {
    if (pendingRegion && viewMode === "map") {
      const timer = setTimeout(() => {
        if (isAndroid && webViewMapRef.current) {
          webViewMapRef.current.animateToRegion(pendingRegion, 300);
        } else if (mapRef.current) {
          mapRef.current.animateToRegion(pendingRegion, 300);
        }
        setPendingRegion(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pendingRegion, viewMode, isAndroid]);

  const handleMarkerPress = (shop: ShopWithLocation) => {
    setSelectedShop(shop);
    setIsShopPopupMinimized(false);
    if (shop.lat && shop.lng) {
      const region = {
        latitude: shop.lat,
        longitude: shop.lng,
        latitudeDelta: ZOOM_LAT_DELTA,
        longitudeDelta: ZOOM_LNG_DELTA,
      };
      if (isAndroid && webViewMapRef.current) {
        webViewMapRef.current.animateToRegion(region, 300);
      } else if (mapRef.current) {
        mapRef.current.animateToRegion(region, 300);
      }
    }
  };

  const handleWebViewMarkerPress = (markerId: string) => {
    const shop = filteredShops.find((s: ShopWithLocation) => s.shopId === markerId);
    if (shop) {
      handleMarkerPress(shop);
    }
  };

  const centerOnUserLocation = () => {
    if (initialMapRegion) {
      if (isAndroid && webViewMapRef.current) {
        webViewMapRef.current.animateToRegion(initialMapRegion, 300);
      } else if (mapRef.current) {
        mapRef.current.animateToRegion(initialMapRegion, 300);
      }
    }
  };

  const navigateToShopOnMap = (lat: number, lng: number, shop: ShopWithLocation) => {
    const region: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: ZOOM_LAT_DELTA,
      longitudeDelta: ZOOM_LNG_DELTA,
    };

    setSelectedShop(shop);
    setIsShopPopupMinimized(false);

    if (viewMode === "map") {
      if (isAndroid && webViewMapRef.current) {
        webViewMapRef.current.animateToRegion(region, 300);
      } else if (mapRef.current) {
        mapRef.current.animateToRegion(region, 300);
      }
    } else {
      setPendingRegion(region);
      setViewMode("map");
    }
  };

  const handleShopCardPress = async (item: ShopWithLocation) => {
    if (item.hasValidLocation && item.lat && item.lng) {
      navigateToShopOnMap(item.lat, item.lng, item);
      return;
    }

    if (!item.address) {
      Alert.alert(
        "Location Unavailable",
        (item.name || "This shop") + " doesn't have an address to locate.",
        [{ text: "OK" }]
      );
      return;
    }

    if (geocodedShops[item.shopId]) {
      const coords = geocodedShops[item.shopId];
      const updatedShop = { ...item, lat: coords.lat, lng: coords.lng, hasValidLocation: true };
      navigateToShopOnMap(coords.lat, coords.lng, updatedShop);
      return;
    }

    const fullAddress = buildFullAddress(
      item.address,
      item.location?.city,
      item.location?.state
    );

    setIsGeocoding(true);
    const coords = await geocodeAddress(fullAddress);
    setIsGeocoding(false);

    if (coords) {
      const cachedCoords = { lat: coords.latitude, lng: coords.longitude };
      setGeocodedShops((prev) => ({
        ...prev,
        [item.shopId]: cachedCoords,
      }));

      const updatedShop = { ...item, lat: cachedCoords.lat, lng: cachedCoords.lng, hasValidLocation: true };
      navigateToShopOnMap(cachedCoords.lat, cachedCoords.lng, updatedShop);
    } else {
      Alert.alert(
        "Location Not Found",
        "Could not find the location for " + (item.name || "this shop") + ". The address \"" + fullAddress + "\" may be incomplete or invalid.",
        [{ text: "OK" }]
      );
    }
  };

  const openDirections = async (shop: ShopWithLocation) => {
    if (!shop.lat || !shop.lng) {
      Alert.alert("Location Unavailable", "Cannot get directions without coordinates.");
      return;
    }

    if (!userLocation) {
      Alert.alert("Location Unavailable", "Your location is not available. Please enable location services.");
      return;
    }

    setShowDirections(true);
    setIsLoadingRoute(true);
    setRouteCoordinates([]);

    const coordinates = [
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: shop.lat, longitude: shop.lng },
    ];
    const edgePadding = { top: 100, right: 50, bottom: 300, left: 50 };

    if (isAndroid && webViewMapRef.current) {
      webViewMapRef.current.fitToCoordinates(coordinates, { edgePadding, animated: true });
    } else if (mapRef.current) {
      mapRef.current.fitToCoordinates(coordinates, { edgePadding, animated: true });
    }

    const route = await fetchRoute(
      userLocation.latitude,
      userLocation.longitude,
      shop.lat,
      shop.lng
    );

    setIsLoadingRoute(false);

    if (route) {
      setRouteCoordinates(route.coordinates);
      setRouteDistance(route.distance);
      setRouteDuration(route.duration);
    } else {
      setRouteCoordinates([
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: shop.lat, longitude: shop.lng },
      ]);
      setRouteDistance(null);
      setRouteDuration(null);
    }
  };

  const closeDirections = () => {
    setShowDirections(false);
    setRouteCoordinates([]);
    setRouteDistance(null);
    setRouteDuration(null);
    setIsDirectionsPanelMinimized(false);
  };

  const openPhoneDialer = (shop: ShopWithLocation) => {
    const phoneNumber = shop.phone;
    if (!phoneNumber) {
      Alert.alert("Phone Unavailable", "This shop doesn't have a phone number listed.");
      return;
    }

    const url = "tel:" + phoneNumber;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("Cannot Make Call", "Your device doesn't support phone calls.");
      }
    });
  };

  const increaseRadius = () => {
    setRadiusMiles(Math.min(MAX_RADIUS_MILES, radiusMiles + 1));
  };

  const decreaseRadius = () => {
    setRadiusMiles(Math.max(MIN_RADIUS_MILES, radiusMiles - 1));
  };

  const clearSelectedShop = () => {
    setSelectedShop(null);
    setIsShopPopupMinimized(false);
  };

  const shopsInRadius = filteredShops.filter(
    (s: ShopWithLocation) =>
      s.hasValidLocation && s.distance !== undefined && s.distance <= radiusMiles
  ).length;

  return {
    // Refs
    mapRef,
    webViewMapRef,
    isAndroid,
    // Data
    isLoading,
    locationLoading,
    filteredShops,
    shopsInRadius,
    // State
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    selectedShop,
    setSelectedShop,
    userLocation,
    initialMapRegion,
    isGeocoding,
    showDirections,
    routeCoordinates,
    isLoadingRoute,
    routeDistance,
    routeDuration,
    isDirectionsPanelMinimized,
    setIsDirectionsPanelMinimized,
    isShopPopupMinimized,
    setIsShopPopupMinimized,
    radiusMiles,
    // Handlers
    handleMarkerPress,
    handleWebViewMarkerPress,
    handleShopCardPress,
    centerOnUserLocation,
    openDirections,
    closeDirections,
    openPhoneDialer,
    increaseRadius,
    decreaseRadius,
    clearSelectedShop,
    // Utils
    milesToMeters,
    metersToMiles,
    formatDuration,
  };
}
