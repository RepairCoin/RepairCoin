import { Text, View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ServiceCardProps {
  imageUrl?: string | null;
  category: string;
  title: string;
  description?: string | null;
  price: number;
  duration?: number;
  date?: string | null;
  status?: {
    label: string;
    bgColor: string;
    textColor: string;
  };
  statusPosition?: "image" | "body";
  badgeStatus?: {
    label: string;
    active: boolean;
  };
  onPress?: () => void;
  showMenu?: boolean;
  menuPosition?: "image" | "footer";
  onMenuPress?: () => void;
  variant?: "grid" | "list";
}

export default function ServiceCard({
  imageUrl,
  category,
  title,
  description,
  price,
  duration,
  date,
  status,
  statusPosition = "body",
  badgeStatus,
  onPress,
  showMenu,
  menuPosition = "image",
  onMenuPress,
  variant = "grid",
}: ServiceCardProps) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Not scheduled";
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // List View Layout
  if (variant === "list") {
    return (
      <View className="mx-4 my-2">
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <View className="bg-gray-900 rounded-xl overflow-hidden flex-row">
            {/* Image */}
            <View className="relative">
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  className="w-24 h-24"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-24 h-24 bg-gray-800 items-center justify-center">
                  <Ionicons name="image-outline" size={24} color="#6B7280" />
                </View>
              )}
            </View>

            {/* Content */}
            <View className="flex-1 p-3 justify-between">
              <View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-gray-500 uppercase tracking-wide">
                    {category}
                  </Text>
                  {status && (
                    <View className={`px-2 py-0.5 rounded-full ${status.bgColor}`}>
                      <Text className={`text-xs font-medium capitalize ${status.textColor}`}>
                        {status.label}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-white text-base font-semibold" numberOfLines={1}>
                  {title}
                </Text>
              </View>

              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-[#FFCC00] font-bold text-lg">${price}</Text>
                <View className="flex-row items-center">
                  {duration !== undefined ? (
                    <>
                      <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                      <Text className="text-gray-400 text-xs ml-1">{duration} min</Text>
                    </>
                  ) : date !== undefined ? (
                    <>
                      <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                      <Text className="text-gray-400 text-xs ml-1">{formatDate(date)}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Menu Button */}
            {showMenu && (
              <TouchableOpacity
                onPress={onMenuPress}
                className="p-3 justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Grid View Layout (default)
  return (
    <View className="flex-1 mx-2 my-2">
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View className="bg-gray-900 rounded-xl overflow-hidden">
          {imageUrl !== undefined && (
            <View className="relative">
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  className="w-full h-28"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-28 bg-gray-800 items-center justify-center">
                  <Ionicons name="image-outline" size={32} color="#6B7280" />
                </View>
              )}
              {showMenu && menuPosition === "image" && (
                <TouchableOpacity
                  onPress={onMenuPress}
                  className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                  activeOpacity={0.7}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="white" />
                </TouchableOpacity>
              )}
              {badgeStatus && (
                <View
                  className={`absolute top-2 right-2 px-2 py-1 rounded-full ${
                    badgeStatus.active ? "bg-green-500" : "bg-gray-600"
                  }`}
                >
                  <Text className="text-white text-xs font-medium">
                    {badgeStatus.label}
                  </Text>
                </View>
              )}
              {status && statusPosition === "image" && (
                <View
                  className={`absolute top-2 right-2 px-2 py-1 rounded-full ${status.bgColor}`}
                >
                  <Text
                    className={`text-xs font-medium capitalize ${status.textColor}`}
                  >
                    {status.label}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View className="p-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-gray-500 uppercase tracking-wide">
                {category}
              </Text>
              {status && statusPosition === "body" && (
                <View className={`px-2 py-1 rounded-full ${status.bgColor}`}>
                  <Text
                    className={`text-xs font-medium capitalize ${status.textColor}`}
                  >
                    {status.label}
                  </Text>
                </View>
              )}
            </View>

            <Text
              className="text-white text-base font-semibold mb-1"
              numberOfLines={1}
            >
              {title}
            </Text>

            <Text
              className="text-gray-400 text-xs leading-4 mb-3"
              numberOfLines={2}
            >
              {description || "No description"}
            </Text>

            <View className="border-t border-gray-800 pt-3 flex-row items-center justify-between">
              <Text className="text-[#FFCC00] font-bold text-lg">${price}</Text>
              {showMenu && menuPosition === "footer" ? (
                <TouchableOpacity onPress={onMenuPress}>
                  <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <View className="flex-row items-center">
                  {duration !== undefined ? (
                    <>
                      <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                      <Text className="text-gray-400 text-xs ml-1">
                        {duration} min
                      </Text>
                    </>
                  ) : date !== undefined ? (
                    <>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color="#9CA3AF"
                      />
                      <Text className="text-gray-400 text-xs ml-1">
                        {formatDate(date)}
                      </Text>
                    </>
                  ) : null}
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}
