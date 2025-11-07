import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Image, ScrollView } from "react-native";
import {
  Entypo,
  Feather,
  Fontisto,
  MaterialCommunityIcons,
  Octicons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@/store/authStore";
import { useCustomer } from "@/hooks";

type HorizontalCardProps = {
  label: string;
  Icon: any;
  number: number;
};

type CopyableFieldProps = {
  value: string;
  isCopied: boolean;
  handleCopyValue: () => void;
};

const HorizontalCard = ({ label, Icon, number }: HorizontalCardProps) => (
  <View className="flex-1 h-28 rounded-2xl overflow-hidden m-2">
    <LinearGradient
      colors={["#373737", "#121212"]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1 h-full p-4 relative"
    >
      <View
        className="w-48 h-48 border-[#141414] border-[40px] rounded-full absolute"
        style={{
          top: -25,
          left: 100,
        }}
      />
      <View className="flex-col justify-center px-2 h-full">
        <View className="flex-row items-center justify-between w-full">
          <Text className="text-[#FFCC00] text-sm font-bold">{label}</Text>
          {Icon}
        </View>
        <Text className="text-white text-2xl mt-2 font-semibold">{number}</Text>
      </View>
    </LinearGradient>
  </View>
);

const CopyableField = ({
  value,
  isCopied,
  handleCopyValue,
}: CopyableFieldProps) => {
  const displayValue =
    value.length > 26 ? `${value.substring(0, 26)}...` : value;

  return (
    <Pressable
      onPress={handleCopyValue}
      className={`p-4 ${
        isCopied
          ? "bg-[#FFCC00] justify-center"
          : "border-dashed justify-between"
      } border-2 border-[#FFCC00] flex-row  rounded-xl`}
    >
      {isCopied ? (
        <Text className="text-base text-white font-semibold">
          <Entypo name="check" color="#fff" size={18} />
          {"  "}Code copied to clipboard
        </Text>
      ) : (
        <React.Fragment>
          <Text className="text-base text-[#FFCC00] font-semibold">
            {displayValue}
          </Text>
          <Text className="text-base text-[#ffcc00a2] font-semibold">
            Tap to copy
          </Text>
        </React.Fragment>
      )}
    </Pressable>
  );
};

export default function ReferralTab() {
  const { account } = useAuthStore();
  const { data: customerData } = useCustomer(account?.address);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  const referralData = {
    totalReferrals: customerData?.customer?.referralCount || 0,
    successfulReferrals: customerData?.customer?.referralCount || 0,
    pendingReferrals: 0,
    totalEarned: (customerData?.customer?.referralCount || 0) * 25,
    referralCode: customerData?.customer?.referralCode || "",
    referralLink: customerData?.customer?.referralCode
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/customer/register?ref=${customerData?.customer?.referralCode}`
      : "",
  };

  const horizontalCardList: HorizontalCardProps[] = [
    {
      label: "Total Referrals",
      Icon: <Octicons name="people" color="#ffcc00" size={22} />,
      number: referralData.totalReferrals,
    },
    {
      label: "RCN Earned",
      Icon: (
        <MaterialCommunityIcons
          name="hand-coin-outline"
          color="#ffcc00"
          size={22}
        />
      ),
      number: referralData.totalEarned,
    },
    {
      label: "Pending\nReferrals",
      Icon: <Fontisto name="clock" color="#ffcc00" size={22} />,
      number: referralData.pendingReferrals,
    },
    {
      label: "Successful\nReferrals",
      Icon: <Feather name="user-check" color="#ffcc00" size={22} />,
      number: referralData.successfulReferrals,
    },
  ];

  const handleCopyValue = async (value: string, copyItem: string) => {
    if (copyItem === "code") {
      if (!codeCopied) {
        await Clipboard.setStringAsync(value);
        setCodeCopied(true);
      }
    } else {
      if (!linkCopied) {
        await Clipboard.setStringAsync(value);
        setLinkCopied(true);
      }
    }
  };

  useEffect(() => {
    if (codeCopied) {
      const timer = setTimeout(() => {
        setCodeCopied(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [codeCopied]);

  useEffect(() => {
    if (linkCopied) {
      const timer = setTimeout(() => {
        setLinkCopied(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [linkCopied]);

  return (
    <View className="h-full w-full mt-4">
      <ScrollView className="mb-[144px]">
        <View className="h-40">
          <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
            <View
              className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
              style={{
                right: -80,
                top: -20,
              }}
            />
            <Image
              source={require("@/assets/images/customer_referral_card.png")}
              className="w-98 h-98 bottom-0 right-0 absolute"
              resizeMode="contain"
            />
            <View className="pl-4 mt-4">
              <Text className="text-black text-3xl font-extrabold mt-2">
                Referral Code
              </Text>
              <Text className="text-black/50 text-sm font-bold mt-2">
                Refer & Earn: You get 25 RCN, they get 10{"\n"}RCN on their
                first repair.
              </Text>
            </View>
          </View>
        </View>
        <View className="flex-row flex-wrap my-4 -mx-2">
          {horizontalCardList.map((props, i) => (
            <View key={i} style={{ width: "50%" }}>
              <HorizontalCard {...props} />
            </View>
          ))}
        </View>
        <Text className="text-white text-lg font-semibold mt-2 mb-4">
          Referral Code
        </Text>
        <CopyableField
          value="EKREF5368"
          handleCopyValue={() =>
            handleCopyValue(referralData.referralCode, "code")
          }
          isCopied={codeCopied}
        />
        <Text className="text-white text-lg font-semibold my-4">
          Share your link
        </Text>
        <CopyableField
          value={referralData.referralLink}
          handleCopyValue={() =>
            handleCopyValue(referralData.referralLink, "link")
          }
          isCopied={linkCopied}
        />
      </ScrollView>
    </View>
  );
}
