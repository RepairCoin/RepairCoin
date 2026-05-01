import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

interface VideoBackgroundProps {
  source: number;
  children: ReactNode;
}

export default function VideoBackground({ source, children }: VideoBackgroundProps) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View className="h-full w-full">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {children}
    </View>
  );
}
