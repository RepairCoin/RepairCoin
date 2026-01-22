import { useState } from "react";
import { Alert } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { useCreatePromoCode as useCreatePromoCodeMutation } from "@/hooks/useShopRewards";
import { PromoCodeFormData, BonusType } from "../../types";
import {
  CODE_MIN_LENGTH,
  CODE_MAX_LENGTH,
  MAX_PERCENTAGE,
  DEFAULT_PROMO_DURATION_DAYS,
} from "../../constants";

export function useCreatePromoCode() {
  const [formData, setFormData] = useState<PromoCodeFormData>({
    code: "",
    name: "",
    description: "",
    bonusType: "fixed",
    bonusValue: "",
    startDate: new Date(),
    endDate: new Date(Date.now() + DEFAULT_PROMO_DURATION_DAYS * 24 * 60 * 60 * 1000),
    totalUsageLimit: "",
    perCustomerLimit: "",
    maxBonus: "",
  });

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const createPromoCodeMutation = useCreatePromoCodeMutation();

  const updateFormData = <K extends keyof PromoCodeFormData>(
    key: K,
    value: PromoCodeFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = (): boolean => {
    if (
      !formData.code.trim() ||
      formData.code.trim().length < CODE_MIN_LENGTH ||
      formData.code.trim().length > CODE_MAX_LENGTH
    ) {
      Alert.alert(
        "Validation Error",
        `Code must be between ${CODE_MIN_LENGTH} and ${CODE_MAX_LENGTH} characters`
      );
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

    if (
      formData.bonusType === "percentage" &&
      parseFloat(formData.bonusValue) > MAX_PERCENTAGE
    ) {
      Alert.alert("Validation Error", `Percentage bonus cannot exceed ${MAX_PERCENTAGE}%`);
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
      total_usage_limit: formData.totalUsageLimit
        ? parseInt(formData.totalUsageLimit)
        : undefined,
      per_customer_limit: formData.perCustomerLimit
        ? parseInt(formData.perCustomerLimit)
        : undefined,
      max_bonus:
        formData.maxBonus && formData.bonusType === "percentage"
          ? parseFloat(formData.maxBonus)
          : undefined,
      is_active: true,
    };

    createPromoCodeMutation.mutate(promoCodeData);
  };

  const handleStartDateChange = (selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) updateFormData("startDate", selectedDate);
  };

  const handleEndDateChange = (selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) updateFormData("endDate", selectedDate);
  };

  const handleGoBack = () => {
    goBack();
  };

  return {
    formData,
    updateFormData,
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    isPending: createPromoCodeMutation.isPending,
    handleSubmit,
    handleStartDateChange,
    handleEndDateChange,
    handleGoBack,
  };
}
