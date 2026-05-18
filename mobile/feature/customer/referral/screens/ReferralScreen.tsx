import { ScrollView } from "react-native";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useReferral } from "../hooks";
import {
  ReferralHeader,
  HeroSection,
  StatsCards,
  ReferralCodeCard,
  ShareButtons,
  HowItWorksSection,
  RewardDetailsCard,
} from "../components";

export default function ReferralScreen() {
  const {
    referralCode,
    totalReferrals,
    totalEarned,
    codeCopied,
    handleCopyCode,
    handleShare,
    handleWhatsAppShare,
    handleTwitterShare,
    handleFacebookShare,
    handleGoBack,
  } = useReferral();

  return (
    <ThemedView className="flex-1 bg-black">
      <ReferralHeader onBack={handleGoBack} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <HeroSection />

        <StatsCards totalReferrals={totalReferrals} totalEarned={totalEarned} />

        <ReferralCodeCard
          referralCode={referralCode}
          codeCopied={codeCopied}
          onCopy={handleCopyCode}
        />

        <ShareButtons
          onWhatsApp={handleWhatsAppShare}
          onTwitter={handleTwitterShare}
          onFacebook={handleFacebookShare}
          onMore={handleShare}
        />

        <HowItWorksSection />

        <RewardDetailsCard />
      </ScrollView>
    </ThemedView>
  );
}
