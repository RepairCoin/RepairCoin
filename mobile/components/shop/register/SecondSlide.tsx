import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import RNPickerSelect from "react-native-picker-select";
import Screen from "@/components/Screen";
import { CompanySize, MonthlyRevenue } from "@/utilities/GlobalTypes";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  shopId: string;
  setShopId: (arg0: string) => void;
  companyName: string;
  setCompanyName: (arg0: string) => void;
  companySize: CompanySize;
  setCompanySize: (arg0: CompanySize) => void;
  monthlyRevenue: MonthlyRevenue;
  setMonthlyRevenue: (arg0: MonthlyRevenue) => void;
  websiteURL: string;
  setWebsiteURL: (arg0: string) => void;
  referral: string;
  setReferral: (arg0: string) => void;
};

export default function SecondShopRegisterSlide({
  handleGoBack,
  shopId,
  setShopId,
  companyName,
  setCompanyName,
  companySize,
  setCompanySize,
  monthlyRevenue,
  setMonthlyRevenue,
  websiteURL,
  setWebsiteURL,
  referral,
  setReferral,
  handleGoNext,
}: Props) {
  return (
    <Screen>
      <View className="px-10 py-20 w-[100vw]">
        <AntDesign name="left" color="white" size={25} onPress={handleGoBack} />
        <Text className="text-[#FFCC00] font-bold mt-6">
          Bussiness Information
        </Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Shop ID <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Shop ID"
            placeholderTextColor="#999"
            value={shopId}
            onChangeText={setShopId}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Company Name <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Company Name"
            placeholderTextColor="#999"
            value={companyName}
            onChangeText={setCompanyName}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Company Size <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <RNPickerSelect
            value={companySize}
            onValueChange={setCompanySize}
            items={[
              { label: "1-10 employees", value: "1-10" },
              { label: "11-50 employees", value: "11-50" },
              { label: "51-100 employees", value: "51-100" },
              { label: "100+ employees", value: "100+" }
            ]}
            placeholder={{ label: "Select Company Size", value: "" }}
            style={pickerSelectStyles}
            Icon={() => (
              <AntDesign name="down" />
            )}
            useNativeAndroidPickerStyle={false}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Monthly Revenue <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <RNPickerSelect
            value={monthlyRevenue}
            onValueChange={setMonthlyRevenue}
            items={[
              { label: "Less than $10,000", value: "<10k" },
              { label: "$10,000 - $50,000", value: "10k-50k" },
              { label: "$50,000 - $100,000", value: "50k-100k" },
              { label: "More than $100,000", value: "100k+" }
            ]}
            placeholder={{ label: "Select Monthly Revenue", value: "" }}
            style={pickerSelectStyles}
            Icon={() => (
              <AntDesign name="down" />
            )}
            useNativeAndroidPickerStyle={false}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Website URL <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your business website url"
            placeholderTextColor="#999"
            value={websiteURL}
            onChangeText={setWebsiteURL}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Referral (Optional)
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Who referred you to RepairCoin"
            placeholderTextColor="#999"
            value={referral}
            onChangeText={setReferral}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Enter the name or company that referred you.
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