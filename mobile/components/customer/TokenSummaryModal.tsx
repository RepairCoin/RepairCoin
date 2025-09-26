import { AntDesign, Feather } from "@expo/vector-icons";
import { Image, Modal, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  requestClose: () => void;
};

export default function TokenSummaryModal({ visible, requestClose }: Props) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={requestClose}
    >
      <View className="w-full h-full items-center justify-center bg-black/50 px-5">
        <View className="w-full px-5 py-6 bg-[#1A1A1C] rounded-2xl shadow-lg gap-4 relative overflow-hidden">
          <View className="w-[250px] h-[250px] border-[45px] border-[#141414] rounded-full absolute left-[55%] top-[52%]" />
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-xl font-semibold">
              Token Summary
            </Text>
            <Pressable
              onPress={requestClose}
              className="w-8 h-8 justify-center items-center rounded-full bg-white"
            >
              <Feather name="x" color="#000" size={20} />
            </Pressable>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-white text-lg">Lifttime Earned:</Text>
            <Text className="text-white text-lg">10RCN</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-white text-lg">Total Redeemed:</Text>
            <Text className="text-white text-lg">10RCN</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-white text-lg">Redeemable Balance:</Text>
            <Text className="text-white text-lg">10RCN</Text>
          </View>
          <View className="w-full h-0.5 bg-[#535353]" />
          <View className="flex-row justify-between">
            <Text className="text-white text-lg">Total Balance</Text>
            <Text className="text-[#FFCC00] text-2xl font-extrabold">
              10RCN
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
