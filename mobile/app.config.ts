import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const ENV = process.env.APP_ENV;
  const isProd = ENV === 'production';
  
  return {
    name: "FixFlow",
    slug: "repaircoin-app",
    owner: "repaircoin",
    version: "1.0.3",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "repaircoin",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    ios: {
      supportsTablet: false,
      bundleIdentifier: isProd
        ? "com.repaircoin.app"
        : "com.repaircoin.staging",
      runtimeVersion: "1.0.0",
      buildNumber: "1.0.0",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "FixFlow uses your location to show repair shops near you. For example, when browsing the service marketplace, your location helps sort and display the closest available shops so you can find and book a nearby repair service.",
        NSLocationAlwaysUsageDescription:
          "FixFlow uses your location to show repair shops near you. For example, when browsing the service marketplace, your location helps sort and display the closest available shops so you can find and book a nearby repair service.",
        NSCameraUsageDescription:
          "FixFlow uses your camera to scan QR codes at repair shops and take photos for service bookings or profile pictures.",
        NSPhotoLibraryUsageDescription:
          "FixFlow needs access to your photo library so you can select and upload profile photos and service images. For example, shop owners can upload photos of their services, and customers can set a profile picture from their existing photos.",
      },
      appleTeamId: "HSX33PFXS6",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      versionCode: 4,
      googleServicesFile: "./google-services.json",
      package: "com.repaircoin.app",
      runtimeVersion: {
        policy: "appVersion",
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_MEDIA_LOCATION",
        "android.permission.INTERNET",
        "android.permission.VIBRATE",
      ],
      blockedPermissions: [
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        // Auto-injected by expo-media-library but never used — the app only
        // ever handles images (all image-picker calls are mediaTypes: Images).
        // Blocked to clear Google Play's Photo & Video Permissions flag.
        "android.permission.READ_MEDIA_VIDEO",
      ],
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "./plugins/withReleaseSigningConfig",
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          // Brand dark, matching the in-app Screen background (bg-black). White
          // here is what makes a cold start (esp. opening from a push) flash a
          // blank white screen before content is ready.
          backgroundColor: "#000000",
        },
      ],
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 26,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            usesCleartextTraffic: true,
          },
          ios: {
            deploymentTarget: "15.1",
          },
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "FixFlow uses your location to show repair shops near you. For example, when browsing the service marketplace, your location helps sort and display the closest available shops so you can find and book a nearby repair service.",
          locationWhenInUsePermission:
            "FixFlow uses your location to show repair shops near you. For example, when browsing the service marketplace, your location helps sort and display the closest available shops so you can find and book a nearby repair service.",
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow FixFlow to access your camera to scan QR codes and take photos.",
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "FixFlow needs access to your photo library so you can select and upload profile photos and service images. For example, shop owners can upload photos of their services, and customers can set a profile picture from their existing photos.",
          cameraPermission:
            "Allow FixFlow to access your camera to take photos.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/notification-icon.png",
          color: "#FFCC00",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission: "FixFlow needs access to your photo library to save your wallet QR code image.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: "ac220b86-d08f-403e-a3bb-d1657b30f245",
      },
      router: {},
      appEnv: ENV,
    },
    updates: {
      enabled: true,
      checkAutomatically: "ON_LOAD" as const,
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/ac220b86-d08f-403e-a3bb-d1657b30f245",
    },
  };
};
