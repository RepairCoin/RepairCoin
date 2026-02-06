import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useServiceDetail } from "../hooks";
import {
  ServiceDetailHeader,
  ServiceInfoSection,
  ShopInfoSection,
  RewardsSection,
  ReviewsSection,
  AdditionalInfoSection,
  ServiceBottomActions,
  ShareModal,
} from "../components";

export default function ServiceDetailScreen() {
  const {
    serviceData,
    isLoading,
    error,
    isCustomer,
    getTierInfo,
    calculateReward,
    showShareModal,
    setShowShareModal,
    copySuccess,
    handleCopyLink,
    handleShareWhatsApp,
    handleShareTwitter,
    handleShareFacebook,
    handleNativeShare,
    isStartingChat,
    handleCall,
    handleEmail,
    handleBookNow,
    handleViewShop,
    handleMessageShop,
    handleGoBack,
    getCategoryLabel,
    formatDate,
    // Reviews
    reviews,
    reviewStats,
    isLoadingReviews,
    handleViewAllReviews,
  } = useServiceDetail();

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
        {/* Header Image */}
        <ServiceDetailHeader
          imageUrl={serviceData.imageUrl}
          isCustomer={isCustomer}
          isStartingChat={isStartingChat}
          onGoBack={handleGoBack}
          onMessageShop={handleMessageShop}
          onShare={() => setShowShareModal(true)}
        />

        {/* Content */}
        <View className="px-4 py-6">
          <ServiceInfoSection
            category={getCategoryLabel(serviceData.category)}
            serviceName={serviceData.serviceName}
            priceUsd={serviceData.priceUsd}
            description={serviceData.description}
          />

          <ShopInfoSection
            shopName={serviceData.shopName}
            shopAddress={serviceData.shopAddress}
            shopPhone={serviceData.shopPhone}
            shopEmail={serviceData.shopEmail}
            onCall={handleCall}
            onEmail={handleEmail}
          />

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          <RewardsSection tierInfo={getTierInfo()} reward={calculateReward()} />

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          <ReviewsSection
            reviews={reviews}
            stats={reviewStats}
            isLoading={isLoadingReviews}
            onSeeAll={handleViewAllReviews}
          />

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          <AdditionalInfoSection
            createdAt={serviceData.createdAt}
            formatDate={formatDate}
          />

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Fixed Bottom Buttons */}
      <ServiceBottomActions
        isActive={serviceData.active}
        onViewShop={handleViewShop}
        onBookNow={handleBookNow}
      />

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
