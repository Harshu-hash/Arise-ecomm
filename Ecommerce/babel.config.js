module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.js', '.json'],
        alias: {
          '@app': './src/app',
          '@core': './src/core',
          '@shared': './src/shared',
          '@features': './src/features',
          '@navigation': './src/navigation',
          '@hooks': './src/hooks',
          '@contexts': './src/contexts',
          '@services': './src/services',
          '@database': './src/database',
          '@store': './src/store',
          '@styles': './src/styles',
          '@assets': './src/assets',
          '@constants': './src/constants',
          '@configs': './src/configs',
          '@utils': './src/utils',
          '@helpers': './src/helpers',
          '@types': './src/types',
          '@validators': './src/validators',
          '@localization': './src/localization',
          '@permissions': './src/permissions',
          '@theme': './src/theme',
          '@mocks': './src/mocks',
        },
      },
    ],
    // Reanimated plugin must be listed last.
    'react-native-reanimated/plugin',
  ],
};
