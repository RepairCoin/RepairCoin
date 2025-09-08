import FooterNote from "@/components/FooterNote";
import PrimaryButton from "@/components/PrimaryButton";
import { AntDesign } from "@expo/vector-icons";
import { View, Text, SafeAreaView } from "react-native";

export default function SuccessPage() {
  return (
    <SafeAreaView className="flex-1 items-center bg-zinc-100">
      <View className="w-[92%] md:w-[80%] lg:w-[60%] flex-1">
        <View className="mt-2 mb-2 h-10 flex-row items-center">
          <View className="h-10 w-10" />
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
            <AntDesign name="check" size={28} color="#EAB308" />
          </View>

          <Text className="text-center text-2xl font-extrabold text-zinc-800">
            Your account{"\n"}was successfully created!
          </Text>
          <Text className="mt-3 text-center text-zinc-500">
            Thanks for joining the movement. Let&apos;s turn every{"\n"}repair
            into real value.
          </Text>

          <PrimaryButton
            label="Log in"
            onPress={() => {}}
            className="mt-6 w-[80%]"
          />
          <FooterNote />
        </View>
      </View>
    </SafeAreaView>
  );
}
