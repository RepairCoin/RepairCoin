export interface Faq {
  question: string;
  answer: string;
}

export const CUSTOMER_FAQS: Faq[] = [
  {
    question: "What is RepairCoin (RCN)?",
    answer:
      "RepairCoin (RCN) is a digital rewards currency designed specifically for the repair industry. Each RCN has a fixed value of $0.10 USD and can be earned through repairs and referrals, then redeemed at participating shops.",
  },
  {
    question: "How do I earn RCN tokens?",
    answer:
      "You earn RCN tokens by getting repairs done at participating shops (1 RCN per $10 spent), referring friends (25 RCN per successful referral), and through loyalty bonuses based on your tier (Bronze, Silver, or Gold).",
  },
  {
    question: "Where can I redeem my RCN tokens?",
    answer:
      "You can redeem RCN at any verified RepairCoin partner shop. You'll get 100% value at the shop where you earned the tokens, and 20% value at other participating shops nationwide.",
  },
  {
    question: "What is RCG and how is it different from RCN?",
    answer:
      "RCG (RepairCoin Governance) is the governance token with a fixed supply of 100M tokens. While RCN is for customer rewards, RCG is staked by shops to unlock tier benefits (Standard/Premium/Elite) and grants voting rights in the DAO.",
  },
  {
    question: "How does the redemption approval process work?",
    answer:
      "When you want to redeem tokens at a shop, they send a redemption request to your account. You review the details and approve it through your RepairCoin app. Only after your approval are the tokens transferred and deducted from your balance.",
  },
  {
    question: "Do my RCN tokens expire?",
    answer:
      "No, RCN tokens never expire. You can hold them as long as you want and redeem them whenever you need repair services at participating shops.",
  },
  {
    question: "How does the referral program work?",
    answer:
      "Share your unique referral code or link with friends. When they register and complete their first repair, you earn 25 RCN and they receive a 10 RCN welcome bonus. There is no limit to how many people you can refer.",
  },
  {
    question: "How do I gift tokens to someone?",
    answer:
      "Go to the Gift Tokens page, enter the recipient's wallet address (or scan their QR code), specify the amount, and confirm the transfer. Gifted tokens can be redeemed at any participating shop.",
  },
];

export const SHOP_FAQS: Faq[] = [
  {
    question: "How do I issue RCN rewards to customers?",
    answer:
      "Navigate to the 'Tools' tab and use the 'Issue Rewards' section. Enter the customer's wallet address and the repair amount. The system automatically calculates RCN rewards (1 RCN per $10 spent) plus any tier bonuses. Confirm the transaction to issue the rewards instantly.",
  },
  {
    question: "How does the redemption process work?",
    answer:
      "When a customer wants to redeem RCN at your shop, go to the 'Tools' tab and use the 'Process Redemption' section. Enter the customer's wallet address and redemption amount. The customer will receive a notification to approve the redemption. Once approved, tokens are transferred and deducted from their balance.",
  },
  {
    question: "What is the difference between RCN and RCG?",
    answer:
      "RCN (RepairCoin) is the utility token used for customer rewards ($0.10 per token). RCG (RepairCoin Governance) is the governance token that shops can stake to unlock tier benefits (Standard/Premium/Elite) and participate in DAO voting. Staking RCG reduces your RCN purchase costs.",
  },
  {
    question: "How do I purchase RCN tokens?",
    answer:
      "Go to the 'Purchase' tab to buy RCN tokens. Pricing is tiered based on your RCG holdings: $0.10/RCN (Standard), $0.09/RCN (Premium), $0.08/RCN (Elite). You can pay via Stripe (credit card) or cryptocurrency. Tokens are added to your balance immediately after payment.",
  },
  {
    question: "What subscription plans are available?",
    answer:
      "RepairCoin offers a $500/month subscription that gives your shop full operational access including reward issuance, redemption processing, customer management, service marketplace, and analytics. Alternatively, shops holding 200K+ RCG tokens qualify for free access via RCG staking.",
  },
  {
    question: "How do customer tiers affect my shop?",
    answer:
      "Customer tiers (Bronze/Silver/Gold) determine bonus rewards. When issuing rewards, Bronze customers get standard 1 RCN per $10, Silver gets +2 RCN bonus, and Gold gets +5 RCN bonus. These bonuses are automatically calculated and deducted from your RCN balance.",
  },
  {
    question: "Can customers redeem RCN earned at other shops?",
    answer:
      "Yes, RepairCoin has universal redemption enabled. Customers can redeem 100% of RCN earned at your shop when they return to you, and 20% of RCN earned at other shops. This increases foot traffic by attracting customers from the entire RepairCoin network.",
  },
  {
    question: "How do I manage my service marketplace listings?",
    answer:
      "Navigate to the 'Services' tab to create, edit, or delete services. Upload images, set pricing, write descriptions, and configure booking settings. You can activate/deactivate services anytime. Customers browse your services on the marketplace and book appointments directly.",
  },
  {
    question: "What happens if my subscription is cancelled?",
    answer:
      "If you cancel your subscription, you'll maintain full access until the end of your current billing period. After that, operational features (reward issuance, redemptions, service bookings) will be disabled. You can reactivate anytime by renewing your subscription or staking 200K+ RCG.",
  },
  {
    question: "How do I handle appointment scheduling?",
    answer:
      "Go to 'Appointments' to configure your shop hours, slot duration, and booking capacity. Set holiday closures and special hours via date overrides. View all bookings in the calendar, click to see details, and mark orders complete when services are finished. Customers receive automatic reminders 24 hours before their appointments.",
  },
  {
    question: "What are affiliate shop groups?",
    answer:
      "Affiliate shop groups let you create coalitions with other shops to issue custom tokens/points. Link your services to groups to offer bonus rewards beyond standard RCN. Customers automatically earn both RCN and group tokens when they book group-linked services.",
  },
  {
    question: "How does the moderation system work?",
    answer:
      "Use the 'Moderation' section in Settings to block problematic customers, report platform issues to admins, and flag inappropriate reviews. Blocked customers cannot book services at your shop. You can track all your reports and manage your blocked customer list.",
  },
  {
    question: "How do I track my shop's performance?",
    answer:
      "The 'Service Analytics' tab provides comprehensive insights including revenue tracking, top performing services, category breakdown, order trends, RCN redemption analytics, and customer rating metrics. Use time period filters (7/30/90 days) to analyze performance over different timeframes.",
  },
  {
    question: "What should I do if my shop is suspended or paused?",
    answer:
      "Suspended shops have violated RepairCoin policies and cannot perform operational actions. Contact support to resolve the issue. Paused subscriptions are temporary holds by admins and can be resumed. Check the 'Subscription' tab for details and contact information.",
  },
];
