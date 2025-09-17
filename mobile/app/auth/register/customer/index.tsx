import Screen from "@/components/Screen";
import { AntDesign, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import CountryPicker, { CountryCode } from "react-native-country-picker-modal";
import { MaskedTextInput } from "react-native-mask-text";
import PrimaryButton from "@/components/PrimaryButton";
import { router } from "expo-router";
import { RegisterAsCustomerService } from "@/services/RegisterServices";
import { useAuthStore } from "@/store/authStore";
import { EmailValidation } from "@/utilities/Validation";

export default function RegisterAsCustomerPage() {
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [dob, setDob] = useState<string>("");
  const [openDateModal, setOpenDateModal] = useState<boolean>(false);
  const [countryCode, setCountryCode] = useState<CountryCode>("US");
  const [phone, setPhone] = useState<string>("");
  const [referral, setReferral] = useState<string>("");
  const [callingCode, setCallingCode] = useState("1");

  const { address } = useAuthStore((state) => state.account);

  const handleSubmit = async () => {
    const res = await RegisterAsCustomerService({
      walletAddress: address,
      name: fullName,
      email,
      phone: `+${callingCode}${phone}`,
      referralCode: referral,
    });

    console.log(email);

    if (res.success) router.push("/auth/register/customer/Success");
  };

  const isValidate = useMemo(() => {
    const isValidateEmail = EmailValidation(email);
    return fullName || email || dob || phone || isValidateEmail;
  }, [fullName, email, dob, phone]);

  return (
    <Screen>
      <View className="px-10 py-20">
        <AntDesign name="left" color="white" size={25} onPress={goBack} />
        <Text className="text-[#FFCC00] font-extrabold text-[32px] mt-4">
          Register as Customer
        </Text>
        <Text className="text-white text-[12px] my-4">
          Create your RepairCoin account and turn every{"\n"}
          repair into rewards.
        </Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Full Name</Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Your Full Name"
            placeholderTextColor="#999"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Email</Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Date of Birth</Text>
          <Pressable
            onPress={() => setOpenDateModal(true)}
            className="flex-row items-center"
          >
            <TextInput
              className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="DD/MM/YYYY"
              value={dob}
              editable={false}
            />
            <Feather
              name="calendar"
              className="left-[-35]"
              size={20}
              color="#666"
            />
            <DateTimePickerModal
              isVisible={openDateModal}
              mode="date"
              onConfirm={(date) => {
                setDob(date.toLocaleDateString("en-GB")); // dd/mm/yyyy
                setOpenDateModal(false);
              }}
              onCancel={() => setOpenDateModal(false)}
            />
          </Pressable>
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Phone Number</Text>
          <View className="flex-row bg-white h-12 items-center px-3 rounded-xl">
            <CountryPicker
              countryCode={countryCode}
              withFilter
              withFlag
              withCallingCode
              withEmoji
              onSelect={(country) => {
                setCountryCode(country.cca2);
                setCallingCode(country.callingCode[0]);
              }}
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
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Referral Code (Optional)
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Referral Code"
            placeholderTextColor="#999"
            value={referral}
            onChangeText={setReferral}
          />
        </View>
        <Text className="text-sm text-gray-300 mt-1 mb-10">
          Earn bonus tokens when you sign up with a referral code.
        </Text>

        <PrimaryButton title="Register as Customer" onPress={handleSubmit} disabled={!isValidate} />
      </View>
    </Screen>
  );
}
