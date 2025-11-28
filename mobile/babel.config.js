module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [
      // NativeWind's babel plugin (without worklets - we use reanimated's)
      require("react-native-css-interop/dist/babel-plugin").default,
      [
        "@babel/plugin-transform-react-jsx",
        {
          runtime: "automatic",
          importSource: "react-native-css-interop",
        },
      ],
      // Use reanimated's built-in worklets (for reanimated 3.x)
      "react-native-reanimated/plugin",
    ],
  };
};
