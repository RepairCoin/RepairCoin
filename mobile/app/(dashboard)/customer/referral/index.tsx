import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Share,
  Alert,
  Linking,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  Feather,
} from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { ThemedView } from "@/components/ui/ThemedView";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

export default function ReferralScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { data: customerData } = useGetCustomerByWalletAddress(account?.address);

  const [codeCopied, setCodeCopied] = useState<boolean>(false);

  const referralCode = customerData?.customer?.referralCode || "LOADING...";
  const totalReferrals = customerData?.customer?.referralCount || 0;
  const totalEarned = totalReferrals * 25;

  const referralMessage = `Join RepairCoin and earn rewards on every repair! Use my referral code: ${referralCode} to get 10 RCN bonus on your first repair. Download now!`;

  const handleCopyCode = async () => {
    if (referralCode && referralCode !== "LOADING...") {
      await Clipboard.setStringAsync(referralCode);
      setCodeCopied(true);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: referralMessage,
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const handleWhatsAppShare = () => {
    const url = `whatsapp://send?text=${encodeURIComponent(referralMessage)}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("WhatsApp not installed", "Please install WhatsApp to share.");
        }
      })
      .catch((err) => console.log("WhatsApp error:", err));
  };

  const handleTwitterShare = () => {
    const url = `twitter://post?message=${encodeURIComponent(referralMessage)}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(referralMessage)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(webUrl);
        }
      })
      .catch(() => Linking.openURL(webUrl));
  };

  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(referralMessage)}`;
    Linking.openURL(url);
  };

  useEffect(() => {
    if (codeCopied) {
      const timer = setTimeout(() => {
        setCodeCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [codeCopied]);

  const howItWorksSteps = [
    {
      icon: "share-social",
      title: "Share Your Code",
      description: "Share your unique referral code with friends and family",
    },
    {
      icon: "person-add",
      title: "They Sign Up",
      description: "Your friend registers using your referral code",
    },
    {
      icon: "construct",
      title: "First Repair",
      description: "They complete their first repair service",
    },
    {
      icon: "gift",
      title: "Both Earn Rewards",
      description: "You get 25 RCN, they get 10 RCN!",
    },
  ];

  return (
    <ThemedView className="flex-1 bg-black">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-bold ml-2">
            Refer & Earn
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Hero Section */}
        <View className="px-5 mb-6">
          <LinearGradient
            colors={["#FFCC00", "#FFE066"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-3xl p-6 overflow-hidden"
          >
            {/* Decorative circles */}
            <View
              className="absolute w-40 h-40 rounded-full border-[24px] border-black/5"
              style={{ right: -40, top: -40 }}
            />
            <View
              className="absolute w-24 h-24 rounded-full border-[16px] border-black/5"
              style={{ right: 60, bottom: -20 }}
            />

            <View className="items-center">
              <View className="bg-black/10 rounded-full p-4 mb-4">
                <MaterialCommunityIcons name="gift-outline" size={40} color="#000" />
              </View>
              <Text className="text-black text-2xl font-bold text-center">
                Invite Friends, Earn Rewards!
              </Text>
              <Text className="text-black/70 text-center mt-2 text-base">
                Share your code and earn 25 RCN for every{"\n"}friend who completes their first repair
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Cards */}
        <View className="px-5 mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <View className="bg-[#FFCC00]/20 w-10 h-10 rounded-full items-center justify-center mb-3">
                <FontAwesome5 name="users" size={18} color="#FFCC00" />
              </View>
              <Text className="text-gray-400 text-sm">Total Referrals</Text>
              <Text className="text-white text-2xl font-bold">{totalReferrals}</Text>
            </View>
            <View className="flex-1 bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <View className="bg-[#FFCC00]/20 w-10 h-10 rounded-full items-center justify-center mb-3">
                <MaterialCommunityIcons name="hand-coin" size={20} color="#FFCC00" />
              </View>
              <Text className="text-gray-400 text-sm">RCN Earned</Text>
              <Text className="text-[#FFCC00] text-2xl font-bold">{totalEarned}</Text>
            </View>
          </View>
        </View>

        {/* Referral Code Section */}
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            Your Referral Code
          </Text>
          <Pressable
            onPress={handleCopyCode}
            className={`rounded-2xl p-5 border-2 border-dashed ${
              codeCopied ? "bg-[#FFCC00] border-[#FFCC00]" : "bg-zinc-900 border-[#FFCC00]"
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
                  <>
                    <Text className="text-[#FFCC00] text-2xl font-bold tracking-widest">
                      {referralCode}
                    </Text>
                  </>
                )}
              </View>
              {!codeCopied && (
                <View className="bg-[#FFCC00]/20 px-3 py-1.5 rounded-full flex-row items-center">
                  <Feather name="copy" size={14} color="#FFCC00" />
                  <Text className="text-[#FFCC00] text-sm font-medium ml-1">Copy</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>

        {/* Share Section */}
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            Share via
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleWhatsAppShare}
              className="flex-1 bg-[#25D366] rounded-xl py-4 flex-row items-center justify-center"
            >
              <FontAwesome5 name="whatsapp" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">WhatsApp</Text>
            </Pressable>
            <Pressable
              onPress={handleTwitterShare}
              className="flex-1 bg-[#1DA1F2] rounded-xl py-4 flex-row items-center justify-center"
            >
              <FontAwesome5 name="twitter" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Twitter</Text>
            </Pressable>
          </View>
          <View className="flex-row gap-3 mt-3">
            <Pressable
              onPress={handleFacebookShare}
              className="flex-1 bg-[#1877F2] rounded-xl py-4 flex-row items-center justify-center"
            >
              <FontAwesome5 name="facebook-f" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Facebook</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              className="flex-1 bg-zinc-800 rounded-xl py-4 flex-row items-center justify-center"
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">More</Text>
            </Pressable>
          </View>
        </View>

        {/* How It Works Section */}
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-4">
            How It Works
          </Text>
          <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            {howItWorksSteps.map((step, index) => (
              <View key={index}>
                <View className="flex-row items-start">
                  <View className="bg-[#FFCC00] w-10 h-10 rounded-full items-center justify-center mr-4">
                    <Ionicons name={step.icon as any} size={20} color="#000" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">
                      {step.title}
                    </Text>
                    <Text className="text-gray-400 text-sm mt-1">
                      {step.description}
                    </Text>
                  </View>
                </View>
                {index < howItWorksSteps.length - 1 && (
                  <View className="ml-5 border-l-2 border-dashed border-zinc-700 h-6 my-2" />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Rewards Info */}
        <View className="px-5 mb-6">
          <View className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-5 border border-zinc-800">
            <View className="flex-row items-center mb-3">
              <Ionicons name="information-circle" size={24} color="#FFCC00" />
              <Text className="text-white font-semibold text-base ml-2">
                Reward Details
              </Text>
            </View>
            <View className="flex-row items-center justify-between bg-zinc-800/50 rounded-xl p-4 mb-2">
              <Text className="text-gray-300">You receive</Text>
              <Text className="text-[#FFCC00] font-bold text-lg">25 RCN</Text>
            </View>
            <View className="flex-row items-center justify-between bg-zinc-800/50 rounded-xl p-4">
              <Text className="text-gray-300">Your friend receives</Text>
              <Text className="text-[#FFCC00] font-bold text-lg">10 RCN</Text>
            </View>
            <Text className="text-gray-500 text-xs text-center mt-3">
              Rewards are credited after your friend completes their first repair
            </Text>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
