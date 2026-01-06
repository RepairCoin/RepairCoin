import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  copySuccess: boolean;
  onCopyLink: () => void;
  onShareWhatsApp: () => void;
  onShareTwitter: () => void;
  onShareFacebook: () => void;
  onNativeShare: () => void;
}

export function ShareModal({
  visible,
  onClose,
  copySuccess,
  onCopyLink,
  onShareWhatsApp,
  onShareTwitter,
  onShareFacebook,
  onNativeShare,
}: ShareModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-zinc-900 rounded-t-3xl px-4 pt-6 pb-10"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">
              Share Service
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Share Options */}
          <View className="flex-row justify-around mb-6">
            {/* Copy Link */}
            <TouchableOpacity onPress={onCopyLink} className="items-center">
              <View
                className={`w-14 h-14 rounded-full items-center justify-center ${copySuccess ? "bg-green-500" : "bg-zinc-800"}`}
              >
                <Ionicons
                  name={copySuccess ? "checkmark" : "link"}
                  size={24}
                  color="white"
                />
              </View>
              <Text className="text-gray-400 text-xs mt-2">
                {copySuccess ? "Copied!" : "Copy Link"}
              </Text>
            </TouchableOpacity>

            {/* WhatsApp */}
            <TouchableOpacity onPress={onShareWhatsApp} className="items-center">
              <View className="w-14 h-14 bg-[#25D366] rounded-full items-center justify-center">
                <Ionicons name="logo-whatsapp" size={24} color="white" />
              </View>
              <Text className="text-gray-400 text-xs mt-2">WhatsApp</Text>
            </TouchableOpacity>

            {/* Twitter/X */}
            <TouchableOpacity onPress={onShareTwitter} className="items-center">
              <View className="w-14 h-14 bg-black rounded-full items-center justify-center border border-zinc-700">
                <Ionicons name="logo-twitter" size={24} color="white" />
              </View>
              <Text className="text-gray-400 text-xs mt-2">Twitter</Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity onPress={onShareFacebook} className="items-center">
              <View className="w-14 h-14 bg-[#1877F2] rounded-full items-center justify-center">
                <Ionicons name="logo-facebook" size={24} color="white" />
              </View>
              <Text className="text-gray-400 text-xs mt-2">Facebook</Text>
            </TouchableOpacity>
          </View>

          {/* More Options Button */}
          <TouchableOpacity
            onPress={onNativeShare}
            className="bg-zinc-800 rounded-xl py-4 items-center flex-row justify-center"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#FFCC00" />
            <Text className="text-white text-base font-semibold ml-2">
              More Options
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
