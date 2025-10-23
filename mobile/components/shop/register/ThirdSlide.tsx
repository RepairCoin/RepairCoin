import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import RNPickerSelect from "react-native-picker-select";
import Screen from "@/components/ui/Screen";
import { CompanySize, MonthlyRevenue } from "@/utilities/GlobalTypes";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  street: string;
  setStreet: (arg0: string) => void;
  city: string;
  setCity: (arg0: string) => void;
  country: string;
  setCountry: (arg0: string) => void;
  walletAddress: string;
  setWalletAddress: (arg0: string) => void;
  reimbursementAddress: string;
  setReimbursementAddress: (arg0: string) => void;
};

export default function ThirdShopRegisterSlide({
  handleGoBack,
  handleGoNext,
  street,
  setStreet,
  city,
  setCity,
  country,
  setCountry,
  walletAddress,
  setWalletAddress,
  reimbursementAddress,
  setReimbursementAddress
}: Props) {
  return (
    <Screen>
      <View className="px-10 py-20 w-[100vw]">
        <AntDesign name="left" color="white" size={25} onPress={handleGoBack} />
        <Text className="text-[#FFCC00] font-bold mt-6">
          Additional Information
        </Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
           Street Address <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Street Address"
            placeholderTextColor="#999"
            value={street}
            onChangeText={setStreet}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
           City <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter City"
            placeholderTextColor="#999"
            value={city}
            onChangeText={setCity}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
           Country <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Country"
            placeholderTextColor="#999"
            value={country}
            onChangeText={setCountry}
          />
        </View>
        <Text className="text-[#FFCC00] font-bold mt-14">
          Wallet Information
        </Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Connected Wallet <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your wallet address..."
            placeholderTextColor="#999"
            value={walletAddress}
            onChangeText={setWalletAddress}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Used for shop operations and token management
          </Text>
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1 mt-2">
            Reimbursement Address (Optional)
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter reimbursement address..."
            placeholderTextColor="#999"
            value={reimbursementAddress}
            onChangeText={setReimbursementAddress}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Where to receive payments for token redemptions
          </Text>
        </View>

        <Pressable
          className="ml-auto flex-row items-center mt-10"
          onPress={handleGoNext}
        >
          <Text className="text-white text-base mr-2">
            Continue Registration
          </Text>
          <Ionicons name="arrow-forward" color="yellow" size={20} />
        </Pressable>
      </View>
    </Screen>
  );
}

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    backgroundColor: "#fff",
    height: 42.3,
    borderRadius: 10.5,
    paddingHorizontal: 10
  },
  inputAndroid: {
    backgroundColor: "#fff",
    height: 42.3,
    borderRadius: 10.5,
    paddingHorizontal: 10
  },
  iconContainer: {
    top: 15,
    right: 15,
  },
  placeholder: {
    color: "#999",
  },
});