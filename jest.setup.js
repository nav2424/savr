// Jest setup file - runs before each test file
// Note: @testing-library/jest-native is deprecated, but matchers are built into @testing-library/react-native v12.4+

// Mock __DEV__ global
global.__DEV__ = true

// Mock Expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
  manifest: {
    extra: {},
  },
  appOwnership: 'expo',
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSegments: () => [],
  Stack: ({ children }) => children,
}))

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Suppress console errors in tests (optional - remove if you want to see them)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
