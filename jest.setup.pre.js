jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => ({
  UIManager: {},
  NativeUnimoduleProxy: {
    viewManagersMetadata: {},
  },
}))

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native')
  return {
    ...actual,
    NativeModules: {
      ...(actual.NativeModules || {}),
      UIManager: {},
      NativeUnimoduleProxy: {
        viewManagersMetadata: {},
      },
    },
  }
})
