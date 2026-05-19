import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoImagePicker from "expo-image-picker";

interface ImagePickerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ImagePicker({
  images,
  onImagesChange,
  maxImages = 5,
}: ImagePickerProps) {
  const pickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert("Limit Reached", `You can only add up to ${maxImages} photos`);
      return;
    }

    const permissionResult = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add images"
      );
      return;
    }

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => asset.uri);
      onImagesChange([...images, ...newImages].slice(0, maxImages));
    }
  };

  const takePhoto = async () => {
    if (images.length >= maxImages) {
      Alert.alert("Limit Reached", `You can only add up to ${maxImages} photos`);
      return;
    }

    const permissionResult = await ExpoImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take photos"
      );
      return;
    }

    const result = await ExpoImagePicker.launchCameraAsync({
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      onImagesChange([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  const showImageOptions = () => {
    Alert.alert("Add Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white text-base font-semibold">
          Add Photos <Text className="text-gray-500 font-normal">(optional)</Text>
        </Text>
        <Text className="text-gray-500 text-sm">
          {images.length}/{maxImages}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {/* Add Photo Button */}
        <TouchableOpacity
          onPress={showImageOptions}
          className="w-24 h-24 rounded-xl bg-zinc-800 border border-dashed border-zinc-600 items-center justify-center"
          activeOpacity={0.7}
        >
          <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
          <Text className="text-gray-500 text-xs mt-1">Add Photo</Text>
        </TouchableOpacity>

        {/* Selected Images */}
        {images.map((uri, index) => (
          <View key={index} className="relative">
            <Image
              source={{ uri }}
              className="w-24 h-24 rounded-xl"
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => removeImage(index)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Text className="text-gray-600 text-xs mt-2">
        Photos help others see the quality of service
      </Text>
    </View>
  );
}
