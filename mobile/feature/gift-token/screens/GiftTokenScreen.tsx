import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { QRScanner } from "@/shared/components/shop/QRScanner";
import { useGiftToken } from "../hooks";
import {
  GiftHeader,
  RecipientInput,
  AmountInput,
  MessageInput,
  ValidationMessage,
  GiftButton,
  InfoNote,
} from "../components";

export default function GiftTokenScreen() {
  const {
    recipientAddress,
    amount,
    message,
    setMessage,
    handleAddressChange,
    handleAmountChange,
    handleSetMaxAmount,
    handleGiftToken,
    handleQRScan,
    showQRScanner,
    setShowQRScanner,
    isLoading,
    error,
    validationResult,
  } = useGiftToken();

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Gift Token" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <GiftHeader />

          <RecipientInput
            value={recipientAddress}
            onChangeText={handleAddressChange}
            onQRPress={() => setShowQRScanner(true)}
          />

          <AmountInput
            value={amount}
            onChangeText={handleAmountChange}
            onMaxPress={handleSetMaxAmount}
          />

          <MessageInput value={message} onChangeText={setMessage} />

          <ValidationMessage
            validationResult={validationResult}
            error={error}
          />

          <GiftButton
            onPress={handleGiftToken}
            isLoading={isLoading}
            isValidated={validationResult?.valid || false}
          />

          <InfoNote />
        </ScrollView>
      </KeyboardAvoidingView>

      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />
    </View>
  );
}
