import { Modal, Pressable, Text, View } from "react-native";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { AntDesign } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  loading?: boolean;
};

export default function SubscriptionModal({
  visible,
  onClose,
  onSubscribe,
  loading,
}: Props) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className="w-full h-full items-center justify-center bg-black/50"
        onPress={onClose}
      >
        <Pressable
          className="w-[90%] max-w-md bg-white rounded-3xl shadow-lg p-6 relative"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <Pressable
            onPress={onClose}
            className="absolute top-4 right-4 z-10"
          >
            <AntDesign name="close" size={24} color="#666" />
          </Pressable>

          {/* Header */}
          <Text className="text-2xl font-extrabold text-black text-center mt-2">
            Monthly Subscription
          </Text>

          {/* Sub-header */}
          <Text className="text-base text-gray-600 text-center mt-3 leading-6">
            Pay $500/month to operate without RCG tokens. Cancel anytime.
          </Text>

          {/* Divider */}
          <View className="bg-gray-200 w-full h-[1px] my-6" />

          {/* Bullet Points */}
          <View className="gap-4 mb-6">
            <View className="flex-row items-start gap-3">
              <View className="w-2 h-2 rounded-full bg-[#FFCC00] mt-2" />
              <Text className="flex-1 text-base text-gray-800">
                Monthly payment plan
              </Text>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-2 h-2 rounded-full bg-[#FFCC00] mt-2" />
              <Text className="flex-1 text-base text-gray-800">
                Standard RCN pricing ($0.10)
              </Text>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-2 h-2 rounded-full bg-[#FFCC00] mt-2" />
              <Text className="flex-1 text-base text-gray-800">
                No upfront token purchase
              </Text>
            </View>
          </View>

          {/* Subscribe Button */}
          <PrimaryButton
            title="Subscribe Now"
            onPress={onSubscribe}
            loading={loading}
            disabled={loading}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
