module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            // Force Zustand middleware CJS build to avoid `import.meta.env`
            // that appears in the ESM middleware bundle on Expo web.
            'zustand/middleware': './node_modules/zustand/middleware.js',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
