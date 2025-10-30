import { AntDesign, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, Pressable } from "react-native";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function ChangePrivateKeyPage() {
  const [key, setKey] = useState<string>("");

  return (
    <View className="w-full h-full bg-black px-4">
      <View className="h-20" />
      <View className="mx-6 flex-row justify-between items-center">
        <AntDesign name="left" color="white" size={25} onPress={goBack} />
        <Text className="text-white text-[22px] font-extrabold">
          Encryption Key
        </Text>
        <View className="w-[25px]" />
      </View>

      <Text className="text-white font-extrabold text-3xl text-center mt-20">
        Your Private Key
      </Text>
      <Text className="text-white/50 text-2xl text-center mt-4">
        For your eyes. Do not share
      </Text>

      <TextInput
        className="w-full h-40 bg-[#212121] text-white rounded-xl px-3 py-2 text-lg mt-4"
        multiline={true}
        numberOfLines={5}
        value={key}
        onChangeText={setKey}
        style={{
          textAlignVertical: "top",
        }}
      />

      <Pressable className="flex-row justify-center items-center mt-4">
        <Feather name="copy" color="#212121" size={24} />
        <Text className="text-[#212121] text-2xl ml-2">Copy to Clipboard</Text>
      </Pressable>

      <View className="mx-2 mt-auto mb-20 items-center gap-4">
        <MaterialCommunityIcons name="shield-check" color="#222222" size={24} />
        <Text className="text-white/25 text-lg text-center">Your Private Key can be used to access everything in your wallet. Don&apos;t share it with anyone.</Text>
        <PrimaryButton title="Done" onPress={() => {}} />
      </View>
    </View>
  );
}
