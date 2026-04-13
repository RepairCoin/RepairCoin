import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BUG_CATEGORIES = [
  "App Crash",
  "Payment Issue",
  "Wallet / Tokens",
  "Booking / Orders",
  "Notifications",
  "Login / Auth",
  "UI / Display",
  "Other",
] as const;

type BugCategory = (typeof BUG_CATEGORIES)[number];

interface ReportBugModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: {
    category: BugCategory;
    title: string;
    description: string;
  }) => Promise<void>;
}

export function ReportBugModal({
  visible,
  onClose,
  onSubmit,
}: ReportBugModalProps) {
  const [category, setCategory] = useState<BugCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ category?: string; title?: string; description?: string }>({});

  const resetForm = useCallback(() => {
    setCategory(null);
    setTitle("");
    setDescription("");
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = useCallback(() => {
    const newErrors: typeof errors = {};
    if (!category) newErrors.category = "Please select a category";
    if (!title.trim()) newErrors.title = "Please enter a title";
    if (!description.trim()) newErrors.description = "Please describe the bug";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [category, title, description]);

  const handleSubmit = useCallback(async () => {
    if (!validate() || !category) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ category, title: title.trim(), description: description.trim() });
      resetForm();
    } catch {
      setIsSubmitting(false);
    }
  }, [validate, category, title, description, onSubmit, resetForm]);

  const isValid = category && title.trim() && description.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            className="bg-zinc-900 rounded-t-3xl max-h-[90%]"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="text-white text-lg font-semibold">
                Report a Bug
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="px-5"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Category Selection */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-400 mb-2">
                  Category
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {BUG_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => {
                        setCategory(cat);
                        setErrors((e) => ({ ...e, category: undefined }));
                      }}
                      className={`px-3 py-2 rounded-lg border ${
                        category === cat
                          ? "bg-[#FFCC00]/20 border-[#FFCC00]"
                          : "bg-zinc-800 border-zinc-700"
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          category === cat ? "text-[#FFCC00]" : "text-gray-400"
                        }`}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.category && (
                  <Text className="text-red-500 text-xs mt-1">
                    {errors.category}
                  </Text>
                )}
              </View>

              {/* Title */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-400 mb-2">
                  Title
                </Text>
                <TextInput
                  className="bg-zinc-800 rounded-xl px-4 h-12 text-base text-white"
                  placeholder="Brief summary of the issue"
                  placeholderTextColor="#666"
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    setErrors((e) => ({ ...e, title: undefined }));
                  }}
                  maxLength={100}
                />
                {errors.title && (
                  <Text className="text-red-500 text-xs mt-1">
                    {errors.title}
                  </Text>
                )}
              </View>

              {/* Description */}
              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-400 mb-2">
                  Description
                </Text>
                <TextInput
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-base text-white min-h-[120px]"
                  placeholder="Steps to reproduce, what happened, and what you expected"
                  placeholderTextColor="#666"
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    setErrors((e) => ({ ...e, description: undefined }));
                  }}
                  multiline
                  textAlignVertical="top"
                  maxLength={1000}
                />
                <Text className="text-gray-600 text-xs mt-1 text-right">
                  {description.length}/1000
                </Text>
                {errors.description && (
                  <Text className="text-red-500 text-xs mt-1">
                    {errors.description}
                  </Text>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || !isValid}
                className={`h-[50px] rounded-xl items-center justify-center mb-8 ${
                  isValid && !isSubmitting
                    ? "bg-[#FFCC00]"
                    : "bg-[#FFCC00]/30"
                }`}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text className="text-black font-semibold text-base">
                    Submit Report
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
