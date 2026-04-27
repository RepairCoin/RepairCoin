import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCreatePromoCode } from "../hooks";
import { formatDate } from "../utils";
import { BonusType } from "../types";

export default function CreatePromoCodeScreen() {
  const {
    formData,
    updateFormData,
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    isPending,
    handleSubmit,
    handleStartDateChange,
    handleEndDateChange,
    handleGoBack,
  } = useCreatePromoCode();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-zinc-950"
    >
      <View className="pt-16 px-4 pb-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={18} onPress={handleGoBack} />
          <Text className="text-white text-2xl font-extrabold">Create Promo Code</Text>
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
            onChangeText={(value) => updateFormData("code", value)}
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
            onChangeText={(value) => updateFormData("name", value)}
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
            onChangeText={(value) => updateFormData("description", value)}
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
              onValueChange={(itemValue) =>
                updateFormData("bonusType", itemValue as BonusType)
              }
              style={{ color: "white" }}
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
            onChangeText={(value) => updateFormData("bonusValue", value)}
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
              onChangeText={(value) => updateFormData("maxBonus", value)}
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
              onChange={(_, selectedDate) => handleStartDateChange(selectedDate)}
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
              onChange={(_, selectedDate) => handleEndDateChange(selectedDate)}
              minimumDate={
                new Date(formData.startDate.getTime() + 24 * 60 * 60 * 1000)
              }
            />
          )}
        </View>

        {/* Total Usage Limit */}
        <View className="mb-4">
          <Text className="text-white text-sm mb-2">Total Usage Limit (Optional)</Text>
          <TextInput
            value={formData.totalUsageLimit}
            onChangeText={(value) => updateFormData("totalUsageLimit", value)}
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
            onChangeText={(value) => updateFormData("perCustomerLimit", value)}
            placeholder="e.g., 1 (leave empty for unlimited)"
            placeholderTextColor="#666"
            className="bg-zinc-900 text-white p-3 rounded-xl"
            keyboardType="number-pad"
          />
        </View>

        {/* Create Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={isPending}
          className={`${isPending ? "bg-gray-600" : "bg-[#FFCC00]"} p-4 rounded-xl mb-4`}
        >
          <Text className="text-black font-bold text-center text-lg">
            {isPending ? "Creating..." : "Create Promo Code"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
