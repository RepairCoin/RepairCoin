import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCreatePromoCode } from "@/hooks/useShopRewards";

interface PromoCodeFormData {
  code: string;
  name: string;
  description: string;
  bonusType: "fixed" | "percentage";
  bonusValue: string;
  startDate: Date;
  endDate: Date;
  totalUsageLimit: string;
  perCustomerLimit: string;
  maxBonus: string;
}

export default function CreatePromoCode() {
  const [formData, setFormData] = useState<PromoCodeFormData>({
    code: "",
    name: "",
    description: "",
    bonusType: "fixed",
    bonusValue: "",
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    totalUsageLimit: "",
    perCustomerLimit: "",
    maxBonus: "",
  });
  
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const createPromoCodeMutation = useCreatePromoCode();

  const updateFormData = <K extends keyof PromoCodeFormData>(
    key: K,
    value: PromoCodeFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const validateForm = () => {
    if (!formData.code.trim() || formData.code.trim().length < 3 || formData.code.trim().length > 20) {
      Alert.alert("Validation Error", "Code must be between 3 and 20 characters");
      return false;
    }
    
    if (!formData.name.trim()) {
      Alert.alert("Validation Error", "Name is required");
      return false;
    }
    
    if (!formData.bonusValue || parseFloat(formData.bonusValue) <= 0) {
      Alert.alert("Validation Error", "Bonus value must be greater than 0");
      return false;
    }
    
    if (formData.bonusType === "percentage" && parseFloat(formData.bonusValue) > 100) {
      Alert.alert("Validation Error", "Percentage bonus cannot exceed 100%");
      return false;
    }
    
    if (formData.startDate >= formData.endDate) {
      Alert.alert("Validation Error", "End date must be after start date");
      return false;
    }
    
    if (formData.totalUsageLimit && parseInt(formData.totalUsageLimit) <= 0) {
      Alert.alert("Validation Error", "Total usage limit must be greater than 0");
      return false;
    }
    
    if (formData.perCustomerLimit && parseInt(formData.perCustomerLimit) <= 0) {
      Alert.alert("Validation Error", "Per customer limit must be greater than 0");
      return false;
    }
    
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    const promoCodeData = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      bonus_type: formData.bonusType,
      bonus_value: parseFloat(formData.bonusValue),
      start_date: formData.startDate.toISOString(),
      end_date: formData.endDate.toISOString(),
      total_usage_limit: formData.totalUsageLimit ? parseInt(formData.totalUsageLimit) : undefined,
      per_customer_limit: formData.perCustomerLimit ? parseInt(formData.perCustomerLimit) : undefined,
      max_bonus: formData.maxBonus && formData.bonusType === "percentage" ? parseFloat(formData.maxBonus) : undefined,
      is_active: true,
    };
    
    createPromoCodeMutation.mutate(promoCodeData);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-zinc-950"
    >
      <View className="pt-16 px-4 pb-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={18} onPress={goBack} />
          <Text className="text-white text-2xl font-extrabold">
            Create Promo Code
          </Text>
          <View className="w-[25px]" />
        </View>
      </View>
      
      <ScrollView 
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Code Input */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Code *</Text>
          <TextInput
            value={formData.code}
            onChangeText={(value) => updateFormData('code', value)}
            placeholder="e.g., SUMMER20"
            placeholderTextColor="#666"
            className="bg-zinc-900 text-white p-3 rounded-xl"
            maxLength={20}
            autoCapitalize="characters"
          />
        </View>

        {/* Name Input */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Name *</Text>
          <TextInput
            value={formData.name}
            onChangeText={(value) => updateFormData('name', value)}
            placeholder="e.g., Summer Sale"
            placeholderTextColor="#666"
            className="bg-zinc-900 text-white p-3 rounded-xl"
          />
        </View>

        {/* Description Input */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Description (Optional)</Text>
          <TextInput
            value={formData.description}
            onChangeText={(value) => updateFormData('description', value)}
            placeholder="e.g., Special summer discount for all customers"
            placeholderTextColor="#666"
            className="bg-zinc-900 text-white p-3 rounded-xl"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Bonus Type Dropdown */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Bonus Type *</Text>
          <View className="bg-zinc-900 rounded-xl">
            <Picker
              selectedValue={formData.bonusType}
              onValueChange={(itemValue) => updateFormData('bonusType', itemValue as "fixed" | "percentage")}
              style={{ color: 'white' }}
              dropdownIconColor="white"
            >
              <Picker.Item label="Fixed Amount (RCN)" value="fixed" />
              <Picker.Item label="Percentage (%)" value="percentage" />
            </Picker>
          </View>
        </View>

        {/* Bonus Value Input */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">
            Bonus Value * {formData.bonusType === "percentage" ? "(%)" : "(RCN)"}
          </Text>
          <TextInput
            value={formData.bonusValue}
            onChangeText={(value) => updateFormData('bonusValue', value)}
            placeholder={formData.bonusType === "percentage" ? "e.g., 20" : "e.g., 5"}
            placeholderTextColor="#666"
            className="bg-zinc-900 text-white p-3 rounded-xl"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Max Bonus (only for percentage) */}
        {formData.bonusType === "percentage" && (
          <View className="mb-4">
            <Text className="text-white text-sm mb-2">Max Bonus (RCN) (Optional)</Text>
            <TextInput
              value={formData.maxBonus}
              onChangeText={(value) => updateFormData('maxBonus', value)}
              placeholder="e.g., 10"
              placeholderTextColor="#666"
              className="bg-zinc-900 text-white p-3 rounded-xl"
              keyboardType="decimal-pad"
            />
          </View>
        )}

        {/* Start Date */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Start Date *</Text>
          <Pressable
            onPress={() => setShowStartDatePicker(true)}
            className="bg-zinc-900 p-3 rounded-xl flex-row justify-between items-center"
          >
            <Text className="text-white">{formatDate(formData.startDate)}</Text>
            <MaterialIcons name="date-range" size={20} color="#FFCC00" />
          </Pressable>
          {showStartDatePicker && (
            <DateTimePicker
              value={formData.startDate}
              mode="date"
              display="default"
              onChange={(_, selectedDate) => {
                setShowStartDatePicker(false);
                if (selectedDate) updateFormData('startDate', selectedDate);
              }}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* End Date */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">End Date *</Text>
          <Pressable
            onPress={() => setShowEndDatePicker(true)}
            className="bg-zinc-900 p-3 rounded-xl flex-row justify-between items-center"
          >
            <Text className="text-white">{formatDate(formData.endDate)}</Text>
            <MaterialIcons name="date-range" size={20} color="#FFCC00" />
          </Pressable>
          {showEndDatePicker && (
            <DateTimePicker
              value={formData.endDate}
              mode="date"
              display="default"
              onChange={(_, selectedDate) => {
                setShowEndDatePicker(false);
                if (selectedDate) updateFormData('endDate', selectedDate);
              }}
              minimumDate={new Date(formData.startDate.getTime() + 24 * 60 * 60 * 1000)}
            />
          )}
        </View>

        {/* Total Usage Limit */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Total Usage Limit (Optional)</Text>
          <TextInput
            value={formData.totalUsageLimit}
            onChangeText={(value) => updateFormData('totalUsageLimit', value)}
            placeholder="e.g., 100 (leave empty for unlimited)"
            placeholderTextColor="#666"
            className="bg-zinc-900 text-white p-3 rounded-xl"
            keyboardType="number-pad"
          />
        </View>

        {/* Per Customer Limit */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Per Customer Limit (Optional)</Text>
          <TextInput
            value={formData.perCustomerLimit}
            onChangeText={(value) => updateFormData('perCustomerLimit', value)}
            placeholder="e.g., 1 (leave empty for unlimited)"
            placeholderTextColor="#666"
            className="bg-zinc-900 text-white p-3 rounded-xl"
            keyboardType="number-pad"
          />
        </View>

        {/* Create Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={createPromoCodeMutation.isPending}
          className={`${
            createPromoCodeMutation.isPending ? 'bg-gray-600' : 'bg-[#FFCC00]'
          } p-4 rounded-xl mb-4`}
        >
          <Text className="text-black font-bold text-center text-lg">
            {createPromoCodeMutation.isPending ? 'Creating...' : 'Create Promo Code'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}