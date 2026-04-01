/**
 * Core hook for shop map features.
 * Shared between Services Map (ShopMapView) and Find Shop (FindShopMap).
 * Ported from: mobile/feature/find-shop/hooks/ui/useFindShop.ts
 *
 * Usage:
 *   Services Map:  useShopMap({ autoDetectLocation: false })
 *   Find Shop:     useShopMap({ autoDetectLocation: true, defaultRadius: 5 })
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ShopMapData, getShopsForMap } from '@/services/api/shop';
import { haversineDistance, RADIUS_STEPS, MAP_DEFAULTS } from '@/utils/distance';
import { fetchRoute, RouteResult } from '@/utils/route';

export interface ShopWithDistance extends ShopMapData {
  distance: number; // miles from user
}

export interface UseShopMapOptions {
  /** Auto-request browser geolocation on mount (default: false) */
  autoDetectLocation?: boolean;
  /** Default search radius in miles (default: 1) */
  defaultRadius?: number;
}

export function useShopMap(options: UseShopMapOptions = {}) {
  const { autoDetectLocation = false, defaultRadius = MAP_DEFAULTS.radius } = options;

  // ── Shop data ──────────────────────────────────────────────
  const [shops, setShops] = useState<ShopMapData[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);

  // ── Location state ─────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  // hasLocation is derived from userLocation — no separate state to get out of sync
  const [mapCenter, setMapCenter] = useState<[number, number]>([MAP_DEFAULTS.lat, MAP_DEFAULTS.lng]);
  const [mapZoom, setMapZoom] = useState(MAP_DEFAULTS.zoom);
  const [requestingLocation, setRequestingLocation] = useState(false);

  // ── Radius state ───────────────────────────────────────────
  const [radiusMiles, setRadiusMiles] = useState(defaultRadius);

  // ── Selection & filter state ───────────────────────────────
  const [selectedShop, setSelectedShop] = useState<ShopMapData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Directions state ───────────────────────────────────────
  const [showDirections, setShowDirections] = useState(false);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // ── Derived state ───────────────────────────────────────────
  const hasLocation = userLocation !== null;

  // ── Fetch shops on mount ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getShopsForMap();
        if (!cancelled) {
          setShops(data);
          // If no auto-detect and shops exist, center on first shop
          if (!autoDetectLocation && data.length > 0) {
            setMapCenter([data[0].location.lat, data[0].location.lng]);
            setMapZoom(10);
          }
        }
      } catch (err) {
        console.error('Failed to load shops for map:', err);
      } finally {
        if (!cancelled) setShopsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [autoDetectLocation]);

  // ── Auto-detect location on mount (if enabled) ────────────
  useEffect(() => {
    if (!autoDetectLocation) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    setRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        setMapCenter(loc);
        setMapZoom(14);

        setRequestingLocation(false);
      },
      () => {
        setRequestingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [autoDetectLocation]);

  // ── Request location (manual trigger) ──────────────────────
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    setRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        setMapCenter(loc);
        setMapZoom(14);

        setSearchQuery('');
        setSelectedCategory(null);
        setRequestingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        setRequestingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Radius controls ────────────────────────────────────────
  const increaseRadius = useCallback(() => {
    const idx = RADIUS_STEPS.indexOf(radiusMiles as typeof RADIUS_STEPS[number]);
    if (idx >= 0 && idx < RADIUS_STEPS.length - 1) {
      setRadiusMiles(RADIUS_STEPS[idx + 1]);
    } else if (idx < 0) {
      // Find next step above current value
      const next = RADIUS_STEPS.find(s => s > radiusMiles);
      if (next) setRadiusMiles(next);
    }
  }, [radiusMiles]);

  const decreaseRadius = useCallback(() => {
    const idx = RADIUS_STEPS.indexOf(radiusMiles as typeof RADIUS_STEPS[number]);
    if (idx > 0) {
      setRadiusMiles(RADIUS_STEPS[idx - 1]);
    } else if (idx < 0) {
      // Find previous step below current value
      const prev = [...RADIUS_STEPS].reverse().find(s => s < radiusMiles);
      if (prev) setRadiusMiles(prev);
    }
  }, [radiusMiles]);

  // ── Extract unique service categories from all shops ────────
  const shopCategories = useMemo(() => {
    const cats = new Set<string>();
    shops.forEach(shop => {
      shop.serviceCategories?.forEach(cat => cats.add(cat));
    });
    return Array.from(cats).sort();
  }, [shops]);

  // ── Shops with distance (single source of truth) ────────────
  // Computed once from shops + userLocation. All downstream lists derive from this.
  const shopsWithDistance = useMemo((): ShopWithDistance[] => {
    return shops.map(shop => ({
      ...shop,
      distance: userLocation
        ? haversineDistance(userLocation[0], userLocation[1], shop.location.lat, shop.location.lng)
        : Infinity,
    }));
  }, [shops, userLocation]);

  // ── Nearby shops (within radius, sorted by distance) ───────
  const nearbyShops = useMemo((): ShopWithDistance[] => {
    if (!userLocation) return [];
    const sorted = [...shopsWithDistance].sort((a, b) => a.distance - b.distance);
    const withinRadius = sorted.filter(shop => shop.distance <= radiusMiles);

    // If no shops within radius, show nearest 5 as suggestions
    if (withinRadius.length === 0 && sorted.length > 0) {
      return sorted.slice(0, 5);
    }
    return withinRadius;
  }, [shopsWithDistance, userLocation, radiusMiles]);

  // Whether nearby list is showing exact radius matches or nearest suggestions
  const isShowingNearest = useMemo(() => {
    if (!userLocation) return false;
    const withinRadius = shopsWithDistance.filter(s => s.distance <= radiusMiles);
    return withinRadius.length === 0 && nearbyShops.length > 0;
  }, [shopsWithDistance, userLocation, radiusMiles, nearbyShops]);

  // ── Displayed shops (what the sidebar list shows) ──────────
  // With location: nearby shops (radius-filtered, or nearest if none in radius).
  // Without location: all shops.
  // Search and category filters apply on top.
  const displayedShops = useMemo((): ShopWithDistance[] | ShopMapData[] => {
    let result: (ShopWithDistance | ShopMapData)[] = userLocation ? nearbyShops : shops;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(shop =>
        shop.name?.toLowerCase().includes(q) ||
        shop.address?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      result = result.filter(shop =>
        shop.serviceCategories?.includes(selectedCategory)
      );
    }

    return result;
  }, [shops, nearbyShops, userLocation, searchQuery, selectedCategory]);

  // ── Directions ─────────────────────────────────────────────
  const openDirections = useCallback(async (shop: ShopMapData) => {
    if (!userLocation || !shop.location) return;

    setIsLoadingRoute(true);
    setShowDirections(true);

    const result = await fetchRoute(
      userLocation[0], userLocation[1],
      shop.location.lat, shop.location.lng
    );

    setRouteData(result);
    setIsLoadingRoute(false);
  }, [userLocation]);

  const closeDirections = useCallback(() => {
    setShowDirections(false);
    setRouteData(null);
    setIsLoadingRoute(false);
  }, []);

  // ── Clear selection ────────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelectedShop(null);
    closeDirections();
  }, [closeDirections]);

  return {
    // Shop data
    shops,
    shopsLoading,
    nearbyShops,
    displayedShops,
    shopCategories,
    isShowingNearest,

    // Location
    userLocation,
    hasLocation,
    mapCenter,
    mapZoom,
    requestingLocation,
    setMapCenter,
    setMapZoom,
    requestLocation,

    // Radius
    radiusMiles,
    increaseRadius,
    decreaseRadius,

    // Selection & filters
    selectedShop,
    setSelectedShop,
    clearSelection,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,

    // Directions
    showDirections,
    routeData,
    isLoadingRoute,
    openDirections,
    closeDirections,
  };
}
