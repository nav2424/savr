// Logger Service Tests
import { logger } from '../Logger'

// Mock console methods
const mockConsoleDebug = jest.fn()
const mockConsoleLog = jest.fn()
const mockConsoleWarn = jest.fn()
const mockConsoleError = jest.fn()

beforeAll(() => {
  global.console.debug = mockConsoleDebug
  global.console.log = mockConsoleLog
  global.console.warn = mockConsoleWarn
  global.console.error = mockConsoleError
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Logger', () => {
  describe('debug', () => {
    it('should log debug messages in development', () => {
      logger.debug('Test debug message', { key: 'value' })
      expect(mockConsoleDebug).toHaveBeenCalled()
    })
  })

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info message')
      expect(mockConsoleLog).toHaveBeenCalled()
    })

    it('should include context in logs', () => {
      const context = { userId: '123', action: 'test' }
      logger.info('Test message', context)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      )
    })
  })

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Test warning')
      expect(mockConsoleWarn).toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Test error')
      expect(mockConsoleError).toHaveBeenCalled()
    })
  })

  describe('apiError', () => {
    it('should log API errors with endpoint context', () => {
      const error = new Error('API failed')
      logger.apiError('/api/test', error)
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('API Error: /api/test')
      )
    })
  })

  describe('dbError', () => {
    it('should log database errors with operation context', () => {
      const error = new Error('DB failed')
      logger.dbError('SELECT', error)
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Database Error: SELECT')
      )
    })
  })
})
