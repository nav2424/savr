// Error Types Tests
import {
  AppError,
  ValidationError,
  APIError,
  DatabaseError,
  NetworkError,
  AuthenticationError,
  ConfigurationError,
  isAppError,
  isValidationError,
  isAPIError,
  isDatabaseError,
  isNetworkError,
  getErrorMessage,
  getErrorDetails,
} from '../errors'

describe('Error Types', () => {
  describe('AppError', () => {
    it('should create error with message', () => {
      const error = new AppError('Test error')
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('AppError')
    })

    it('should create error with code and context', () => {
      const error = new AppError('Test error', 'TEST_CODE', { key: 'value' })
      expect(error.code).toBe('TEST_CODE')
      expect(error.context).toEqual({ key: 'value' })
    })
  })

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input', 'email')
      expect(error.message).toBe('Invalid input')
      expect(error.field).toBe('email')
      expect(error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('APIError', () => {
    it('should create API error with status code', () => {
      const error = new APIError('API failed', 404, '/api/test')
      expect(error.statusCode).toBe(404)
      expect(error.endpoint).toBe('/api/test')
      expect(error.code).toBe('API_ERROR')
    })
  })

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseError('DB failed', 'SELECT', 'users')
      expect(error.operation).toBe('SELECT')
      expect(error.table).toBe('users')
      expect(error.code).toBe('DATABASE_ERROR')
    })
  })

  describe('NetworkError', () => {
    it('should create network error with default message', () => {
      const error = new NetworkError()
      expect(error.message).toBe('Network request failed')
      expect(error.code).toBe('NETWORK_ERROR')
    })
  })

  describe('AuthenticationError', () => {
    it('should create auth error', () => {
      const error = new AuthenticationError()
      expect(error.message).toBe('Authentication failed')
      expect(error.code).toBe('AUTH_ERROR')
    })
  })

  describe('ConfigurationError', () => {
    it('should create config error', () => {
      const error = new ConfigurationError('Missing key', 'API_KEY')
      expect(error.missingKey).toBe('API_KEY')
      expect(error.code).toBe('CONFIG_ERROR')
    })
  })

  describe('Type Guards', () => {
    it('should identify AppError', () => {
      const error = new AppError('Test')
      expect(isAppError(error)).toBe(true)
      expect(isAppError(new Error('Test'))).toBe(false)
    })

    it('should identify ValidationError', () => {
      const error = new ValidationError('Test', 'field')
      expect(isValidationError(error)).toBe(true)
    })

    it('should identify APIError', () => {
      const error = new APIError('Test', 404)
      expect(isAPIError(error)).toBe(true)
    })

    it('should identify DatabaseError', () => {
      const error = new DatabaseError('Test', 'SELECT')
      expect(isDatabaseError(error)).toBe(true)
    })

    it('should identify NetworkError', () => {
      const error = new NetworkError()
      expect(isNetworkError(error)).toBe(true)
    })
  })

  describe('getErrorMessage', () => {
    it('should extract message from Error', () => {
      const error = new Error('Test message')
      expect(getErrorMessage(error)).toBe('Test message')
    })

    it('should extract message from string', () => {
      expect(getErrorMessage('String error')).toBe('String error')
    })

    it('should return default for unknown types', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred')
    })
  })

  describe('getErrorDetails', () => {
    it('should extract details from AppError', () => {
      const error = new AppError('Test', 'CODE', { key: 'value' })
      const details = getErrorDetails(error)
      expect(details.code).toBe('CODE')
      expect(details.context).toEqual({ key: 'value' })
    })

    it('should extract details from Error', () => {
      const error = new Error('Test')
      const details = getErrorDetails(error)
      expect(details.name).toBe('Error')
      expect(details.message).toBe('Test')
    })
  })
})
