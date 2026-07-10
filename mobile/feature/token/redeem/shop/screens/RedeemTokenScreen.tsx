import React from "react";
import { ScrollView, RefreshControl } from "react-native";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { QRScanner } from "@/shared/components/shop/QRScanner";
import {
  RedeemTokenHeader,
  CustomerDetailsSection,
  RedemptionAmountSection,
  RedemptionSummary,
  RedemptionHistory,
  HowItWorksModal,
  ProcessingStatusModal,
} from "../components";
import { useRedeemToken, useRedemptionHistory } from "../../hooks";

export default function RedeemTokenScreen() {
  const {
    // State
    showHowItWorks,
    setShowHowItWorks,
    isRefreshing,
    showQRScanner,
    setShowQRScanner,
    redemptionAmount,
    setRedemptionAmount,

    // Customer data
    customerAddress,
    setCustomerAddress,
    customerData,
    isLoadingCustomer,
    customerError,

    // Session data
    currentSession,
    sessionStatus,
    timeRemaining,
    isCreatingSession,
    isCancellingSession,

    // Computed values
    isCustomerSelf,
    hasInsufficientBalance,
    exceedsCrossShopLimit,
    canProcessRedemption,

    // Handlers
    handleProcessRedemption,
    handleCancelSession,
    handleRefresh,
    handleCompleteAnother,
    handleQRScan,
    goBack,
  } = useRedeemToken();

  const {
    data: redemptionHistory = [],
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useRedemptionHistory();

  const onRefresh = async () => {
    await Promise.all([handleRefresh(), refetchHistory()]);
  };

  return (
    <ThemedView className="flex-1 bg-black">
      <RedeemTokenHeader
        onBack={goBack}
        onInfoPress={() => setShowHowItWorks(true)}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
          />
        }
      >
        <CustomerDetailsSection
          customerAddress={customerAddress}
          onAddressChange={setCustomerAddress}
          customerData={customerData}
          isLoadingCustomer={isLoadingCustomer}
          customerError={customerError}
          isCustomerSelf={isCustomerSelf}
          onQRScanPress={() => setShowQRScanner(true)}
        />

        <RedemptionAmountSection
          redemptionAmount={redemptionAmount}
          onAmountChange={setRedemptionAmount}
          customerData={customerData}
          hasInsufficientBalance={hasInsufficientBalance}
          exceedsCrossShopLimit={exceedsCrossShopLimit}
        />

        {/* Redemption Summary Card - Hide when session is active */}
        {sessionStatus === "idle" && (
          <RedemptionSummary
            redemptionAmount={redemptionAmount}
            customerAddress={customerAddress}
            customerData={customerData}
            canProcessRedemption={canProcessRedemption}
            isCreatingSession={isCreatingSession}
            isLoadingCustomer={isLoadingCustomer}
            onProcessRedemption={handleProcessRedemption}
          />
        )}

        {/* Redemption History */}
        <RedemptionHistory
          transactions={redemptionHistory}
          isLoading={isLoadingHistory}
        />
      </ScrollView>

      {/* How It Works Modal */}
      <HowItWorksModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />

      {/* Processing Status Modal */}
      <ProcessingStatusModal
        visible={sessionStatus !== "idle" && !!currentSession}
        sessionStatus={sessionStatus}
        currentSession={currentSession}
        timeRemaining={timeRemaining}
        isCancellingSession={isCancellingSession}
        onCancelSession={handleCancelSession}
        onCompleteAnother={handleCompleteAnother}
      />

      {/* QR Scanner */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />
    </ThemedView>
  );
};
