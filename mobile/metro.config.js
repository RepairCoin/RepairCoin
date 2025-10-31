const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  "react-async-hook": require.resolve("react-async-hook"),
  '@aws-sdk/client-kms': require.resolve('./shims/emptyModule.js'),
  '@aws-sdk/credential-providers': require.resolve('./shims/emptyModule.js'),
  '@aws-sdk/client-lambda': require.resolve('./shims/emptyModule.js'),
  'react-native-quick-crypto': require.resolve('./shims/emptyModule.js'),
  'react-native-aes-gcm-crypto': require.resolve('./shims/emptyModule.js'),
};

module.exports = withNativeWind(config, { input: "./global.css" });
