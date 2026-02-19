import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useUnifiedServiceDetail } from "../hooks/ui/useUnifiedServiceDetail";
import {
  ServiceDetailHeader,
  ServiceInfoSection,
  ShopInfoSection,
  RewardsSection,
  AdditionalInfoSection,
  ServiceBottomActions,
  ShareModal,
} from "../components";
import { UnifiedReviewsSection } from "../components/UnifiedReviewsSection";
import { FULL_DAYS } from "../constants";

export default function UnifiedServiceDetailScreen() {
  const {
    // Core data
    serviceData,
    isLoading,
    error,

    // Role flags
    isCustomer,
    isShopOwner,

    // Reviews
    reviews,
    reviewStats,
    isLoadingReviews,
    refetchReviews,
    handleViewAllReviews,

    // Customer-specific
    getTierInfo,
    calculateReward,
    isStartingChat,
    handleCall,
    handleEmail,
    handleBookNow,
    handleViewShop,
    handleMessageShop,

    // Shop-specific
    availability,
    timeSlotConfig,
    loadingAvailability,
    showAllHours,
    setShowAllHours,
    getTodayAvailability,
    getGroupedHours,
    formatDayRange,
    openDaysCount,
    handleEdit,

    // Shared
    showShareModal,
    setShowShareModal,
    copySuccess,
    handleCopyLink,
    handleShareWhatsApp,
    handleShareTwitter,
    handleShareFacebook,
    handleNativeShare,
    handleGoBack,
    getCategoryLabel,
    formatDate,
    formatTime,
  } = useUnifiedServiceDetail();

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  if (error || !serviceData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={handleGoBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Service not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Image - Different for customer vs shop */}
        {isShopOwner ? (
          // Shop owner header (simpler, no message button)
          <View className="relative">
            {serviceData.imageUrl ? (
              <Image
                source={{ uri: serviceData.imageUrl }}
                className="w-full h-64"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-64 bg-gray-800 items-center justify-center">
                <Ionicons name="image-outline" size={64} color="#6B7280" />
              </View>
            )}

            {/* Back Button Overlay */}
            <TouchableOpacity
              onPress={handleGoBack}
              className="absolute top-14 left-4 bg-black/50 rounded-full p-2"
            >
              <Ionicons name="arrow-back" color="white" size={24} />
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              onPress={() => setShowShareModal(true)}
              className="absolute top-14 right-4 bg-black/50 rounded-full p-2"
            >
              <Ionicons name="share-social-outline" color="white" size={22} />
            </TouchableOpacity>
          </View>
        ) : (
          // Customer header (with message button)
          <ServiceDetailHeader
            imageUrl={serviceData.imageUrl}
            isCustomer={isCustomer}
            isStartingChat={isStartingChat}
            onGoBack={handleGoBack}
            onMessageShop={handleMessageShop}
            onShare={() => setShowShareModal(true)}
          />
        )}

        {/* Content */}
        <View className="px-4 py-6">
          {/* Service Info - Shared */}
          <ServiceInfoSection
            category={getCategoryLabel(serviceData.category)}
            serviceName={serviceData.serviceName}
            priceUsd={serviceData.priceUsd}
            description={serviceData.description}
          />

          {/* Tags - Shop owner only */}
          {isShopOwner && serviceData.tags && serviceData.tags.length > 0 && (
            <>
              <View className="h-px bg-gray-800 mb-6" />
              <View className="mb-6">
                <Text className="text-white text-lg font-semibold mb-4">Tags</Text>
                <View className="flex-row flex-wrap">
                  {serviceData.tags.map((tag: string, index: number) => (
                    <View
                      key={index}
                      className="bg-gray-800 px-3 py-1 rounded-full mr-2 mb-2"
                    >
                      <Text className="text-gray-400 text-sm">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Shop Info - Customer only */}
          {!isShopOwner && (
            <ShopInfoSection
              shopName={serviceData.shopName}
              shopAddress={serviceData.shopAddress}
              shopPhone={serviceData.shopPhone}
              shopEmail={serviceData.shopEmail}
              onCall={handleCall}
              onEmail={handleEmail}
            />
          )}

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Rewards Section - Customer only */}
          {!isShopOwner && (
            <>
              <RewardsSection tierInfo={getTierInfo()} reward={calculateReward()} />
              <View className="h-px bg-gray-800 mb-6" />
            </>
          )}

          {/* Availability Section - Shop owner only */}
          {isShopOwner && (
            <>
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={22} color="#FFCC00" />
                    <Text className="text-white text-lg font-semibold ml-2">
                      Availability
                    </Text>
                  </View>
                  {availability.length > 0 && (
                    <View className="flex-row items-center">
                      <View
                        className={`w-2 h-2 rounded-full mr-2 ${
                          openDaysCount > 0 ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <Text className="text-gray-400 text-sm">
                        {openDaysCount}/7 days
                      </Text>
                    </View>
                  )}
                </View>

                {loadingAvailability ? (
                  <View className="items-center py-4">
                    <ActivityIndicator size="small" color="#FFCC00" />
                  </View>
                ) : (
                  <>
                    {/* Today's Status */}
                    {availability.length > 0 && (
                      <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
                        {(() => {
                          const today = getTodayAvailability();
                          const todayName = FULL_DAYS[new Date().getDay()];
                          return (
                            <View className="flex-row items-center justify-between">
                              <View className="flex-row items-center">
                                <View
                                  className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                                    today?.isOpen
                                      ? "bg-green-500/20"
                                      : "bg-red-500/20"
                                  }`}
                                >
                                  <Ionicons
                                    name={
                                      today?.isOpen
                                        ? "checkmark-circle"
                                        : "close-circle"
                                    }
                                    size={24}
                                    color={today?.isOpen ? "#22c55e" : "#ef4444"}
                                  />
                                </View>
                                <View>
                                  <Text className="text-white font-semibold">
                                    {today?.isOpen ? "Open Today" : "Closed Today"}
                                  </Text>
                                  <Text className="text-gray-500 text-xs">
                                    {todayName}
                                  </Text>
                                </View>
                              </View>
                              {today?.isOpen && (
                                <View className="items-end">
                                  <Text className="text-[#FFCC00] font-semibold">
                                    {formatTime(today.openTime)} -{" "}
                                    {formatTime(today.closeTime)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {/* Weekly Schedule */}
                    <TouchableOpacity
                      onPress={() => setShowAllHours(!showAllHours)}
                      className="bg-[#1a1a1a] rounded-xl p-4 mb-3"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-gray-400 text-sm">
                          Weekly Schedule
                        </Text>
                        <Ionicons
                          name={showAllHours ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9CA3AF"
                        />
                      </View>

                      {availability.length === 0 ? (
                        <Text className="text-gray-500 text-sm">
                          No hours configured
                        </Text>
                      ) : showAllHours ? (
                        <View>
                          {availability.map((day) => (
                            <View
                              key={day.dayOfWeek}
                              className="flex-row items-center justify-between py-2 border-b border-gray-800 last:border-b-0"
                            >
                              <View className="flex-row items-center">
                                <View
                                  className={`w-2 h-2 rounded-full mr-3 ${
                                    day.isOpen ? "bg-green-500" : "bg-red-500"
                                  }`}
                                />
                                <Text className="text-white">
                                  {FULL_DAYS[day.dayOfWeek]}
                                </Text>
                              </View>
                              <Text
                                className={
                                  day.isOpen ? "text-white" : "text-gray-500"
                                }
                              >
                                {day.isOpen
                                  ? `${formatTime(day.openTime)} - ${formatTime(day.closeTime)}`
                                  : "Closed"}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View>
                          {getGroupedHours().map((group, index) => (
                            <View
                              key={index}
                              className="flex-row items-center justify-between py-1"
                            >
                              <Text className="text-gray-400 text-sm">
                                {formatDayRange(group.days)}
                              </Text>
                              <Text
                                className={
                                  group.isOpen
                                    ? "text-white text-sm"
                                    : "text-gray-500 text-sm"
                                }
                              >
                                {group.isOpen
                                  ? `${formatTime(group.openTime!)} - ${formatTime(group.closeTime!)}`
                                  : "Closed"}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Booking Settings */}
                    {timeSlotConfig && (
                      <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
                        <Text className="text-gray-400 text-sm mb-3">
                          Booking Settings
                        </Text>
                        <View className="flex-row justify-between">
                          <View className="items-center flex-1">
                            <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                              <Ionicons
                                name="timer-outline"
                                size={20}
                                color="#FFCC00"
                              />
                            </View>
                            <Text className="text-white text-sm font-semibold">
                              {timeSlotConfig.slotDurationMinutes}m
                            </Text>
                            <Text className="text-gray-500 text-xs">Duration</Text>
                          </View>
                          <View className="items-center flex-1">
                            <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                              <Ionicons
                                name="pause-outline"
                                size={20}
                                color="#FFCC00"
                              />
                            </View>
                            <Text className="text-white text-sm font-semibold">
                              {timeSlotConfig.bufferTimeMinutes}m
                            </Text>
                            <Text className="text-gray-500 text-xs">Buffer</Text>
                          </View>
                          <View className="items-center flex-1">
                            <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                              <Ionicons
                                name="people-outline"
                                size={20}
                                color="#FFCC00"
                              />
                            </View>
                            <Text className="text-white text-sm font-semibold">
                              {timeSlotConfig.maxConcurrentBookings}
                            </Text>
                            <Text className="text-gray-500 text-xs">Max</Text>
                          </View>
                          <View className="items-center flex-1">
                            <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                              <Ionicons
                                name="calendar-outline"
                                size={20}
                                color="#FFCC00"
                              />
                            </View>
                            <Text className="text-white text-sm font-semibold">
                              {timeSlotConfig.bookingAdvanceDays}d
                            </Text>
                            <Text className="text-gray-500 text-xs">Advance</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
              <View className="h-px bg-gray-800 mb-6" />
            </>
          )}

          {/* Reviews Section - Shared with role-based features */}
          <UnifiedReviewsSection
            reviews={reviews}
            stats={reviewStats}
            isLoading={isLoadingReviews}
            isShopOwner={isShopOwner}
            onSeeAll={handleViewAllReviews}
            onReviewUpdated={refetchReviews}
          />

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Additional Info - Shared */}
          <AdditionalInfoSection
            createdAt={serviceData.createdAt}
            updatedAt={serviceData.updatedAt}
            formatDate={formatDate}
          />

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Fixed Bottom Actions - Different for each role */}
      {isShopOwner ? (
        <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-6 pt-4 pb-8 border-t border-gray-800">
          <TouchableOpacity
            onPress={handleEdit}
            className="bg-[#FFCC00] rounded-xl py-4 flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={20} color="black" />
            <Text className="text-black text-lg font-bold ml-2">Edit Service</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ServiceBottomActions
          isActive={serviceData.active}
          onViewShop={handleViewShop}
          onBookNow={handleBookNow}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        copySuccess={copySuccess}
        onCopyLink={handleCopyLink}
        onShareWhatsApp={handleShareWhatsApp}
        onShareTwitter={handleShareTwitter}
        onShareFacebook={handleShareFacebook}
        onNativeShare={handleNativeShare}
      />
    </View>
  );
}
