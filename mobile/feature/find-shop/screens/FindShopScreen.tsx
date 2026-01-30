import { View, Text, ActivityIndicator, FlatList } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT, Polyline, Circle } from "react-native-maps";
import WebViewMap, { MarkerData } from "@/shared/components/maps/WebViewMap";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { useFindShop } from "../hooks";
import { ShopWithLocation } from "../types";
import {
  ShopCard,
  ShopPopupMinimized,
  ShopPopupExpanded,
  DirectionsPanelMinimized,
  DirectionsPanelExpanded,
  RadiusControl,
  CenterLocationButton,
  ViewModeToggle,
} from "../components";

export default function FindShopScreen() {
  const {
    mapRef,
    webViewMapRef,
    isAndroid,
    isLoading,
    locationLoading,
    filteredShops,
    shopsInRadius,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    selectedShop,
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
    milesToMeters,
    metersToMiles,
    formatDuration,
  } = useFindShop();

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-16 px-4 pb-4 bg-zinc-950 z-10">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-semibold">Find Shop</Text>
          <ViewModeToggle
            viewMode={viewMode}
            onMapPress={() => setViewMode("map")}
            onListPress={() => setViewMode("list")}
          />
        </View>
      </View>

      {/* Geocoding Overlay */}
      {isGeocoding && (
        <View className="absolute inset-0 bg-black/50 z-50 items-center justify-center">
          <View className="bg-zinc-900 rounded-2xl p-6 items-center">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-white mt-3">Finding location...</Text>
          </View>
        </View>
      )}

      {/* Loading State */}
      {isLoading || locationLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 mt-4">
            {locationLoading ? "Getting your location..." : "Loading shops..."}
          </Text>
        </View>
      ) : !initialMapRegion ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="location-outline" size={64} color="#666" />
          <Text className="text-gray-400 text-center mt-4">
            Location permission required
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Please enable location access to find shops near you
          </Text>
        </View>
      ) : viewMode === "map" ? (
        /* Map View */
        <View className="flex-1">
          {isAndroid ? (
            <WebViewMap
              ref={webViewMapRef}
              style={{ flex: 1 }}
              initialRegion={initialMapRegion || undefined}
              showsUserLocation={true}
              userLocation={userLocation}
              markers={filteredShops
                .filter((shop: ShopWithLocation) => shop.hasValidLocation)
                .map((shop: ShopWithLocation): MarkerData => ({
                  id: shop.shopId,
                  coordinate: { latitude: shop.lat!, longitude: shop.lng! },
                  title: shop.name,
                  description: shop.address,
                  isSelected: selectedShop?.shopId === shop.shopId,
                }))}
              circles={
                userLocation
                  ? [
                      {
                        center: {
                          latitude: userLocation.latitude,
                          longitude: userLocation.longitude,
                        },
                        radius: milesToMeters(radiusMiles),
                        strokeColor: "rgba(255, 204, 0, 0.8)",
                        strokeWidth: 2,
                        fillColor: "rgba(255, 204, 0, 0.1)",
                      },
                    ]
                  : []
              }
              polylines={
                showDirections && routeCoordinates.length > 0
                  ? [
                      {
                        coordinates: routeCoordinates,
                        strokeColor: "#FFCC00",
                        strokeWidth: 5,
                      },
                    ]
                  : []
              }
              onMarkerPress={handleWebViewMarkerPress}
              onMapPress={clearSelectedShop}
            />
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_DEFAULT}
              initialRegion={initialMapRegion}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {userLocation && (
                <Circle
                  center={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                  radius={milesToMeters(radiusMiles)}
                  strokeColor="rgba(255, 204, 0, 0.8)"
                  strokeWidth={2}
                  fillColor="rgba(255, 204, 0, 0.1)"
                />
              )}

              {filteredShops
                .filter((shop: ShopWithLocation) => shop.hasValidLocation)
                .map((shop: ShopWithLocation) => (
                  <Marker
                    key={shop.shopId}
                    coordinate={{ latitude: shop.lat!, longitude: shop.lng! }}
                    title={shop.name}
                    description={shop.address}
                    onPress={() => handleMarkerPress(shop)}
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        selectedShop?.shopId === shop.shopId
                          ? "bg-[#FFCC00]"
                          : "bg-zinc-800 border-2 border-[#FFCC00]"
                      }`}
                    >
                      <Feather
                        name="tool"
                        size={18}
                        color={selectedShop?.shopId === shop.shopId ? "#000" : "#FFCC00"}
                      />
                    </View>
                  </Marker>
                ))}

              {showDirections && routeCoordinates.length > 0 && (
                <Polyline coordinates={routeCoordinates} strokeColor="#FFCC00" strokeWidth={5} />
              )}
            </MapView>
          )}

          <CenterLocationButton onPress={centerOnUserLocation} />

          {/* Directions Panel */}
          {showDirections && selectedShop && isDirectionsPanelMinimized && (
            <DirectionsPanelMinimized
              shop={selectedShop}
              routeDistance={routeDistance}
              routeDuration={routeDuration}
              onExpand={() => setIsDirectionsPanelMinimized(false)}
              metersToMiles={metersToMiles}
              formatDuration={formatDuration}
            />
          )}

          {showDirections && selectedShop && !isDirectionsPanelMinimized && (
            <DirectionsPanelExpanded
              shop={selectedShop}
              routeDistance={routeDistance}
              routeDuration={routeDuration}
              isLoadingRoute={isLoadingRoute}
              routeCoordinatesLength={routeCoordinates.length}
              onMinimize={() => setIsDirectionsPanelMinimized(true)}
              onClose={closeDirections}
              metersToMiles={metersToMiles}
              formatDuration={formatDuration}
            />
          )}

          {/* Shop Popup */}
          {selectedShop && !showDirections && (
            isShopPopupMinimized ? (
              <ShopPopupMinimized
                shop={selectedShop}
                onExpand={() => setIsShopPopupMinimized(false)}
              />
            ) : (
              <ShopPopupExpanded
                shop={selectedShop}
                onMinimize={() => setIsShopPopupMinimized(true)}
                onClose={clearSelectedShop}
                onCall={() => openPhoneDialer(selectedShop)}
                onDirections={() => openDirections(selectedShop)}
              />
            )
          )}

          <RadiusControl
            radiusMiles={radiusMiles}
            shopsInRadius={shopsInRadius}
            onIncrease={increaseRadius}
            onDecrease={decreaseRadius}
          />
        </View>
      ) : (
        /* List View */
        <FlatList
          data={filteredShops}
          keyExtractor={(item) => item.shopId}
          renderItem={({ item }) => (
            <ShopCard shop={item} onPress={() => handleShopCardPress(item)} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            <View className="mb-4">
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search shops..."
              />
              {searchQuery.length > 0 && (
                <Text className="text-gray-400 text-sm mt-2">
                  {filteredShops.length} shop{filteredShops.length !== 1 ? "s" : ""} found
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <Ionicons name="storefront-outline" size={64} color="#666" />
              <Text className="text-gray-400 text-center mt-4">
                {searchQuery.length > 0 ? "No shops match your search" : "No shops available"}
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                {searchQuery.length > 0
                  ? "Try a different search term"
                  : "Check back later for new shops"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
