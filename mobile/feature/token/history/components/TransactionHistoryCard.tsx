import { Entypo, Octicons, MaterialIcons, Feather, Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { Props } from "@/feature/token/services/token.interface";

// Convert snake_case to Title Case (e.g., "service_redemption_refund" → "Service Redemption Refund")
const formatSnakeCase = (text: string): string => {
  if (!text) return "Transaction";
  return text
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Transaction type configuration
const getTransactionConfig = (type: string) => {
  const lowerType = type?.toLowerCase() || "";

  // Gift/Transfer types
  if (lowerType === "transfer_in" || lowerType === "gift_received") {
    return {
      isPositive: true,
      bgColor: "bg-purple-100",
      iconColor: "#9333EA",
      icon: <MaterialIcons name="card-giftcard" color="#9333EA" size={18} />,
      label: "Gift Received",
      amountColor: "text-green-400",
    };
  }
  if (lowerType === "transfer_out" || lowerType === "gift_sent") {
    return {
      isPositive: false,
      bgColor: "bg-purple-100",
      iconColor: "#9333EA",
      icon: <Ionicons name="gift-outline" color="#9333EA" size={18} />,
      label: "Gift Sent",
      amountColor: "text-red-400",
    };
  }

  // Earned types
  if (["earned", "bonus", "referral", "tier_bonus"].includes(lowerType)) {
    return {
      isPositive: true,
      bgColor: "bg-[#DDF6E2]",
      iconColor: "#1A9D5B",
      icon: <Entypo name="check" color="#1A9D5B" size={18} />,
      label: lowerType === "referral" ? "Referral Bonus" :
             lowerType === "tier_bonus" ? "Tier Bonus" :
             lowerType === "bonus" ? "Bonus" : "Earned",
      amountColor: "text-green-400",
    };
  }

  // Mint to wallet (admin manual mints or untransformed mint types)
  if (lowerType === "mint") {
    return {
      isPositive: true,
      bgColor: "bg-blue-100",
      iconColor: "#3B82F6",
      icon: <Ionicons name="wallet-outline" color="#3B82F6" size={18} />,
      label: "Minted to Wallet",
      amountColor: "text-blue-400",
    };
  }

  // Service redemption
  if (lowerType === "service_redemption") {
    return {
      isPositive: false,
      bgColor: "bg-[#FDE8D0]",
      iconColor: "#EA580C",
      icon: <MaterialIcons name="discount" color="#EA580C" size={18} />,
      label: "Service Discount",
      amountColor: "text-orange-400",
    };
  }

  // Redeemed types
  if (["redeemed", "redemption"].includes(lowerType)) {
    return {
      isPositive: false,
      bgColor: "bg-[#F6C8C8]",
      iconColor: "#E34C4C",
      icon: <Octicons name="dash" color="#E34C4C" size={18} />,
      label: "Redeemed",
      amountColor: "text-red-400",
    };
  }

  // Refund types
  if (lowerType.includes("refund")) {
    return {
      isPositive: true,
      bgColor: "bg-blue-100",
      iconColor: "#3B82F6",
      icon: <MaterialIcons name="replay" color="#3B82F6" size={18} />,
      label: formatSnakeCase(type),
      amountColor: "text-blue-400",
    };
  }

  // Rejected/Cancelled types
  if (["rejected_redemption", "cancelled_redemption", "rejected", "cancelled"].includes(lowerType)) {
    return {
      isPositive: false,
      bgColor: "bg-[#F6C8C8]",
      iconColor: "#E34C4C",
      icon: <Octicons name="x" color="#E34C4C" size={18} />,
      label: lowerType.includes("cancelled") ? "Cancelled" : "Rejected",
      amountColor: "text-red-400",
    };
  }

  // Default
  return {
    isPositive: true,
    bgColor: "bg-gray-200",
    iconColor: "#666",
    icon: <Feather name="activity" color="#666" size={18} />,
    label: formatSnakeCase(type),
    amountColor: "text-green-400",
  };
};

export default function TransactionHistoryCard(props: Props) {
  const formattedDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (props.variant === "customer") {
    const config = getTransactionConfig(props.type);
    const lowerType = props.type?.toLowerCase() || "";
    const isPlatformTransaction = ["tier_bonus", "referral", "bonus", "mint"].includes(lowerType);
    const shopDisplayName =
      props.shopName || (isPlatformTransaction ? "FixFlow" : "Unknown Shop");
    const hideAmount = props.amount === 0;

    return (
      <View className="bg-zinc-900 w-full py-3 px-4 rounded-xl flex-row items-center my-1.5">
        <View
          className={`w-10 h-10 ${config.bgColor} rounded-full items-center justify-center`}
        >
          {config.icon}
        </View>
        <View className="flex-1 px-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-base font-bold flex-1 mr-2" numberOfLines={1}>
              {shopDisplayName}
            </Text>
            {hideAmount ? (
              <Text className="text-gray-500 text-base font-bold">—</Text>
            ) : (
              <Text className={`text-base font-bold ${config.amountColor}`}>
                {config.isPositive ? "+" : "-"}{Math.abs(props.amount)} RCN
              </Text>
            )}
          </View>
          <View className="flex-row justify-between items-center mt-1">
            <Text className="text-gray-400 text-sm" numberOfLines={1}>
              {config.label}
            </Text>
            <Text className="text-gray-500 text-xs">
              {formattedDate(props.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Shop variant - unified transaction history (reward / redemption / purchase)
  const getStatusColor = () => {
    switch (props.status.toLowerCase()) {
      case 'completed':
      case 'success':
        return { bg: '#10B981', text: '#fff' };
      case 'pending':
        return { bg: '#FFCC00', text: '#000' };
      case 'failed':
      case 'cancelled':
      case 'rejected':
        return { bg: '#EF4444', text: '#fff' };
      default:
        return { bg: '#666', text: '#fff' };
    }
  };

  const statusColors = getStatusColor();
  const shopType = props.type?.toLowerCase() || "";
  const isPurchase = shopType === "purchase";
  const isRedemption = [
    "redemption",
    "redeemed",
    "redeem",
    "service_redemption",
  ].includes(shopType);
  const shortAddress = (addr?: string | null) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  // ── Reward / Earned / Redemption layout (anything that isn't a purchase) ──
  if (!isPurchase) {
    const earnedLabel = (() => {
      if (shopType === "reward" || shopType === "mint")
        return props.isTierBonus ? "Reward + Tier Bonus" : "Reward Issued";
      if (shopType === "tier_bonus") return "Tier Bonus";
      if (shopType === "referral") return "Referral Bonus";
      if (shopType === "bonus") return "Bonus";
      if (shopType === "earned") return "Earned";
      return formatSnakeCase(props.type || "Reward");
    })();

    const config = !isRedemption
      ? {
          bg: "bg-[#DDF6E2]",
          iconColor: "#1A9D5B",
          icon: <Entypo name="check" color="#1A9D5B" size={18} />,
          label: earnedLabel,
          amountColor: "text-green-400",
          sign: "+",
        }
      : {
          bg: "bg-[#FDE8D0]",
          iconColor: "#EA580C",
          icon: <MaterialIcons name="money-off" color="#EA580C" size={18} />,
          label: "Redemption",
          amountColor: "text-orange-400",
          sign: "-",
        };

    return (
      <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 my-2">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center flex-1 mr-2">
            <View
              className={`w-10 h-10 ${config.bg} rounded-full items-center justify-center`}
            >
              {config.icon}
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-bold text-lg ${config.amountColor}`}>
                {config.sign}
                {Math.abs(props.amount)} RCN
              </Text>
              <Text className="text-gray-400 text-xs">{config.label}</Text>
            </View>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: statusColors.bg }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: statusColors.text }}
            >
              {props.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View className="border-b border-zinc-800 mb-3" />

        <View className="space-y-2">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Feather name="user" size={18} color="#4B5563" />
              <Text className="text-gray-400 text-sm ml-2">Customer</Text>
            </View>
            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
              {props.customerName || shortAddress(props.customerAddress) || "—"}
            </Text>
          </View>

          {props.repairAmount != null && (
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Feather name="tool" size={18} color="#4B5563" />
                <Text className="text-gray-400 text-sm ml-2">Repair Amount</Text>
              </View>
              <Text className="text-white text-sm font-semibold">
                ${Number(props.repairAmount).toFixed(2)} USD
              </Text>
            </View>
          )}

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Feather name="calendar" size={18} color="#4B5563" />
              <Text className="text-gray-400 text-sm ml-2">Date</Text>
            </View>
            <Text className="text-white text-sm">
              {formattedDate(props.createdAt)}
            </Text>
          </View>

          {props.failureReason && (
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Feather name="alert-circle" size={18} color="#EF4444" />
                <Text className="text-gray-400 text-sm ml-2">Reason</Text>
              </View>
              <Text
                className="text-red-400 text-sm flex-1 text-right ml-2"
                numberOfLines={1}
              >
                {props.failureReason}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Purchase layout ─────────────────────────────────────────────────────
  const paymentMethod = props.paymentMethod || "—";
  const totalCost = props.totalCost ?? 0;

  const getPaymentIcon = () => {
    const method = paymentMethod.toLowerCase();
    if (method.includes('stripe') || method.includes('card')) {
      return <MaterialIcons name="credit-card" size={20} color="#4B5563" />;
    }
    if (method.includes('crypto') || method.includes('wallet')) {
      return <MaterialIcons name="account-balance-wallet" size={20} color="#4B5563" />;
    }
    return <Feather name="dollar-sign" size={20} color="#4B5563" />;
  };

  return (
    <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 my-2">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center">
          <View className="w-10 h-10 bg-[#FFCC00]/20 rounded-full items-center justify-center">
            <Feather name="shopping-cart" size={20} color="#FFCC00" />
          </View>
          <View className="ml-3">
            <Text className="text-white font-bold text-lg">
              {props.amount} RCN
            </Text>
            <Text className="text-gray-400 text-xs">
              Purchase
            </Text>
          </View>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: statusColors.bg }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: statusColors.text }}
          >
            {props.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View className="border-b border-zinc-800 mb-3" />

      {/* Details */}
      <View className="space-y-2">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            {getPaymentIcon()}
            <Text className="text-gray-400 text-sm ml-2">Payment Method</Text>
          </View>
          <Text className="text-white text-sm font-semibold">
            {paymentMethod}
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Feather name="dollar-sign" size={20} color="#4B5563" />
            <Text className="text-gray-400 text-sm ml-2">Total Cost</Text>
          </View>
          <Text className="text-white text-sm font-semibold">
            ${totalCost.toFixed(2)} USD
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Feather name="calendar" size={20} color="#4B5563" />
            <Text className="text-gray-400 text-sm ml-2">Created</Text>
          </View>
          <Text className="text-white text-sm">
            {formattedDate(props.createdAt)}
          </Text>
        </View>

        {props.completedAt && (
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Feather name="check-circle" size={20} color="#4B5563" />
              <Text className="text-gray-400 text-sm ml-2">Completed</Text>
            </View>
            <Text className="text-white text-sm">
              {formattedDate(props.completedAt)}
            </Text>
          </View>
        )}

        {totalCost > 0 && props.amount > 0 && (
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Feather name="trending-up" size={20} color="#4B5563" />
              <Text className="text-gray-400 text-sm ml-2">Price per RCN</Text>
            </View>
            <Text className="text-white text-sm font-semibold">
              ${(totalCost / props.amount).toFixed(4)} USD
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}