import { useState } from "react";
import { Modal, TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatDate } from "@/shared/utilities/format";

interface ScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  value: Date | null;
  onChange: (date: Date | null) => void;
}

// Headroom over useCampaignComposer's "must be in the future" validation so the picked
// time doesn't go stale between confirming here and reaching the review step's submit.
const MIN_LEAD_MS = 2 * 60 * 1000;

/** DateTimePicker used directly, per CreatePromoCodeScreen — no shared bottom-sheet wrapper exists. */
export function ScheduleSheet({ visible, onClose, value, onChange }: ScheduleSheetProps) {
  const [draft, setDraft] = useState<Date>(value ?? new Date(Date.now() + 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleDateChange = (selected?: Date) => {
    setShowDatePicker(false);
    if (!selected) return;
    setDraft((prev) => {
      const next = new Date(prev);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
  };

  const handleTimeChange = (selected?: Date) => {
    setShowTimePicker(false);
    if (!selected) return;
    setDraft((prev) => {
      const next = new Date(prev);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return next;
    });
  };

  const timeLabel = draft.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const tooSoon = draft.getTime() <= Date.now() + MIN_LEAD_MS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-zinc-900 rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-semibold">Schedule for later</Text>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="bg-zinc-800 p-3.5 rounded-xl flex-row justify-between items-center mb-3"
            >
              <Text className="text-white">{formatDate(draft)}</Text>
              <Ionicons name="calendar-outline" size={20} color="#FFCC00" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="bg-zinc-800 p-3.5 rounded-xl flex-row justify-between items-center mb-5"
            >
              <Text className="text-white">{timeLabel}</Text>
              <Ionicons name="time-outline" size={20} color="#FFCC00" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={draft}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(_, selected) => handleDateChange(selected)}
              />
            )}
            {showTimePicker && (
              <DateTimePicker value={draft} mode="time" display="default" onChange={(_, selected) => handleTimeChange(selected)} />
            )}

            <View className="flex-row gap-3">
              {value && (
                <TouchableOpacity
                  onPress={() => {
                    onChange(null);
                    onClose();
                  }}
                  className="flex-1 bg-zinc-800 rounded-xl py-3.5 items-center"
                >
                  <Text className="text-gray-300 font-semibold">Send now instead</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  onChange(draft);
                  onClose();
                }}
                disabled={tooSoon}
                className={`flex-1 rounded-xl py-3.5 items-center ${tooSoon ? "bg-[#FFCC00]/30" : "bg-[#FFCC00]"}`}
              >
                <Text className="text-black font-bold">Set schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
