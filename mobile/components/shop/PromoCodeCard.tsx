import { View, Text, Switch } from "react-native";
import { PromoCode } from "@/services/ShopServices";
import { useState } from "react";

interface PromoCodeCardProps {
  promoCode: PromoCode & { 
    valid_from?: string;
    valid_until?: string; 
    start_date?: string;
    end_date?: string;
  };
  onToggleStatus?: (id: string, isActive: boolean) => void;
  isUpdating?: boolean;
}

export function PromoCodeCard({ promoCode, onToggleStatus, isUpdating = false }: PromoCodeCardProps) {
  const [isActive, setIsActive] = useState(promoCode.is_active);

  const handleToggle = (value: boolean) => {
    if (isUpdating) return; // Prevent toggle when updating
    setIsActive(value);
    onToggleStatus?.(promoCode.id, value);
  };
  const formatDate = (date?: string) => {
    if (!date) return "N/A";
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const validFrom = promoCode.valid_from || promoCode.start_date;
  const validUntil = promoCode.valid_until || promoCode.end_date;
  const validPeriod = validFrom && validUntil 
    ? `${formatDate(validFrom)} - ${formatDate(validUntil)}`
    : validFrom || validUntil 
    ? formatDate(validFrom || validUntil)
    : "No expiry";

  const usage = promoCode.total_usage_limit 
    ? `${promoCode.times_used || 0}/${promoCode.total_usage_limit}`
    : `${promoCode.times_used || 0}`;

  const bonusDisplay = promoCode.bonus_type === 'percentage' 
    ? `${promoCode.bonus_value}%`
    : `${promoCode.bonus_value} RCN`;

  return (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-bold text-gray-900">{promoCode.code}</Text>
          {promoCode.name && (
            <Text className="text-sm text-gray-600 mt-1">{promoCode.name}</Text>
          )}
        </View>
        <View className="flex-row items-center gap-3">
          <View className={`px-3 py-1 rounded-full ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Text className={`text-xs font-semibold ${isActive ? 'text-green-700' : 'text-gray-500'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={handleToggle}
            trackColor={{ false: '#D1D5DB', true: '#FFCC00' }}
            thumbColor={isActive ? '#FFF' : '#FFF'}
            ios_backgroundColor="#D1D5DB"
            disabled={isUpdating}
            style={{ opacity: isUpdating ? 0.5 : 1 }}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap">
        <View className="w-1/2 mb-2">
          <Text className="text-xs text-gray-500 mb-1">Valid Period</Text>
          <Text className="text-sm font-medium text-gray-900">{validPeriod}</Text>
        </View>
        
        <View className="w-1/2 mb-2">
          <Text className="text-xs text-gray-500 mb-1">Bonus</Text>
          <Text className="text-sm font-medium text-gray-900">{bonusDisplay}</Text>
        </View>

        <View className="w-1/2">
          <Text className="text-xs text-gray-500 mb-1">Usage</Text>
          <Text className="text-sm font-medium text-gray-900">{usage}</Text>
        </View>

        {promoCode.max_bonus && (
          <View className="w-1/2">
            <Text className="text-xs text-gray-500 mb-1">Max Bonus</Text>
            <Text className="text-sm font-medium text-gray-900">{promoCode.max_bonus} RCN</Text>
          </View>
        )}
      </View>
    </View>
  );
}