import React from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { shopApi } from "@/feature/shop/services/shop.services";
import { MapShop } from "@/feature/shop/services/shop.interface";
import {
  getCurrentLocation,
  Coordinates,
} from "@/feature/find-shop/services/geocoding.services";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import { SkeletonHorizontalCards } from "@/shared/components/ui/Skeleton";
import ShopGridCard from "@/shared/components/shared/ShopGridCard";
import { rScale } from "@/shared/utilities/responsive";

// Fixed spacing scaled from the Figma baseline. Card width itself is derived
// from the live screen width below (percentage + clamp), which is already
// device-adaptive, so it stays as-is.
const CARD_GAP = rScale(12);
const MILES_TO_KM = 1.60934;
const WALKING_MIN_PER_KM = 12; // ~5 km/h walking pace, matching the "run" ETA

/**
 * V2 Home "Nearby Shops" carousel. Backed by `GET /shops/map`, which returns
 * service-derived categories, ratings, and (with coords) distance — so the
 * card's icon fallback, rating, and ETA all come straight from the API.
 */
function NearbyShopsSection() {
  const { width } = useWindowDimensions();
  // Card scales with the screen so ~1.4 cards peek on any device (clamped for tablets).
  const cardWidth = Math.round(Math.min(320, Math.max(230, width * 0.7)));
  const imageHeight = Math.round(cardWidth * 0.62);
  const cardHeight = Math.round(cardWidth * 1.15);

  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(
    null
  );
  const [locationReady, setLocationReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const location = await getCurrentLocation();
        if (!cancelled && location) setUserLocation(location);
      } catch {
        // Location is optional — shops still load, just without distance.
      } finally {
        if (!cancelled) setLocationReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["shopsForMap", "nearby", userLocation?.latitude, userLocation?.longitude],
    queryFn: () =>
      shopApi.listShopsForMap({
        lat: userLocation?.latitude,
        lng: userLocation?.longitude,
        limit: 8,
      }),
    // Wait until the location attempt resolves so the first fetch can include coords.
    enabled: locationReady,
    staleTime: 5 * 60 * 1000,
  });

  const shops: MapShop[] = React.useMemo(() => data?.data ?? [], [data]);

  const formatDistance = (miles: number | null): string | undefined => {
    if (miles == null) return undefined;
    const km = miles * MILES_TO_KM;
    const eta = Math.max(1, Math.round(km * WALKING_MIN_PER_KM));
    return `${km.toFixed(1)}km/${eta}min`;
  };

  const loading = isLoading || !locationReady;
  if (!loading && shops.length === 0) return null;

  return (
    <View>
      <SectionHeader
        title="Nearby Shops"
        onSeeAll={() => router.navigate("/customer/tabs/find-shop")}
      />
      {loading ? (
        <SkeletonHorizontalCards count={3} cardWidth={cardWidth} />
      ) : (
        <View style={{ marginHorizontal: -16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            decelerationRate="fast"
            snapToInterval={cardWidth + CARD_GAP}
          >
            {shops.map((shop) => (
              <View
                key={shop.shopId}
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  marginRight: CARD_GAP,
                }}
              >
                <ShopGridCard
                  imageUrl={shop.logoUrl}
                  name={shop.name}
                  address={shop.address}
                  verified={shop.verified}
                  category={shop.serviceCategories?.[0] ?? shop.category}
                  rating={shop.avgRating}
                  reviewCount={shop.totalReviews}
                  distanceLabel={formatDistance(shop.distanceMiles)}
                  imageHeight={imageHeight}
                  onPress={() => router.navigate("/customer/tabs/find-shop")}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default React.memo(NearbyShopsSection);
