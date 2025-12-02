import { useState } from "react";
import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, TextInput, Platform, ScrollView, Alert } from "react-native";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { ThemedView } from "@/components/ui/ThemedView";
import { useAuthStore } from "@/store/auth.store";
import { useUpdateShopDetails } from "@/hooks";
import { useShop } from "@/hooks/shop/useShop";

export default function EditShopProfilePage() {
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData } = useGetShopByWalletAddress(
    account?.address || ""
  );
  const updateShopMutation = useUpdateShopDetails(account?.address || "");

  const [shopFormData, setShopFormData] = useState({
    name: shopData?.name || "",
    email: shopData?.email || "",
    phone: shopData?.phone || "",
    address: shopData?.address || "",
    facebook: shopData?.facebook || "",
    twitter: shopData?.twitter || "",
    instagram: shopData?.instagram || "",
    website: shopData?.website || "",
    walletAddress: shopData?.walletAddress || "",
  });

  const handleSaveChanges = async () => {
    if (!shopData?.shopId) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shopFormData.email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    try {
      await updateShopMutation.mutateAsync({
        shopId: shopData.shopId,
        shopData: {
          ...shopFormData,
          active: shopData.active,
          crossShopEnabled: shopData.crossShopEnabled,
          verified: shopData.verified,
          joinDate: shopData.joinDate,
          operational_status: shopData.operational_status,
        },
      });
      Alert.alert("Success", "Shop details updated successfully", [
        { text: "OK", onPress: () => goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update shop details");
    }
  };

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

        <ScrollView
          className="flex-1 mt-8"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <View className="mx-2">
            <Text className="text-base font-bold text-gray-300 mb-1">
              Shop Name
            </Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter your shop name here"
              placeholderTextColor="#999"
              value={shopFormData.name}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, name: text })
              }
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
              keyboardType="email-address"
              autoCapitalize="none"
              value={shopFormData.email}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, email: text })
              }
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
              keyboardType="phone-pad"
              value={shopFormData.phone}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, phone: text })
              }
            />
          </View>

          <View className="mt-4 mx-2">
            <Text className="text-base font-bold text-gray-300 mb-1">
              Wallet Address
            </Text>
            <TextInput
              className="w-full h-12 bg-gray-200 text-gray-500 rounded-xl px-3 py-2 text-base"
              placeholder="Enter your wallet address here"
              placeholderTextColor="#999"
              autoCapitalize="none"
              value={shopFormData.walletAddress}
              editable={false}
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
              value={shopFormData.address}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, address: text })
              }
            />
          </View>

          <View className="mt-4 mx-2">
            <Text className="text-base font-bold text-gray-300 mb-1">
              Website
            </Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter your website URL here"
              placeholderTextColor="#999"
              keyboardType="url"
              autoCapitalize="none"
              value={shopFormData.website}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, website: text })
              }
            />
          </View>

          <View className="mt-4 mx-2">
            <Text className="text-base font-bold text-gray-300 mb-1">
              Facebook
            </Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter your Facebook profile URL"
              placeholderTextColor="#999"
              keyboardType="url"
              autoCapitalize="none"
              value={shopFormData.facebook}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, facebook: text })
              }
            />
          </View>

          <View className="mt-4 mx-2">
            <Text className="text-base font-bold text-gray-300 mb-1">
              Twitter
            </Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter your Twitter handle or URL"
              placeholderTextColor="#999"
              keyboardType="url"
              autoCapitalize="none"
              value={shopFormData.twitter}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, twitter: text })
              }
            />
          </View>

          <View className="mt-4 mx-2">
            <Text className="text-base font-bold text-gray-300 mb-1">
              Instagram
            </Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter your Instagram handle or URL"
              placeholderTextColor="#999"
              keyboardType="url"
              autoCapitalize="none"
              value={shopFormData.instagram}
              onChangeText={(text) =>
                setShopFormData({ ...shopFormData, instagram: text })
              }
            />
          </View>
          <View className="absolute bottom-8 left-0 right-0 mx-6">
            <PrimaryButton
              title={"Save Changes"}
              onPress={handleSaveChanges}
              loading={updateShopMutation.isPending}
            />
          </View>
        </ScrollView>
      </View>
    </ThemedView>
  );
}
