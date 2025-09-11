import { View, Text, TextInput, Pressable, Dimensions } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import CountryPicker, { CountryCode } from "react-native-country-picker-modal";
import { MaskedTextInput } from "react-native-mask-text";
import Screen from "@/components/Screen";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  firstName: string;
  setFirstName: (arg0: string) => void;
  lastName: string;
  setLastName: (arg0: string) => void;
  email: string;
  setEmail: (arg0: string) => void;
  countryCode: CountryCode;
  setCountryCode: (arg0: CountryCode) => void;
  setPhone: (arg0: string) => void;
}

export default function FirstShopRegisterSlide ({
  handleGoBack, firstName, setFirstName, lastName, setLastName, email, setEmail, countryCode, setCountryCode, setPhone, handleGoNext
}: Props) {
  return (
    <Screen>
      <View className="px-10 py-20 w-[100vw]">
        <AntDesign name="left" color="white" size={25} onPress={handleGoBack} />
        <Text className="text-[#FFCC00] font-extrabold text-[32px] mt-4">
          Register as Shop
        </Text>
        <Text className="text-white text-[12px] my-4">
          Join our partner network, attract new customers,{"\n"}
          and reward loyalty with every service you provide.
        </Text>
        <Text className="text-[#FFCC00] font-bold mt-8">Personal Information</Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">First Name{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Your First Name"
            placeholderTextColor="#999"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Last Name{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Your Last Name"
            placeholderTextColor="#999"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Email{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View className="mt-4 mb-10">
          <Text className="text-sm text-gray-300 mb-1">Phone Number{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <View className="flex-row bg-white h-12 items-center px-3 rounded-xl">
            <CountryPicker
              countryCode={countryCode}
              withFilter
              withFlag
              withCallingCode
              withEmoji
              onSelect={(country) => setCountryCode(country.cca2)}
            />
            <MaskedTextInput
              mask="(999) 999-9999"
              className="h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="(000) 000-0000"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              onChangeText={(masked, unMasked) => setPhone(masked)}
            />
          </View>
        </View>

        <Pressable className="ml-auto flex-row items-center mt-4" onPress={handleGoNext}>
          <Text className="text-white text-base mr-2">Continue Registration</Text>
          <Ionicons name="arrow-forward" color="yellow" size={20} />
        </Pressable>
      </View>
    </Screen>
  )
}