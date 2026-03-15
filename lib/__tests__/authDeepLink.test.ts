/**
 * Sign-up / email verification flow helpers
 */
import {
  getEmailVerificationRedirectUrl,
  getAuthTokensFromUrl,
  createSessionFromUrl,
} from '../authDeepLink'

const mockSetSession = jest.fn()

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}))

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      setSession: (...args: unknown[]) => mockSetSession(...args),
    },
  },
}))

describe('getEmailVerificationRedirectUrl', () => {
  beforeEach(() => {
    const Constants = require('expo-constants').default
    Constants.expoConfig.extra = {}
  })

  it('returns savr://email-verification when env is not set', () => {
    expect(getEmailVerificationRedirectUrl()).toBe('savr://email-verification')
  })

  it('returns env value when EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL is set', () => {
    const Constants = require('expo-constants').default
    Constants.expoConfig.extra.EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL = 'https://example.com/verify'
    expect(getEmailVerificationRedirectUrl()).toBe('https://example.com/verify')
  })

  it('trims whitespace from env value', () => {
    const Constants = require('expo-constants').default
    Constants.expoConfig.extra.EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL = '  savr://email-verification  '
    expect(getEmailVerificationRedirectUrl()).toBe('savr://email-verification')
  })
})

describe('getAuthTokensFromUrl', () => {
  it('parses access_token and refresh_token from hash', () => {
    const url = 'savr://email-verification#access_token=abc123&refresh_token=xyz789&type=signup'
    expect(getAuthTokensFromUrl(url)).toEqual({
      access_token: 'abc123',
      refresh_token: 'xyz789',
    })
  })

  it('parses from query string when no hash', () => {
    const url = 'https://example.com/callback?access_token=at&refresh_token=rt'
    expect(getAuthTokensFromUrl(url)).toEqual({
      access_token: 'at',
      refresh_token: 'rt',
    })
  })

  it('parses tokens from query even when hash exists', () => {
    const url = 'savr://email-verification?access_token=at&refresh_token=rt#type=signup'
    expect(getAuthTokensFromUrl(url)).toEqual({
      access_token: 'at',
      refresh_token: 'rt',
    })
  })

  it('returns empty object when no tokens', () => {
    expect(getAuthTokensFromUrl('savr://email-verification')).toEqual({})
    expect(getAuthTokensFromUrl('savr://email-verification#type=signup')).toEqual({})
  })

  it('returns empty object for invalid or empty URL', () => {
    expect(getAuthTokensFromUrl('')).toEqual({})
  })
})

describe('createSessionFromUrl', () => {
  beforeEach(() => {
    mockSetSession.mockReset()
  })

  it('returns false when URL has no access_token', async () => {
    const result = await createSessionFromUrl('savr://email-verification')
    expect(result).toBe(false)
    expect(mockSetSession).not.toHaveBeenCalled()
  })

  it('calls setSession and returns true when URL has tokens and setSession succeeds', async () => {
    mockSetSession.mockResolvedValue({ error: null })
    const url = 'savr://email-verification#access_token=at&refresh_token=rt'
    const result = await createSessionFromUrl(url)
    expect(result).toBe(true)
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: 'rt',
    })
  })

  it('returns false when setSession returns error', async () => {
    mockSetSession.mockResolvedValue({ error: new Error('Invalid token') })
    const url = 'savr://email-verification#access_token=at&refresh_token=rt'
    const result = await createSessionFromUrl(url)
    expect(result).toBe(false)
  })

  it('uses empty string for refresh_token when missing', async () => {
    mockSetSession.mockResolvedValue({ error: null })
    const url = 'savr://email-verification#access_token=at'
    await createSessionFromUrl(url)
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: '',
    })
  })
})
