import {
  Entypo,
  Feather,
  Fontisto,
  MaterialCommunityIcons,
  Octicons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { View, Text, Pressable, Image, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import DetailCard from "@/components/DetailCard";

type HorizontalCardProps = {
  label: string;
  Icon: any;
  number: string;
};

type CopyableFieldProps = {
  value: string;
  isCopied: boolean;
  handleCopyValue: () => void;
};

const HorizontalCard = ({ label, Icon, number }: HorizontalCardProps) => (
  <View className="w-44 h-32 rounded-2xl overflow-hidden mr-4">
    <LinearGradient
      colors={["#373737", "#121212"]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="w-44 h-32 p-4 relative"
    >
      <View
        className="w-48 h-48 border-[#141414] border-[40px] rounded-full absolute"
        style={{
          top: -25,
          left: 100,
        }}
      />
      <View className="flex-row justify-between items-center">
        <Text className="text-[#FFCC00] text-sm font-bold">{label}</Text>
        {Icon}
      </View>
      <Text className="text-white text-3xl mt-auto font-semibold">
        {number}
      </Text>
    </LinearGradient>
  </View>
);

const CopyableField = ({
  value,
  isCopied,
  handleCopyValue,
}: CopyableFieldProps) => (
  <Pressable
    onPress={handleCopyValue}
    className={`p-4 ${isCopied ? "bg-[#FFCC00] justify-center" : "border-dashed justify-between"} border-2 border-[#FFCC00] flex-row  rounded-xl`}
  >
    {isCopied ? (
      <Text className="text-xl text-white font-semibold">
        <Entypo name="check" color="#fff" size={18} />
        {"  "}Code copied to clipboard
      </Text>
    ) : (
      <React.Fragment>
        <Text className="text-xl text-[#FFCC00] font-semibold">{value}</Text>
        <Text className="text-lg text-[#ffcc00a2] font-semibold">
          Tap to copy
        </Text>
      </React.Fragment>
    )}
  </Pressable>
);

export default function ReferralTab() {
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  const horizontalCardList: HorizontalCardProps[] = [
    {
      label: "Total Referrals",
      Icon: <Octicons name="people" color="#ffcc00" size={24} />,
      number: "2",
    },
    {
      label: "Successful\nReferrals",
      Icon: <Feather name="user-check" color="#ffcc00" size={24} />,
      number: "2",
    },
    {
      label: "Pending\nReferrals",
      Icon: <Fontisto name="clock" color="#ffcc00" size={24} />,
      number: "0",
    },
    {
      label: "RCN Earned",
      Icon: (
        <MaterialCommunityIcons
          name="hand-coin-outline"
          color="#ffcc00"
          size={24}
        />
      ),
      number: "0",
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
      <ScrollView>
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
            <View className="pl-4 mt-8">
              <Text className="text-black text-3xl font-extrabold mt-2">
                Referral Code
              </Text>
              <Text className="text-black/50 text-[12.5px] font-bold mt-4">
                Refer & Earn: You get 25 RCN, they get 10{"\n"}RCN on their
                first repair.
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row my-4"
        >
          {[
            horizontalCardList.map((props, i) => (
              <HorizontalCard key={i} {...props} />
            )),
          ]}
        </ScrollView>
        <Text className="text-white text-xl font-semibold mt-2 mb-4">
          Referral Code
        </Text>
        <CopyableField
          value="EKREF5368"
          handleCopyValue={() => handleCopyValue("EKREF5368", "code")}
          isCopied={codeCopied}
        />
        <Text className="text-white text-xl font-semibold my-4">
          Share your link
        </Text>
        <CopyableField
          value="https://johndoe.com"
          handleCopyValue={() => handleCopyValue("https://johndoe.com", "link")}
          isCopied={linkCopied}
        />
        <View className="mt-5 gap-4">
          <DetailCard />
          <DetailCard />
          <DetailCard />
        </View>
      </ScrollView>
    </View>
  );
}
