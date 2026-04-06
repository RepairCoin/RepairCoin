"use client";

/**
 * Custom shop marker icon factory for Leaflet maps.
 * Icons are cached to avoid recreating DivIcons on every render.
 * Reusable across ShopMapView and FindShopMap.
 */

const L = typeof window !== "undefined" ? require("leaflet") : null;

// Cache icons — only 2 variants needed (selected / not selected)
let cachedDefault: any = null;
let cachedSelected: any = null;
let cachedUserLocation: any = null;

export function createShopIcon(isSelected: boolean) {
  if (!L) return undefined;

  if (isSelected) {
    if (!cachedSelected) {
      cachedSelected = L.divIcon({
        className: "custom-shop-marker",
        html: `<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#FFCC00;border:2px solid #FFCC00;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;transform:scale(1.15);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
      });
    }
    return cachedSelected;
  }

  if (!cachedDefault) {
    cachedDefault = L.divIcon({
      className: "custom-shop-marker",
      html: `<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#18181b;border:2px solid #FFCC00;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFCC00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });
  }
  return cachedDefault;
}

export function createUserLocationIcon() {
  if (!L) return undefined;

  if (!cachedUserLocation) {
    cachedUserLocation = L.divIcon({
      className: "user-location-marker",
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#4299e1;border:3px solid white;box-shadow:0 0 8px rgba(66,153,225,0.6);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });
  }
  return cachedUserLocation;
}
