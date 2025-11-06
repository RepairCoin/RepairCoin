import { ScrollView, Text, TextInput , View, Image } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { Checkbox } from "expo-checkbox";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import type { ShopRegistrationFormData } from "@/app/(auth)/register/shop/index";

type Props = {
  handleGoBack: () => void;
  handleSubmit: () => void;
  formData: ShopRegistrationFormData;
  updateFormData: <K extends keyof ShopRegistrationFormData>(field: K, value: ShopRegistrationFormData[K]) => void;
};

export default function FourthShopRegisterSlide({
  handleGoBack,
  handleSubmit,
  formData,
  updateFormData,
}: Props) {
  return (
    <Screen>
      <ScrollView>
        <View className="px-10 py-20 w-[100vw]">
          <AntDesign
            name="left"
            color="white"
            size={25}
            onPress={handleGoBack}
          />
          <Text className="text-[#FFCC00] font-bold mt-6">
            Additional Information{" "}
            <Text className="text-white">(Optional)</Text>
          </Text>
          <View className="mt-4">
            <Text className="text-sm text-gray-300 mb-1">State / Province</Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter State / Province"
              placeholderTextColor="#999"
              value={formData.location.state}
              onChangeText={(value) => updateFormData('location', {...formData.location, state: value})}
            />
          </View>
          <View className="mt-4">
            <Text className="text-sm text-gray-300 mb-1">
              Zip / Postal Code
            </Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter Zip / Postal Code"
              placeholderTextColor="#999"
              value={formData.location.zipCode}
              onChangeText={(value) => updateFormData('location', {...formData.location, zipCode: value})}
            />
          </View>
          <View className="mt-4">
            <Text className="text-sm text-gray-300 mb-1">
              FixFlow Shop ID (Optional)
            </Text>
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="Enter FixFlow Shop ID"
              placeholderTextColor="#999"
              value={formData.fixflowShopId}
              onChangeText={(value) => updateFormData('fixflowShopId', value)}
            />
            <Text className="text-sm text-gray-300 mt-2">
              If you use FixFIow on your repair business
            </Text>
          </View>
          <Text className="text-[#FFCC00] font-bold mt-14">
            Terms and Conditions
          </Text>
          <View className="mt-4">
            <View className="flex-row items-center mt-4">
              <Image source={require("@/assets/icons/shield-checkmark.png")} />
              <Text className="ml-4 text-white text-[16px]">
                Your shop will need admin verification{"\n"}
                before activation
              </Text>
            </View>
            <View className="flex-row items-center mt-4">
              <Image source={require("@/assets/icons/shield-checkmark.png")} />
              <Text className="ml-4 text-white text-[16px]">
                You'll be able to purchase RCN at $100{"\n"}each
              </Text>
            </View>
            <View className="flex-row items-center mt-4">
              <Image source={require("@/assets/icons/shield-checkmark.png")} />
              <Text className="ml-4 text-white text-[16px]">
                Tier bonuses wil be automatically deducted{"\n"}from your RCN
                Balance-
              </Text>
            </View>
            <View className="flex-row items-center mt-4">
              <Image source={require("@/assets/icons/shield-checkmark.png")} />
              <Text className="ml-4 text-white text-[16px]">
                Cross hop redemption can be enabled after{"\n"}
                verification
              </Text>
            </View>
            <View className="flex-row items-center mt-4">
              <Image source={require("@/assets/icons/shield-checkmark.png")} />
              <Text className="ml-4 text-white text-[16px]">
                All transaction are recorded on the{"\n"}blockchain
              </Text>
            </View>
            <View className="flex-row items-center mt-4">
              <Image source={require("@/assets/icons/shield-checkmark.png")} />
              <Text className="ml-4 text-white text-[16px]">
                You agree to comply with all RepairCoin{"\n"}network policies
              </Text>
            </View>
            <View className="flex-row items-center my-8">
              <Checkbox
                value={formData.acceptTerms}
                onValueChange={(value) => updateFormData('acceptTerms', value)}
                style={{
                  borderRadius: 8,
                  backgroundColor: formData.acceptTerms ? "#c8f7c5" : "#f5f5f5",
                }}
              />
              <Text className="ml-4 text-white text-[16px]">
                I confirm that I have read and accept the terms and conditions
                and privacy policy.
              </Text>
            </View>
          </View>
          <PrimaryButton
            title="Register Shop"
            onPress={handleSubmit}
            disabled={!formData.acceptTerms}
            className="mt-8"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
