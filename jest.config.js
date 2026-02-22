// Jest configuration for SAVR mobile app
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.pre.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^react-native/Libraries/BatchedBridge/NativeModules$': '<rootDir>/jest.mocks/native-modules.js',
    '^expo-modules-core/build/Refs$': '<rootDir>/jest.mocks/expo-modules-core-refs.js',
    '^expo-modules-core/build/web/index\\.web$': '<rootDir>/jest.mocks/expo-modules-core-web.js',
    '^expo/build/winter$': '<rootDir>/jest.mocks/expo-build-winter.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
}
