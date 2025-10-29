import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput } from "react-native";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function EditProfilePage() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  return (
    <Screen>
      <View className="w-full h-full px-4">
        <View className="h-20" />
        <View className="mx-6 flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-[22px] font-extrabold">
            Edit Profile Information
          </Text>
          <View className="w-[25px]" />
        </View>

        <View className="mt-8 mx-2">
          <Text className="text-lg font-bold text-gray-300 mb-1">Full Name</Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your full name here"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
          />
        </View>
        <View className="mt-4 mx-2">
          <Text className="text-lg font-bold text-gray-300 mb-1">
            Email Address
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your email address here"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View className="mt-4 mx-2">
          <Text className="text-lg font-bold text-gray-300 mb-1">
            Phone Number
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your phone number here"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
          />
        </View>
        <View className="mx-2 mt-auto mb-20">
          <PrimaryButton title="Save Changes" onPress={() => {}} />
        </View>
      </View>
    </Screen>
  );
}
