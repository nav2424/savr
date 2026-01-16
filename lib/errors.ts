// SAVR Error Types - Proper error handling without `any`
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', { field, ...context })
    this.name = 'ValidationError'
  }
}

export class APIError extends AppError {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'API_ERROR', { statusCode, endpoint, ...context })
    this.name = 'APIError'
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string,
    public operation?: string,
    public table?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'DATABASE_ERROR', { operation, table, ...context })
    this.name = 'DatabaseError'
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network request failed', context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', context)
    this.name = 'NetworkError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', context)
    this.name = 'AuthenticationError'
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, public missingKey?: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', { missingKey, ...context })
    this.name = 'ConfigurationError'
  }
}

// Type guard functions
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

// Helper to safely extract error message
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

// Helper to safely extract error details
export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      code: error.code,
      context: error.context,
      name: error.name,
    }
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return {}
}
