import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { LatLng } from "react-native-maps";

export interface WebViewMapRef {
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (
    coordinates: LatLng[],
    options?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean }
  ) => void;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MarkerData {
  id: string;
  coordinate: LatLng;
  title?: string;
  description?: string;
  isSelected?: boolean;
}

export interface CircleData {
  center: LatLng;
  radius: number; // in meters
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
}

export interface PolylineData {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
}

export interface DraggableMarker {
  coordinate: LatLng;
  onDragEnd?: (coordinate: LatLng) => void;
}

interface WebViewMapProps {
  initialRegion?: Region;
  showsUserLocation?: boolean;
  userLocation?: LatLng | null;
  markers?: MarkerData[];
  circles?: CircleData[];
  polylines?: PolylineData[];
  onMarkerPress?: (markerId: string) => void;
  onMapPress?: (coordinate?: LatLng) => void;
  draggableMarker?: DraggableMarker;
  style?: object;
}

const WebViewMap = forwardRef<WebViewMapRef, WebViewMapProps>(
  (
    {
      initialRegion,
      showsUserLocation = false,
      userLocation,
      markers = [],
      circles = [],
      polylines = [],
      onMarkerPress,
      onMapPress,
      draggableMarker,
      style,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region, duration = 300) => {
        if (!isMapReady) return;
        webViewRef.current?.injectJavaScript(`
          if (typeof map !== 'undefined') {
            map.flyTo([${region.latitude}, ${region.longitude}], getZoomFromDelta(${region.latitudeDelta}), { duration: ${duration / 1000} });
          }
          true;
        `);
      },
      fitToCoordinates: (coordinates: LatLng[], options) => {
        if (!isMapReady || coordinates.length === 0) return;
        const bounds = coordinates.map((c) => `[${c.latitude}, ${c.longitude}]`).join(",");
        const padding = options?.edgePadding || { top: 50, right: 50, bottom: 50, left: 50 };
        webViewRef.current?.injectJavaScript(`
          if (typeof map !== 'undefined') {
            map.fitBounds([${bounds}], { padding: [${padding.top}, ${padding.left}] });
          }
          true;
        `);
      },
    }));

    // Update markers when they change
    useEffect(() => {
      if (!isMapReady || !webViewRef.current) return;
      const markersJson = JSON.stringify(markers);
      webViewRef.current.injectJavaScript(`
        if (typeof updateMarkers !== 'undefined') {
          updateMarkers(${markersJson});
        }
        true;
      `);
    }, [markers, isMapReady]);

    // Update circles when they change
    useEffect(() => {
      if (!isMapReady || !webViewRef.current) return;
      const circlesJson = JSON.stringify(circles);
      webViewRef.current.injectJavaScript(`
        if (typeof updateCircles !== 'undefined') {
          updateCircles(${circlesJson});
        }
        true;
      `);
    }, [circles, isMapReady]);

    // Update polylines when they change
    useEffect(() => {
      if (!isMapReady || !webViewRef.current) return;
      const polylinesJson = JSON.stringify(polylines);
      webViewRef.current.injectJavaScript(`
        if (typeof updatePolylines !== 'undefined') {
          updatePolylines(${polylinesJson});
        }
        true;
      `);
    }, [polylines, isMapReady]);

    // Update user location when it changes
    useEffect(() => {
      if (!isMapReady || !webViewRef.current || !showsUserLocation || !userLocation) return;
      webViewRef.current.injectJavaScript(`
        if (typeof updateUserLocation !== 'undefined') {
          updateUserLocation(${userLocation.latitude}, ${userLocation.longitude});
        }
        true;
      `);
    }, [userLocation, showsUserLocation, isMapReady]);

    // Update draggable marker when coordinate changes
    useEffect(() => {
      if (!isMapReady || !webViewRef.current || !draggableMarker) return;
      webViewRef.current.injectJavaScript(`
        if (typeof updateDraggableMarker !== 'undefined') {
          updateDraggableMarker(${draggableMarker.coordinate.latitude}, ${draggableMarker.coordinate.longitude});
        }
        true;
      `);
    }, [draggableMarker?.coordinate.latitude, draggableMarker?.coordinate.longitude, isMapReady]);

    // Handle messages from WebView
    const handleMessage = (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "markerPress" && onMarkerPress) {
          onMarkerPress(data.markerId);
        } else if (data.type === "mapPress" && onMapPress) {
          // Include coordinates if available
          if (data.latitude !== undefined && data.longitude !== undefined) {
            onMapPress({ latitude: data.latitude, longitude: data.longitude });
          } else {
            onMapPress();
          }
        } else if (data.type === "draggableMarkerDragEnd" && draggableMarker?.onDragEnd) {
          draggableMarker.onDragEnd({ latitude: data.latitude, longitude: data.longitude });
        } else if (data.type === "mapReady") {
          setIsMapReady(true);
        }
      } catch (e) {
        console.log("WebViewMap message parse error:", e);
      }
    };

    // Generate the HTML content for the map
    const getMapHtml = () => {
      const lat = initialRegion?.latitude || 0;
      const lng = initialRegion?.longitude || 0;
      const zoom = initialRegion ? getZoomFromDelta(initialRegion.latitudeDelta) : 13;

      // Prepare initial data
      const initialMarkers = JSON.stringify(markers);
      const initialCircles = JSON.stringify(circles);
      const initialPolylines = JSON.stringify(polylines);
      const initialUserLocation = showsUserLocation && userLocation
        ? `updateUserLocation(${userLocation.latitude}, ${userLocation.longitude});`
        : "";
      const initialDraggableMarker = draggableMarker
        ? `updateDraggableMarker(${draggableMarker.coordinate.latitude}, ${draggableMarker.coordinate.longitude});`
        : "";

      return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .custom-marker {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .marker-default {
      background-color: #27272a;
      border: 2px solid #FFCC00;
    }
    .marker-selected {
      background-color: #FFCC00;
    }
    .user-location-marker {
      width: 16px;
      height: 16px;
      background-color: #4285F4;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(66, 133, 244, 0.5);
    }
    .user-location-pulse {
      width: 40px;
      height: 40px;
      background-color: rgba(66, 133, 244, 0.2);
      border-radius: 50%;
      position: absolute;
      top: -12px;
      left: -12px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    .draggable-pin {
      width: 40px;
      height: 50px;
      position: relative;
    }
    .draggable-pin-head {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #FFE066 0%, #FFCC00 50%, #E6B800 100%);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .draggable-pin-head::after {
      content: '';
      width: 16px;
      height: 16px;
      background: #1A1A1C;
      border-radius: 50%;
      transform: rotate(45deg);
    }
    .draggable-pin-shadow {
      width: 20px;
      height: 6px;
      background: rgba(0,0,0,0.2);
      border-radius: 50%;
      position: absolute;
      bottom: -2px;
      left: 10px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${lat}, ${lng}], ${zoom});

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Store references
    var markersLayer = {};
    var circlesLayer = [];
    var polylinesLayer = [];
    var userLocationMarker = null;
    var draggableMarkerRef = null;

    // Helper to convert delta to zoom
    function getZoomFromDelta(delta) {
      if (!delta || delta <= 0) return 13;
      var zoom = Math.log2(360 / delta);
      return Math.min(Math.max(Math.round(zoom), 1), 19);
    }

    // Create marker icon
    function createMarkerIcon(isSelected) {
      return L.divIcon({
        className: '',
        html: '<div class="custom-marker ' + (isSelected ? 'marker-selected' : 'marker-default') + '">🔧</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
    }

    // Update markers
    function updateMarkers(markerData) {
      // Remove old markers
      Object.keys(markersLayer).forEach(function(id) {
        map.removeLayer(markersLayer[id]);
      });
      markersLayer = {};

      // Add new markers
      if (markerData && Array.isArray(markerData)) {
        markerData.forEach(function(m) {
          if (m.coordinate && m.coordinate.latitude && m.coordinate.longitude) {
            var marker = L.marker([m.coordinate.latitude, m.coordinate.longitude], {
              icon: createMarkerIcon(m.isSelected)
            }).addTo(map);

            marker.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'markerPress',
                markerId: m.id
              }));
            });

            markersLayer[m.id] = marker;
          }
        });
      }
    }

    // Update circles
    function updateCircles(circleData) {
      // Remove old circles
      circlesLayer.forEach(function(c) {
        map.removeLayer(c);
      });
      circlesLayer = [];

      // Add new circles
      if (circleData && Array.isArray(circleData)) {
        circleData.forEach(function(c) {
          if (c.center && c.center.latitude && c.center.longitude) {
            var circle = L.circle([c.center.latitude, c.center.longitude], {
              radius: c.radius || 1000,
              color: c.strokeColor || 'rgba(255, 204, 0, 0.8)',
              weight: c.strokeWidth || 2,
              fillColor: c.fillColor || 'rgba(255, 204, 0, 0.1)',
              fillOpacity: 0.3
            }).addTo(map);
            circlesLayer.push(circle);
          }
        });
      }
    }

    // Update polylines
    function updatePolylines(polylineData) {
      // Remove old polylines
      polylinesLayer.forEach(function(p) {
        map.removeLayer(p);
      });
      polylinesLayer = [];

      // Add new polylines
      if (polylineData && Array.isArray(polylineData)) {
        polylineData.forEach(function(p) {
          if (p.coordinates && Array.isArray(p.coordinates)) {
            var latlngs = p.coordinates.map(function(c) {
              return [c.latitude, c.longitude];
            });
            if (latlngs.length > 0) {
              var polyline = L.polyline(latlngs, {
                color: p.strokeColor || '#FFCC00',
                weight: p.strokeWidth || 5
              }).addTo(map);
              polylinesLayer.push(polyline);
            }
          }
        });
      }
    }

    // Update user location
    function updateUserLocation(lat, lng) {
      if (!lat || !lng) return;
      if (userLocationMarker) {
        userLocationMarker.setLatLng([lat, lng]);
      } else {
        var icon = L.divIcon({
          className: '',
          html: '<div style="position: relative;"><div class="user-location-pulse"></div><div class="user-location-marker"></div></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        userLocationMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
      }
    }

    // Create draggable pin icon
    function createDraggablePinIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="draggable-pin"><div class="draggable-pin-head"></div><div class="draggable-pin-shadow"></div></div>',
        iconSize: [40, 50],
        iconAnchor: [20, 50],
      });
    }

    // Update draggable marker
    function updateDraggableMarker(lat, lng) {
      if (!lat || !lng) return;
      if (draggableMarkerRef) {
        draggableMarkerRef.setLatLng([lat, lng]);
      } else {
        draggableMarkerRef = L.marker([lat, lng], {
          icon: createDraggablePinIcon(),
          draggable: true,
          zIndexOffset: 2000
        }).addTo(map);

        // Handle drag end
        draggableMarkerRef.on('dragend', function(e) {
          var latlng = e.target.getLatLng();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'draggableMarkerDragEnd',
            latitude: latlng.lat,
            longitude: latlng.lng
          }));
        });
      }
    }

    // Handle map clicks
    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapPress',
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }));
    });

    // Initialize with data
    updateMarkers(${initialMarkers});
    updateCircles(${initialCircles});
    updatePolylines(${initialPolylines});
    ${initialUserLocation}
    ${initialDraggableMarker}

    // Notify React Native that map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapReady'
    }));
  </script>
</body>
</html>
      `;
    };

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={{ html: getMapHtml() }}
          style={styles.webview}
          onMessage={handleMessage}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          mixedContentMode="compatibility"
        />
      </View>
    );
  }
);

// Helper function to convert lat/lng delta to zoom level
function getZoomFromDelta(delta: number): number {
  if (!delta || delta <= 0) return 13;
  const zoom = Math.log2(360 / delta);
  return Math.min(Math.max(Math.round(zoom), 1), 19);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default WebViewMap;
