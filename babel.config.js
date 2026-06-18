module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        { unstable_transformImportMeta: true },
      ],
    ],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./src",
            // Force Zustand middleware CJS build to avoid `import.meta.env`
            // that appears in the ESM middleware bundle on Expo web.
            "zustand/middleware": "./node_modules/zustand/middleware.js",
          },
        },
      ],
      "@babel/plugin-transform-class-static-block",
      "react-native-reanimated/plugin",
    ],
  };
};
