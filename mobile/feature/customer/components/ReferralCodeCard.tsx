import { View, Text, Pressable } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";

interface ReferralCodeCardProps {
  referralCode: string;
  codeCopied: boolean;
  onCopy: () => void;
}

export default function ReferralCodeCard({
  referralCode,
  codeCopied,
  onCopy,
}: ReferralCodeCardProps) {
  return (
    <View className="px-5 mb-6">
      <Text className="text-white text-lg font-semibold mb-3">
        Your Referral Code
      </Text>
      <Pressable
        onPress={onCopy}
        className={`rounded-2xl p-5 border-2 border-dashed ${
          codeCopied
            ? "bg-[#FFCC00] border-[#FFCC00]"
            : "bg-zinc-900 border-[#FFCC00]"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {codeCopied ? (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#000" />
                <Text className="text-black font-bold text-lg ml-2">
                  Copied to clipboard!
                </Text>
              </>
            ) : (
              <Text className="text-[#FFCC00] text-2xl font-bold tracking-widest">
                {referralCode}
              </Text>
            )}
          </View>
          {!codeCopied && (
            <View className="bg-[#FFCC00]/20 px-3 py-1.5 rounded-full flex-row items-center">
              <Feather name="copy" size={14} color="#FFCC00" />
              <Text className="text-[#FFCC00] text-sm font-medium ml-1">
                Copy
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}
