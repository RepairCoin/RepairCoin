import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import WebViewMap, { WebViewMapRef, Region } from "@/components/maps/WebViewMap";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { getCurrentLocation } from "@/services/geocoding.service";

export interface SelectedLocation {
  lat: number;
  lng: number;
}

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: SelectedLocation) => void;
  initialLocation?: { lat: number; lng: number };
}

// Default to a central location if no location is provided
const DEFAULT_LOCATION = {
  latitude: 14.5995,
  longitude: 120.9842,
};

function LocationPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLocation,
}: LocationPickerModalProps) {
  const mapRef = useRef<WebViewMapRef>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize location when modal opens
  useEffect(() => {
    if (visible) {
      initializeLocation();
    }
  }, [visible]);

  const initializeLocation = async () => {
    setIsLoading(true);

    try {
      // If initial location is provided, use it
      if (initialLocation && initialLocation.lat && initialLocation.lng) {
        setSelectedLocation({
          latitude: initialLocation.lat,
          longitude: initialLocation.lng,
        });
        setIsLoading(false);
        return;
      }

      // Otherwise, try to get current location
      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        setSelectedLocation({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        });
      } else {
        // Fall back to default location
        setSelectedLocation(DEFAULT_LOCATION);
      }
    } catch (error) {
      console.error("Error initializing location:", error);
      setSelectedLocation(DEFAULT_LOCATION);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapPress = useCallback(
    (coordinate?: { latitude: number; longitude: number }) => {
      if (!coordinate) return;
      setSelectedLocation(coordinate);
    },
    []
  );

  const handleMarkerDragEnd = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      setSelectedLocation(coordinate);
    },
    []
  );

  const handleUseCurrentLocation = async () => {
    setIsLoading(true);
    const currentLocation = await getCurrentLocation();
    if (currentLocation) {
      setSelectedLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });

      // Animate map to the new location
      mapRef.current?.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      Alert.alert(
        "Location Access",
        "Unable to get your current location. Please enable location services or select a location on the map."
      );
    }
    setIsLoading(false);
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      Alert.alert("Select Location", "Please select a location on the map.");
      return;
    }

    onConfirm({
      lat: selectedLocation.latitude,
      lng: selectedLocation.longitude,
    });
  };

  const getMapRegion = (): Region => {
    if (selectedLocation) {
      return {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    if (initialLocation) {
      return {
        latitude: initialLocation.lat,
        longitude: initialLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return {
      ...DEFAULT_LOCATION,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#121212]">
        {/* Header */}
        <LinearGradient
          colors={["#2A2A2C", "#1A1A1C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            paddingTop: Platform.OS === "ios" ? 60 : 50,
            paddingBottom: 16,
            paddingHorizontal: 16,
          }}
        >
          <View className="flex-row justify-between items-center">
            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-[#333] items-center justify-center"
            >
              <AntDesign name="close" color="white" size={18} />
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">Pin Location</Text>
            <View className="w-10" />
          </View>
        </LinearGradient>

        {/* Map Container */}
        <View className="flex-1">
          {isLoading ? (
            <View className="flex-1 items-center justify-center bg-[#1A1A1C]">
              <ActivityIndicator size="large" color="#FFCC00" />
              <Text className="text-white mt-4">Loading map...</Text>
            </View>
          ) : (
            <>
              <WebViewMap
                ref={mapRef}
                initialRegion={getMapRegion()}
                onMapPress={handleMapPress}
                draggableMarker={
                  selectedLocation
                    ? {
                        coordinate: {
                          latitude: selectedLocation.latitude,
                          longitude: selectedLocation.longitude,
                        },
                        onDragEnd: handleMarkerDragEnd,
                      }
                    : undefined
                }
                style={{ flex: 1 }}
              />

              {/* Current Location Button */}
              <TouchableOpacity
                onPress={handleUseCurrentLocation}
                className="absolute right-4 bottom-10 w-12 h-12 rounded-full bg-[#2A2A2C] items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
                }}
              >
                <Ionicons name="locate" size={24} color="#FFCC00" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Coordinates Display and Confirm Button */}
        <View
          className="px-4 pb-8 pt-4"
          style={{
            backgroundColor: "#1A1A1C",
            borderTopWidth: 1,
            borderTopColor: "#2A2A2C",
          }}
        >
          {/* Coordinates Display */}
          <View className="bg-[#2A2A2C] rounded-xl p-4 mb-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center mr-3">
                <Ionicons name="location" size={20} color="#000" />
              </View>
              <View className="flex-1">
                {selectedLocation ? (
                  <>
                    <Text className="text-white text-base font-medium">
                      {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-1">
                      Drag the pin or tap on the map to adjust
                    </Text>
                  </>
                ) : (
                  <Text className="text-gray-400">Select a location on the map</Text>
                )}
              </View>
            </View>
          </View>

          {/* Confirm Button */}
          <PrimaryButton
            title="Confirm Location"
            onPress={handleConfirm}
            disabled={!selectedLocation}
          />
        </View>
      </View>
    </Modal>
  );
}

export default React.memo(LocationPickerModal);
