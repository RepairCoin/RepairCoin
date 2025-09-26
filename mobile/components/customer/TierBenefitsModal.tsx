import { AntDesign, Feather } from "@expo/vector-icons";
import { Image, Modal, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  requestClose: () => void;
};

export default function TierBenefitsModal({ visible, requestClose }: Props) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={requestClose}
    >
      <View className="w-full h-full items-center justify-center bg-black/50 px-5">
        <View className="w-full px-5 py-6 bg-[#1A1A1C] rounded-2xl shadow-lg gap-4 relative">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-xl font-semibold">
              Current Tier Benefits
            </Text>
            <Pressable
              onPress={requestClose}
              className="w-8 h-8 justify-center items-center rounded-full bg-white"
            >
              <Feather name="x" color="#000" size={20} />
            </Pressable>
          </View>
          <Text className="text-white mt-2">
            <AntDesign name="checkcircle" color="#FFCC00" size={14} />
            {'    '}Earn 10-25 RCN per repair service
          </Text>
          <Text className="text-white">
            <AntDesign name="checkcircle" color="#FFCC00" size={14} />
            {'    '}+10 RCN automatic bonus on every transaction
          </Text>
          <Text className="text-white">
            <AntDesign name="checkcircle" color="#FFCC00" size={14} />
            {'    '}$1 redemption value at your home shop
          </Text>
          <Text className="text-white">
            <AntDesign name="checkcircle" color="#FFCC00" size={14} />
            {'    '}20% balance usable at partner shops
          </Text>
          <Text className="text-white">
            <AntDesign name="checkcircle" color="#FFCC00" size={14} />
            {'    '}Instant mobile wallet activation
          </Text>
          <Text className="text-white">
            <AntDesign name="checkcircle" color="#FFCC00" size={14} />
            {'    '}Real-time transaction notifications
          </Text>
          <Image
            source={require("@/assets/images/tier_benefits_bronze.png")}
            className="absolute bottom-0 right-0"
          />
        </View>
      </View>
    </Modal>
  );
}
