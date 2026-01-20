import { ScrollView, RefreshControl } from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { QRScanner } from "@/components/shop/QRScanner";
import { useRewardToken } from "../hooks";
import {
  RewardHeader,
  CustomerDetailsSection,
  RepairTypeSection,
  RewardSummary,
  HowItWorksModal,
} from "../components";

export default function RewardTokenScreen() {
  const {
    // Modal states
    showHowItWorks,
    setShowHowItWorks,
    showQRScanner,
    setShowQRScanner,

    // Refresh
    isRefreshing,
    handleRefresh,

    // Customer
    customerAddress,
    setCustomerAddress,
    customerInfo,
    isLoadingCustomer,
    isSelfReward,
    isCustomerNotFound,

    // Repair
    repairType,
    customAmount,
    setCustomAmount,
    customRcn,
    setCustomRcn,
    handleRepairTypeSelect,

    // Promo
    availablePromoCodes,
    promoCode,
    promoBonus,
    promoError,
    showPromoDropdown,
    setShowPromoDropdown,
    isValidatingPromo,
    handlePromoCodeChange,
    handlePromoCodeSelect,
    handlePromoCodeClear,

    // Reward calculations
    baseReward,
    tierBonus,
    totalReward,

    // Actions
    isIssuingReward,
    isIssueDisabled,
    handleIssueReward,
    handleQRScan,
    handleGoBack,
    getButtonText,
  } = useRewardToken();

  return (
    <ThemedView className="flex-1 bg-black">
      <RewardHeader
        onBack={handleGoBack}
        onInfoPress={() => setShowHowItWorks(true)}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
          />
        }
      >
        <CustomerDetailsSection
          customerAddress={customerAddress}
          onAddressChange={setCustomerAddress}
          customerInfo={customerInfo}
          isLoadingCustomer={isLoadingCustomer}
          isCustomerNotFound={isCustomerNotFound}
          isSelfReward={isSelfReward}
          onQRScan={() => setShowQRScanner(true)}
          promoCode={promoCode}
          promoBonus={promoBonus}
          promoError={promoError}
          isValidatingPromo={isValidatingPromo}
          showPromoDropdown={showPromoDropdown}
          availablePromoCodes={availablePromoCodes}
          onPromoCodeChange={handlePromoCodeChange}
          onPromoFocus={() => setShowPromoDropdown(true)}
          onPromoBlur={() => setTimeout(() => setShowPromoDropdown(false), 200)}
          onPromoClear={handlePromoCodeClear}
          onPromoSelect={handlePromoCodeSelect}
        />

        <RepairTypeSection
          repairType={repairType}
          customAmount={customAmount}
          customRcn={customRcn}
          onRepairTypeSelect={handleRepairTypeSelect}
          onCustomAmountChange={setCustomAmount}
          onCustomRcnChange={setCustomRcn}
        />
      </ScrollView>

      <RewardSummary
        baseReward={baseReward}
        tierBonus={tierBonus}
        promoBonus={promoBonus}
        totalReward={totalReward}
        customerInfo={customerInfo}
        isIssuing={isIssuingReward}
        isDisabled={isIssueDisabled}
        buttonText={getButtonText()}
        onIssue={handleIssueReward}
      />

      <HowItWorksModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />

      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />
    </ThemedView>
  );
}
