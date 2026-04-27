import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RedemptionSession, SessionStatus } from "../types";
import { formatAddress } from "../utils";

interface ProcessingStatusModalProps {
  visible: boolean;
  sessionStatus: SessionStatus;
  currentSession: RedemptionSession | null;
  timeRemaining: string;
  isCancellingSession: boolean;
  onCancelSession: () => void;
  onCompleteAnother: () => void;
}

export const ProcessingStatusModal: React.FC<ProcessingStatusModalProps> = ({
  visible,
  sessionStatus,
  currentSession,
  timeRemaining,
  isCancellingSession,
  onCancelSession,
  onCompleteAnother,
}) => {
  const getStatusColor = () => {
    switch (sessionStatus) {
      case "waiting":
        return "bg-[#FFCC00]";
      case "processing":
        return "bg-blue-500";
      default:
        return "bg-green-500";
    }
  };

  const getStatusText = () => {
    switch (sessionStatus) {
      case "waiting":
        return "Waiting for Customer Approval";
      case "processing":
        return "Processing Redemption";
      default:
        return "Redemption Completed";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (sessionStatus === "completed") {
          onCompleteAnother();
        }
      }}
    >
      <View className="flex-1 bg-black/80 justify-end">
        <View className="bg-[#1A1A1A] rounded-t-3xl pt-6 pb-8 px-5 max-h-[80%]">
          {/* Modal Header */}
          <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />

          <Text className="text-white text-xl font-bold mb-6 text-center">
            Processing Status
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status Indicator */}
            <View className="flex-row items-center justify-center mb-6">
              <View className={`w-4 h-4 rounded-full mr-3 ${getStatusColor()}`} />
              <Text className="text-white font-semibold text-lg">
                {getStatusText()}
              </Text>
            </View>

            {/* Customer Notification Info */}
            {sessionStatus === "waiting" && (
              <View className="bg-blue-500/10 rounded-xl p-4 mb-4 border border-blue-500/20">
                <View className="flex-row items-start">
                  <MaterialIcons
                    name="notifications"
                    size={20}
                    color="#3B82F6"
                    style={{ marginRight: 8 }}
                  />
                  <View className="flex-1">
                    <Text className="text-blue-400 font-semibold text-sm mb-1">
                      Request Sent to Customer
                    </Text>
                    <Text className="text-blue-300/80 text-xs">
                      Customer has received a notification to approve this
                      redemption request. They have 5 minutes to respond.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Success Message */}
            {sessionStatus === "completed" && (
              <View className="bg-green-500/10 rounded-xl p-4 mb-4 border border-green-500/20">
                <View className="flex-row items-center justify-center">
                  <MaterialIcons
                    name="check-circle"
                    size={24}
                    color="#10B981"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-green-400 font-semibold">
                    Redemption Successfully Processed!
                  </Text>
                </View>
              </View>
            )}

            {/* Timer Display */}
            {(sessionStatus === "waiting" || sessionStatus === "processing") && (
              <View className="bg-[#0A0A0A] rounded-xl p-4 mb-4 border border-gray-700">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="timer"
                      size={20}
                      color="#EF4444"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-gray-400 text-sm">
                      {sessionStatus === "waiting"
                        ? "Time Remaining"
                        : "Processing Time"}
                    </Text>
                  </View>
                  <Text className="text-red-400 text-xl font-mono font-bold">
                    {timeRemaining}
                  </Text>
                </View>
              </View>
            )}

            {/* Session Details */}
            {currentSession && (
              <View className="bg-[#0A0A0A] rounded-xl p-4 mb-6 border border-gray-700">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-gray-400 text-sm">Amount</Text>
                  <Text className="text-[#FFCC00] font-bold text-lg">
                    -{currentSession.amount} RCN
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-gray-400 text-sm">Customer</Text>
                  <Text className="text-white font-mono text-sm">
                    {formatAddress(currentSession.customerAddress)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-400 text-sm">Session ID</Text>
                  <Text className="text-gray-400 text-xs font-mono">
                    {currentSession.sessionId.slice(-8)}
                  </Text>
                </View>
              </View>
            )}

            {/* Processing Animation */}
            {sessionStatus === "processing" && (
              <View className="flex-row items-center justify-center py-4 mb-4">
                <ActivityIndicator
                  size="large"
                  color="#FFCC00"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-[#FFCC00] font-semibold text-lg">
                  Customer Approved - Processing...
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View className="mt-4 space-y-3">
            {sessionStatus === "waiting" && (
              <View className="space-y-3 gap-4 mb-4">
                <TouchableOpacity
                  onPress={onCancelSession}
                  disabled={isCancellingSession}
                  className="bg-gray-700 py-4 rounded-xl"
                >
                  {isCancellingSession ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text className="text-white font-semibold text-center text-lg">
                      Cancel Request
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {sessionStatus === "completed" && (
              <TouchableOpacity
                onPress={onCompleteAnother}
                className="bg-[#FFCC00] py-4 rounded-xl"
              >
                <Text className="text-black font-semibold text-center text-lg">
                  Process Another Redemption
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
