import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useSubmitIssueReport } from "../hooks/useSubmitIssueReport";
import {
  IssueReportCategory,
  IssueReportSeverity,
} from "@/feature/shop/services/shop.interface";

interface ReportCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  customerName?: string;
  customerAddress?: string;
}

const CATEGORIES: { value: IssueReportCategory; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "fraud", label: "Fraud" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate_review", label: "Inappropriate Review" },
  { value: "other", label: "Other" },
];

const SEVERITIES: { value: IssueReportSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const MIN_DESC = 10;
const MAX_DESC = 500;

export default function ReportCustomerModal({
  visible,
  onClose,
  customerName,
  customerAddress,
}: ReportCustomerModalProps) {
  const [category, setCategory] = useState<IssueReportCategory>("spam");
  const [severity, setSeverity] = useState<IssueReportSeverity>("medium");
  const [description, setDescription] = useState("");

  const resetAndClose = () => {
    setCategory("spam");
    setSeverity("medium");
    setDescription("");
    onClose();
  };

  const { mutate, isPending } = useSubmitIssueReport(resetAndClose);

  const canSubmit = description.trim().length >= MIN_DESC && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutate({
      category,
      severity,
      description: description.trim(),
      relatedEntityType: "customer",
      relatedEntityId: customerAddress,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isPending ? undefined : onClose}
    >
      <Pressable
        className="flex-1 bg-black/70 justify-center items-center px-6"
        onPress={isPending ? undefined : onClose}
      >
        <Pressable
          className="bg-zinc-900 rounded-3xl w-full overflow-hidden"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="items-center pt-6 pb-3 px-6">
            <View className="w-14 h-14 rounded-full bg-red-500/15 items-center justify-center mb-3">
              <MaterialIcons name="report-problem" size={28} color="#EF4444" />
            </View>
            <Text className="text-white text-xl font-bold">Report Customer</Text>
            {customerName ? (
              <Text className="text-gray-400 text-sm mt-1">{customerName}</Text>
            ) : null}
          </View>

          <ScrollView
            className="px-6"
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Category */}
            <Text className="text-gray-300 text-sm font-semibold mb-2">
              Category
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    className={`px-3 py-2 rounded-full border ${
                      active
                        ? "bg-[#FFCC00] border-[#FFCC00]"
                        : "bg-zinc-800 border-zinc-700"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        active ? "text-black" : "text-gray-300"
                      }`}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Severity */}
            <Text className="text-gray-300 text-sm font-semibold mb-2">
              Severity
            </Text>
            <View className="flex-row gap-2 mb-4">
              {SEVERITIES.map((s) => {
                const active = severity === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => setSeverity(s.value)}
                    className={`flex-1 py-2 rounded-lg border items-center ${
                      active
                        ? "bg-[#FFCC00] border-[#FFCC00]"
                        : "bg-zinc-800 border-zinc-700"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        active ? "text-black" : "text-gray-300"
                      }`}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300 text-sm font-semibold">
                Description
              </Text>
              <Text className="text-gray-500 text-xs">
                {description.length}/{MAX_DESC}
              </Text>
            </View>
            <TextInput
              className="bg-zinc-800 rounded-xl px-3 py-3 text-white text-sm"
              placeholder="Describe the issue (min 10 characters)"
              placeholderTextColor="#666"
              value={description}
              onChangeText={(t) => setDescription(t.slice(0, MAX_DESC))}
              multiline
              numberOfLines={4}
              style={{ minHeight: 96, textAlignVertical: "top" }}
            />
          </ScrollView>

          {/* Actions */}
          <View className="px-6 pt-4 pb-6 flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isPending}
              className="flex-1 py-3.5 rounded-xl bg-zinc-800 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-white font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center ${
                canSubmit ? "bg-red-500" : "bg-red-500/40"
              }`}
              activeOpacity={0.7}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="alert-circle" size={18} color="#fff" />
                  <Text className="text-white font-bold ml-1.5">
                    Submit Report
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
