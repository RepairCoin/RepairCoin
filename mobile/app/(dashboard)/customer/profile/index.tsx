import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, Alert } from "react-native";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/store/authStore";
import {
  useCustomer,
  useUpdateCustomerProfile,
} from "@/hooks/useCustomerQueries";

export default function EditProfilePage() {
  const { account } = useAuthStore();
  const { data: customerData } = useCustomer(account?.address);
  const updateProfileMutation = useUpdateCustomerProfile(account?.address);

  const [name, setName] = useState<string>(customerData?.customer?.name || "");
  const [email, setEmail] = useState<string>(
    customerData?.customer?.email || ""
  );
  const [phone, setPhone] = useState<string>(
    customerData?.customer?.phone || ""
  );

  const handleSaveChanges = async () => {
    console.log(name, email, phone);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name,
        email,
        phone,
      });

      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
      console.error("Error updating profile:", error);
    }
  };

  return (
    <Screen>
      <View className="w-full h-full px-4">
        <View className="pt-16 gap-4">
          <View className="flex-row justify-between items-center">
            <AntDesign name="left" color="white" size={18} onPress={goBack} />
            <Text className="text-white text-2xl font-extrabold">
              Edit Profile Information
            </Text>
            <View className="w-[25px]" />
          </View>
        </View>
        <View className="mt-8 mx-2">
          <Text className="text-base font-bold text-gray-300 mb-1">
            Full Name
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your full name here"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
          />
        </View>
        <View className="mt-4 mx-2">
          <Text className="text-base font-bold text-gray-300 mb-1">
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
          <Text className="text-base font-bold text-gray-300 mb-1">
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
        <View className="mx-2 mt-auto mb-8">
          <PrimaryButton
            title={
              updateProfileMutation.isPending ? "Saving..." : "Save Changes"
            }
            onPress={handleSaveChanges}
            loading={updateProfileMutation.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
