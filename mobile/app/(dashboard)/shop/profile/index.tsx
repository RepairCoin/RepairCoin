import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, Platform } from "react-native";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { ThemedView } from "@/components/ui/ThemedView";

export default function EditShopProfilePage() {

  return (
    <ThemedView className="h-full w-full py-14">
      <View className="w-full h-full px-4">
        <View className={`${Platform.OS === "ios" ? "pt-4" : "pt-16"} gap-4`}>
          <View className="flex-row justify-between items-center">
            <AntDesign name="left" color="white" size={18} onPress={goBack} />
            <Text className="text-white text-2xl font-extrabold">
              Edit Shop Information
            </Text>
            <View className="w-[25px]" />
          </View>
        </View>
        <View className="mt-8 mx-2">
          <Text className="text-base font-bold text-gray-300 mb-1">
            Shop Name
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your shop name here"
            placeholderTextColor="#999"
          />
        </View>
        <View className="mt-4 mx-2">
          <Text className="text-base font-bold text-gray-300 mb-1">
            Shop Address
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your shop address here"
            placeholderTextColor="#999"
          />
        </View>
        <View className="mt-4 mx-2">
          <Text className="text-base font-bold text-gray-300 mb-1">
            Shop Phone Number
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your shop phone number here"
            placeholderTextColor="#999"
          />
        </View> 
        <View className="mx-2 mt-auto mb-8">
          <PrimaryButton
            title={"Save Changes"}
            onPress={() => {}}
            loading={false}
          />
        </View>
      </View>
    </ThemedView>
  );
}
