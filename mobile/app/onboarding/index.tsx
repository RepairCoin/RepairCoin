import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  View,
  Image,
} from "react-native";
import Screen from "@/components/Screen";
import PrimaryButton from "@/components/PrimaryButton";
import { Link, useRouter } from "expo-router";

const { width } = Dimensions.get("window");

// const heroDots = require('@/assets/images/hero-dots.png');
const girl = require("@/assets/images/shop_girl.png");
const guy = require("@/assets/images/shop_boy.png");
const globe = require("@/assets/images/global_spin.png");

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  cta: string;
  img: any;
  buttonType?: "next" | "connect";
};

export default function Onboarding() {
  const router = useRouter();
  const flatRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const slides: Slide[] = useMemo(
    () => [
      {
        key: "1",
        title: "Join the revolution in\ndevice repair loyalty",
        subtitle:
          "Reward your clients, grow your business, and\nstand out from competitors.",
        cta: "Next",
        img: guy,
      },
      {
        key: "2",
        title: "Smart Loyalty for\nEveryday Repairs",
        subtitle:
          "From cracked screens to car service, every\nrepair now comes with real value back to you.",
        cta: "Next",
        img: girl,
      },
      {
        key: "3",
        title: "One Community,\nEndless Rewards",
        subtitle:
          "From phones to cars to salons — RepairCoin is\nchanging how the world sees loyalty.",
        cta: "Connect Wallet",
        img: globe,
        buttonType: "connect",
      },
    ],
    []
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setIndex(Math.round(x / width));
  }, []);

  const goNext = useCallback(() => {
    if (index < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      router.push("/auth/wallet");
    }
  }, [index, slides.length, router]);

  return (
    <Screen>
      <FlatList
        ref={flatRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1">
            <Image
              source={item.img}
              resizeMode="cover"
              className="h-[70%] w-full"
            />

            <View className="py-8 px-4 mt-4">
              <Text className="font-extrabold text-white text-center leading-snug text-[30px] mt-2">
                {item.title}
              </Text>
              <Text className="mt-8 mx-4 text-lg leading-5 text-neutral-300 text-center text-[16px]">
                {item.subtitle}
              </Text>
            </View>
          </View>
        )}
      />
      <View className="mb-20">
        <View className="flex-row mt-auto mb-6 items-center justify-center gap-2">
          {slides.map((_, i) => (
            <View
              key={i}
              className={`h-1.5 rounded-full ${i === index ? "w-10 bg-[#FFCC00]" : "w-4 bg-[#D9D9D9]"}`}
            />
          ))}
        </View>

        <View className="mx-8">
          {slides[index].buttonType === "connect" ? (
            <Link href="/auth/wallet" asChild>
              <PrimaryButton title={slides[index].cta} />
            </Link>
          ) : (
            <PrimaryButton title={slides[index].cta} onPress={goNext} />
          )}
        </View>
      </View>
    </Screen>
  );
}
