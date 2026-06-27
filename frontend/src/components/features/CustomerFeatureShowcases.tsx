"use client";

import React from "react";
import { MapPin, Calendar, Gift, Sparkles, MessageCircle, UserPlus } from "lucide-react";
import FeatureShowcase, { FeatureShowcaseProps } from "./FeatureShowcase";

const CUSTOMER_SHOWCASES: FeatureShowcaseProps[] = [
  {
    badge: "Find Partner Shops",
    badgeIcon: <MapPin className="w-5 h-5" />,
    title: (
      <>
        Discover Trusted
        <br />
        Partner Shops
      </>
    ),
    description:
      "Explore verified businesses, browse services, and connect with trusted providers near you.",
    bullets: [
      "Verified Business Profiles",
      "Nearby Shop Discovery",
      "Service Categories & Search",
      "Ratings & Customer Reviews",
    ],
    image: "/img/features/showcase-find-partner-shops.png",
    imageAlt: "FixFlow partner shop discovery",
  },
  {
    badge: "Smart Booking",
    badgeIcon: <Calendar className="w-5 h-5" />,
    title: "Book Services Easily",
    description:
      "Schedule appointments with your favorite businesses, receive real-time updates, and manage all your bookings in one convenient place.",
    bullets: [
      "Real-Time Availability",
      "Appointment Reminders",
      "Manage & Track Bookings",
    ],
    image: "/img/features/showcase-smart-booking.png",
    imageAlt: "FixFlow smart booking",
  },
  {
    badge: "Rewards Hub",
    badgeIcon: <Gift className="w-5 h-5" />,
    title: (
      <>
        Earn Rewards for
        <br />
        Every Visit
      </>
    ),
    description:
      "Get rewarded for supporting your favorite businesses. Earn points, unlock exclusive perks, and enjoy member-only benefits every time you book or shop.",
    bullets: [
      "Earn Points on Every Booking",
      "Redeem Exclusive Rewards",
      "Get Bonus Referral Rewards",
    ],
    image: "/img/features/showcase-customer-rewards-hub.png",
    imageAlt: "FixFlow customer rewards hub",
  },
  {
    badge: "AI Recommendations",
    badgeIcon: <Sparkles className="w-5 h-5" />,
    title: "Discover More With AI",
    description:
      "Get personalized recommendations for businesses, services, promotions, and rewards based on your interests, activity, and preferences.",
    bullets: [
      "Personalized Business Suggestions",
      "Recommended Services",
      "Personalized Offers & Rewards",
    ],
    image: "/img/features/showcase-ai-recommendations.png",
    imageAlt: "FixFlow AI recommendations dashboard",
  },
  {
    badge: "Stay Connected",
    badgeIcon: <MessageCircle className="w-5 h-5" />,
    title: (
      <>
        Connect With Your
        <br />
        Favorite Businesses
      </>
    ),
    description:
      "Stay in touch, get updates, ask questions and build stronger relationships with businesses you trust.",
    bullets: [
      "Direct Messaging",
      "Real time updates",
      "Follow and Stay Connected",
      "Exclusive Offers",
    ],
    image: "/img/features/showcase-stay-connected.png",
    imageAlt: "FixFlow stay connected messaging",
  },
  {
    badge: "Referral Rewards",
    badgeIcon: <UserPlus className="w-5 h-5" />,
    title: (
      <>
        Refer Friends.
        <br />
        Earn More Rewards.
      </>
    ),
    description:
      "Invite friends to join FixFlow and earn bonus rewards when they discover businesses, book services, and become active members.",
    bullets: [
      "Earn Points From Referrals",
      "Reward Friends For Joining",
      "Track Referral Progress",
    ],
    image: "/img/features/showcase-referral-rewards.png",
    imageAlt: "FixFlow referral rewards",
  },
];

export default function CustomerFeatureShowcases() {
  return (
    <>
      {CUSTOMER_SHOWCASES.map((showcase) => (
        <FeatureShowcase key={showcase.badge} {...showcase} />
      ))}
    </>
  );
}
