import { useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FormInput from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useContactForm, useCreateContactMutation, useUpdateContactMutation } from "../hooks";
import { CONTACT_STATUS_OPTIONS } from "../constants/marketingConstants";
import { Contact } from "../services/marketing.interface";

interface ContactFormModalProps {
  visible: boolean;
  onClose: () => void;
  existingContact?: Contact | null;
}

export function ContactFormModal({ visible, onClose, existingContact }: ContactFormModalProps) {
  const { formData, updateField, validate, toCreateData, toUpdateData, reset } = useContactForm(existingContact);
  const createMutation = useCreateContactMutation();
  const updateMutation = useUpdateContactMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Form state is keyed by existingContact at mount time (useContactForm's useState initializer),
  // so it needs an explicit reset on close or the next "Add contact" open would reopen stale values.
  useEffect(() => {
    if (!visible) reset();
  }, [visible]);

  const handleSubmit = () => {
    if (!validate()) return;

    if (existingContact) {
      updateMutation.mutate({ contactId: existingContact.id, data: toUpdateData() }, { onSuccess: onClose });
    } else {
      createMutation.mutate(toCreateData(), { onSuccess: onClose });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View className="bg-zinc-900 rounded-t-3xl max-h-[85%]">
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
                <Text className="text-white text-lg font-semibold">
                  {existingContact ? "Edit contact" : "Add contact"}
                </Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
                <FormInput
                  label="Name"
                  value={formData.fullName}
                  onChangeText={(v) => updateField("fullName", v)}
                  placeholder="Full name"
                />
                <FormInput
                  label="Email"
                  value={formData.email}
                  onChangeText={(v) => updateField("email", v)}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <FormInput
                  label="Phone"
                  value={formData.phone}
                  onChangeText={(v) => updateField("phone", v)}
                  placeholder="+1 555 000 0000"
                  keyboardType="phone-pad"
                />
                <FormInput
                  label="Notes"
                  value={formData.notes}
                  onChangeText={(v) => updateField("notes", v)}
                  placeholder="Optional notes"
                  multiline
                  numberOfLines={3}
                  iconAlign="top"
                />

                {existingContact && (
                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-200 mb-2 ml-1">Status</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {CONTACT_STATUS_OPTIONS.map((option) => {
                        const isSelected = formData.status === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => updateField("status", option.value)}
                            className={`px-3 py-2 rounded-full border ${
                              isSelected ? "bg-[#FFCC00]/10 border-[#FFCC00]" : "bg-zinc-800 border-zinc-800"
                            }`}
                          >
                            <Text
                              className={isSelected ? "text-[#FFCC00] font-semibold text-xs" : "text-gray-300 text-xs"}
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View className="px-5 py-4 border-t border-zinc-800">
                <PrimaryButton
                  title={existingContact ? "Save changes" : "Add contact"}
                  onPress={handleSubmit}
                  loading={isSubmitting}
                />
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}
