import { HowItWorksStep } from "../types";

export const REFERRER_REWARD = 25;
export const REFEREE_REWARD = 10;
export const COPY_FEEDBACK_DURATION = 2000;

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
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

export const HERO_GRADIENT_COLORS = ["#FFCC00", "#FFE066"] as const;
