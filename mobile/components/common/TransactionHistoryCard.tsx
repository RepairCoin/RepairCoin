import { Entypo, Octicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { View, Text } from "react-native";

type CustomerTransactionProps = {
  variant: "customer";
  type: string;
  amount: number;
  shopName?: string;
  description: string;
  createdAt: string;
};

type ShopTransactionProps = {
  variant: "shop";
  amount: number;
  createdAt: string;
  paymentMethod: string;
  totalCost: number;
  status: string;
  completedAt?: string;
};

type Props = CustomerTransactionProps | ShopTransactionProps;

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
    const isEarned = props.type === "earned" || props.type === "bonus" || props.type === "referral" || props.type === "tier_bonus";
    
    return (
      <View className="bg-white w-full py-2 px-4 rounded-full flex-row items-center my-2">
        <View
          className={`w-10 h-10 ${isEarned ? "bg-[#DDF6E2]" : "bg-[#F6C8C8]"} rounded-full items-center justify-center`}
        >
          {isEarned ? (
            <Entypo name="check" color="#1A9D5B" size={18} />
          ) : (
            <Octicons name="x" color="#E34C4C" size={18} />
          )}
        </View>
        <View className="flex-1 px-2">
          <View className="flex-row justify-between">
            <Text className="text-black text-xl font-extrabold" numberOfLines={1}>
              {props.shopName || "RepairCoin"}
            </Text>
            <Text className="text-black text-xl font-extrabold">
              {isEarned ? "+" : "-"}{props.amount} RCN
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[#666] text-base font-semibold" numberOfLines={1}>
              {props.type}
            </Text>
            <Text className="text-[#666] text-base font-semibold">
              {formattedDate(props.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Shop variant - Purchase history
  const getStatusColor = () => {
    switch (props.status.toLowerCase()) {
      case 'completed':
      case 'success':
        return { bg: '#10B981', text: '#fff' };
      case 'pending':
        return { bg: '#FFCC00', text: '#000' };
      case 'failed':
        return { bg: '#EF4444', text: '#fff' };
      default:
        return { bg: '#666', text: '#fff' };
    }
  };

  const getPaymentIcon = () => {
    const method = props.paymentMethod.toLowerCase();
    if (method.includes('stripe') || method.includes('card')) {
      return <MaterialIcons name="credit-card" size={20} color="#4B5563" />;
    }
    if (method.includes('crypto') || method.includes('wallet')) {
      return <MaterialIcons name="account-balance-wallet" size={20} color="#4B5563" />;
    }
    return <Feather name="dollar-sign" size={20} color="#4B5563" />;
  };

  const statusColors = getStatusColor();

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
            {props.paymentMethod}
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Feather name="dollar-sign" size={20} color="#4B5563" />
            <Text className="text-gray-400 text-sm ml-2">Total Cost</Text>
          </View>
          <Text className="text-white text-sm font-semibold">
            ${props.totalCost.toFixed(2)} USD
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

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Feather name="trending-up" size={20} color="#4B5563" />
            <Text className="text-gray-400 text-sm ml-2">Price per RCN</Text>
          </View>
          <Text className="text-white text-sm font-semibold">
            ${(props.totalCost / props.amount).toFixed(4)} USD
          </Text>
        </View>
      </View>
    </View>
  );
}