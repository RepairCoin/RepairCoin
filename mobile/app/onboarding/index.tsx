import { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Screen from '@/components/Screen';
import PrimaryButton from '@/components/PrimaryButton';
import { Link, useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// const heroDots = require('@/assets/images/hero-dots.png');
const girl = require('@/assets/images/shop_girl.png');
const guy = require('@/assets/images/shop_boy.png');
const globe = require('@/assets/images/global_spin.png');

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  cta: string;
  img: any;
  buttonType?: 'next' | 'connect';
};

export default function Onboarding() {
  const router = useRouter();
  const flatRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const slides: Slide[] = useMemo(
    () => [
      {
        key: '1',
        title: 'Join the revolution in\ndevice repair loyalty',
        subtitle: 'Reward your clients, grow your business, and stand out from competitors.',
        cta: 'Next',
        img: guy,
      },
      {
        key: '2',
        title: 'Smart Loyalty for\nEveryday Repairs',
        subtitle:
          'From cracked screens to car service, every repair now comes with real value back to you.',
        cta: 'Next',
        img: girl,
      },
      {
        key: '3',
        title: 'One Community,\nEndless Rewards',
        subtitle:
          'From phones to cars to salons — RepairCoin is changing how the world sees loyalty.',
        cta: 'Connect Wallet',
        img: globe,
        buttonType: 'connect',
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
    //   router.push('/wallet-connect');
    }
  }, [index, slides.length, router]);

  return (
    <Screen>
      <View className="flex-[0.60]">
        <Image
          source={slides[index]?.img}
          contentFit="cover"
          className="h-full w-full"
          transition={200}
        />
        <Image
        //   source={heroDots}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full opacity-70"
          contentFit="cover"
        />
      </View>

      <View className="flex-[0.40] px-6 pb-8">
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
            <View style={{ width }} className="flex-1 justify-between py-6">
              <View>
                <Text className="text-2xl font-extrabold text-white leading-snug">
                  {item.title}
                </Text>
                <Text className="mt-3 text-sm leading-5 text-neutral-300">
                  {item.subtitle}
                </Text>
              </View>

              <View className="mt-6">
                {item.buttonType === 'connect' ? (
                  <Link href="/" asChild>
                    <PrimaryButton title={item.cta} />
                  </Link>
                ) : (
                  <PrimaryButton title={item.cta} onPress={goNext} />
                )}
              </View>
            </View>
          )}
        />

        <View className="mt-4 flex-row items-center justify-center gap-2">
          {slides.map((_, i) => (
            <View
              key={i}
              className={`h-1.5 rounded-full ${i === index ? 'w-8 bg-rc-yellow' : 'w-2 bg-white/40'}`}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
