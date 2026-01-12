import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";

interface FormInputProps extends Omit<TextInputProps, "onChangeText"> {
  label: string;
  icon?: React.ReactNode;
  iconAlign?: "center" | "top";
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helperText?: string;
  rightIcon?: React.ReactNode;
}

function FormInput({
  label,
  icon,
  iconAlign = "center",
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
  editable = true,
  error,
  helperText,
  rightIcon,
  ...rest
}: FormInputProps) {
  const hasError = !!error;

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
        {label}
      </Text>
      <View
        className={`flex-row rounded-xl px-4 ${
          iconAlign === "top" ? "items-start" : "items-center"
        } ${
          hasError
            ? "bg-red-900/20 border border-red-500"
            : editable
            ? "bg-[#2A2A2C]"
            : "bg-[#1A1A1C]"
        }`}
      >
        {icon && (
          <View className={iconAlign === "top" ? "pt-3 mr-2" : "mr-2"}>
            {icon}
          </View>
        )}
        {!editable ? (
          <Text
            className="flex-1 h-12 text-base text-gray-500 leading-[48px]"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {value || placeholder}
          </Text>
        ) : (
          <TextInput
            className={`flex-1 h-12 text-base ${
              editable ? "text-white" : "text-gray-500"
            }`}
            placeholder={placeholder}
            placeholderTextColor="#666"
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            editable={editable}
            {...rest}
          />
        )}
        {rightIcon && <View className="ml-3">{rightIcon}</View>}
      </View>
      {hasError && (
        <Text className="text-red-500 text-xs mt-1 ml-1">{error}</Text>
      )}
      {helperText && !hasError && (
        <Text className="text-gray-500 text-xs mt-1 ml-1">{helperText}</Text>
      )}
    </View>
  );
}

export default React.memo(FormInput);
