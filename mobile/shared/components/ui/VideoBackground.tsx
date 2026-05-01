import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { Video, ResizeMode, AVPlaybackSource } from "expo-av";

interface VideoBackgroundProps {
  source: AVPlaybackSource;
  children: ReactNode;
}

export default function VideoBackground({ source, children }: VideoBackgroundProps) {
  return (
    <View className="h-full w-full">
      <Video
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
      {children}
    </View>
  );
}
