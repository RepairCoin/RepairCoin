import React from "react";
import { View, Text, FlatList, ListRenderItem } from "react-native";
import SectionHeader from "./SectionHeader";

interface HorizontalCarouselProps<T> {
  title: string;
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  onSeeAll?: () => void;
  icon?: React.ReactNode;
  /** Gap between items (px). */
  gap?: number;
  /** Rendered when data is empty. */
  ListEmptyComponent?: React.ReactElement | null;
}

/**
 * SectionHeader ("Title … See All") + a horizontal FlatList. Removes the
 * near-identical carousel boilerplate repeated across the home sections
 * (Trending / AI Recommended / Nearby Shops / Recently Viewed).
 */
function HorizontalCarousel<T>({
  title,
  data,
  renderItem,
  keyExtractor,
  onSeeAll,
  icon,
  gap = 12,
  ListEmptyComponent,
}: HorizontalCarouselProps<T>) {
  return (
    <View className="mt-2">
      <View className="px-4">
        <SectionHeader title={title} icon={icon} onSeeAll={onSeeAll} />
      </View>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap }}
        ListEmptyComponent={ListEmptyComponent}
      />
    </View>
  );
}

export default HorizontalCarousel;
