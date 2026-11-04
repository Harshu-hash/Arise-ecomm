module.exports = {
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer)/)',
  ],
  moduleNameMapper: {
    '^react-native-config$': '<rootDir>/src/test/mocks/reactNativeConfig.js',
    '^react-native-keychain$': '<rootDir>/src/test/mocks/reactNativeKeychain.js',
    '^react-native-mmkv$': '<rootDir>/src/test/mocks/reactNativeMmkv.js',
    '^react-native-image-picker$': '<rootDir>/src/test/mocks/reactNativeImagePicker.js',
  },
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/**/*.test.{js,jsx}', '!src/**/index.js'],
  clearMocks: true,
};
