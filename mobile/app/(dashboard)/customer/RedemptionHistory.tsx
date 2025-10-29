import RedemptionRequestCard from "@/components/customer/RedemptionRequestCard";
import RedemptionRequestFilterModal from "@/components/customer/RedemptionRequestFilterModal";
import { AntDesign, Feather, FontAwesome } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable } from "react-native";

export default function RedemptionHistory() {
  const [searchString, setSearchString] = useState<string>("");
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);

  return (
    <View className="w-full h-full bg-zinc-950">
      <View className="pt-16 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-xl font-semibold">
            Redemption Requests
          </Text>
          <View className="w-8 h-8 bg-white rounded-full items-center justify-center">
            <Feather name="download" color="#000" size={16} />
          </View>
        </View>
        <View className="flex-row justify-between">
          <View className="flex-row px-4 border-2 border-[#666] rounded-full items-center">
            <Feather name="search" color="#666" size={20} />
            <TextInput
              placeholder="Search shop here"
              placeholderTextColor="#666"
              value={searchString}
              onChangeText={setSearchString}
              keyboardType="email-address"
              className="color-[#666] ml-2 w-[70%]"
            />
          </View>
          <Pressable
            onPress={() => setFilterModalVisible(true)}
            className="flex-row px-6 border-2 border-[#666] rounded-full items-center"
          >
            <FontAwesome name="sliders" color="#666" size={20} />
          </Pressable>
        </View>
      </View>
      <ScrollView className="px-4 mt-4">
        <RedemptionRequestCard name="Jenny Wilson" success={true} />
        <RedemptionRequestCard name="Andrew Wilson" success={false} />
        <RedemptionRequestCard name="Mary Jose" success={true} />
        <RedemptionRequestCard name="Jacob Drew" success={false} />
        <RedemptionRequestCard name="Lei Anderson" success={false} />
        <RedemptionRequestCard name="Jennifer Marie" success={true} />
        <RedemptionRequestCard name="Andrew Wilson" success={false} />
        <RedemptionRequestCard name="Jenny Wilson" success={true} />
        <RedemptionRequestCard name="Mary Jose" success={true} />
      </ScrollView>
      <RedemptionRequestFilterModal
        visible={filterModalVisible}
        requestClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
}
