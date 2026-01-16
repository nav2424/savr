// SAVR Logger Service - Centralized logging with environment-based levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

class LoggerService {
  private isDev: boolean
  private logLevel: LogLevel

  constructor() {
    // @ts-ignore - __DEV__ is a global in React Native
    this.isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development'
    // In production, only log warnings and errors
    this.logLevel = this.isDev ? 'debug' : 'warn'
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    
    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context, null, 2)}`
    }
    
    return `${prefix} ${message}`
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return
    }

    const formattedMessage = this.formatMessage(level, message, context)

    // In development, use console methods
    if (this.isDev) {
      switch (level) {
        case 'debug':
          console.debug(formattedMessage)
          break
        case 'info':
          console.log(formattedMessage)
          break
        case 'warn':
          console.warn(formattedMessage)
          break
        case 'error':
          console.error(formattedMessage)
          break
      }
    } else {
      // In production, send to error tracking service
      // TODO: Integrate with Sentry, Bugsnag, or similar
      if (level === 'error' || level === 'warn') {
        // For now, still log errors/warnings in production
        // Replace with actual error tracking service
        console.error(formattedMessage)
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  // Convenience method for API errors
  apiError(endpoint: string, error: unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      endpoint,
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    }
    this.error(`API Error: ${endpoint}`, errorContext)
  }

  // Convenience method for database errors
  dbError(operation: string, error: unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      operation,
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    }
    this.error(`Database Error: ${operation}`, errorContext)
  }
}

// Export singleton instance
export const logger = new LoggerService()

// Export type for use in other files
export type { LogLevel, LogContext }
