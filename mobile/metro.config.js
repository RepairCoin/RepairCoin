const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  "react-async-hook": require.resolve("react-async-hook"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
