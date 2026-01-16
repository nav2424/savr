# 🔄 Migration Guide - Codebase Improvements

This guide helps you migrate existing code to use the new error handling, logging, and type safety improvements.

---

## 1. 🔴 Replace `console.log` with Logger

### Before:
```typescript
console.log('User added item:', itemName)
console.error('Error:', error)
console.warn('Warning message')
```

### After:
```typescript
import { logger } from '../lib/Logger'

logger.info('User added item', { itemName })
logger.error('Error occurred', { error })
logger.warn('Warning message')
```

### Migration Steps:
1. Import logger: `import { logger } from '../lib/Logger'`
2. Replace `console.log` → `logger.info`
3. Replace `console.error` → `logger.error`
4. Replace `console.warn` → `logger.warn`
5. Replace `console.debug` → `logger.debug`
6. Add context as second parameter for better debugging

---

## 2. 🔴 Replace `any` Types with Proper Error Types

### Before:
```typescript
try {
  // operation
} catch (error: any) {
  console.error('Error:', error.message)
  // Handle error
}
```

### After:
```typescript
import { AppError, DatabaseError, APIError, getErrorMessage, isAppError } from '../lib/errors'
import { logger } from '../lib/Logger'

try {
  // operation
} catch (error: unknown) {
  logger.error('Operation failed', { error })
  
  if (isAppError(error)) {
    // Handle known error types
    if (error.code === 'DATABASE_ERROR') {
      // Handle database error
    }
  } else {
    // Handle unknown errors
    const message = getErrorMessage(error)
    // Show user-friendly message
  }
}
```

### Common Patterns:

#### Database Errors:
```typescript
// Before
catch (error: any) {
  console.error('DB error:', error)
}

// After
import { DatabaseError } from '../lib/errors'
catch (error: unknown) {
  logger.dbError('operation_name', error)
  throw new DatabaseError('Failed to perform operation', 'OPERATION', 'table_name')
}
```

#### API Errors:
```typescript
// Before
catch (error: any) {
  console.error('API error:', error)
}

// After
import { APIError } from '../lib/errors'
catch (error: unknown) {
  logger.apiError('/api/endpoint', error)
  throw new APIError('API request failed', 500, '/api/endpoint')
}
```

---

## 3. 🔴 Use Error Boundary

### Already Implemented:
The Error Boundary is already set up in `app/_layout.tsx`. No action needed!

### Custom Error UI:
If you want custom error UI for specific screens:

```typescript
import { ErrorBoundary } from '../lib/ErrorBoundary'

function MyScreen() {
  return (
    <ErrorBoundary fallback={<CustomErrorUI />}>
      <YourComponent />
    </ErrorBoundary>
  )
}
```

---

## 4. 🔴 Add API Key Validation

### Already Implemented:
Configuration validation runs automatically on app startup in `app/_layout.tsx`.

### Check if Config Exists:
```typescript
import { hasConfig, getConfig } from '../lib/ConfigValidator'

if (hasConfig('EXPO_PUBLIC_OPENAI_API_KEY')) {
  const apiKey = getConfig('EXPO_PUBLIC_OPENAI_API_KEY')
  // Use API key
}
```

---

## 5. 🧪 Writing Tests

### Example Test Structure:
```typescript
// lib/__tests__/MyService.test.ts
import { MyService } from '../MyService'

describe('MyService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should do something', () => {
    const result = MyService.doSomething()
    expect(result).toBeDefined()
  })
})
```

### Running Tests:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage  # With coverage
```

---

## 6. 📋 Priority Files to Migrate

### High Priority (Critical Paths):
1. `lib/AuthContext.tsx` - ✅ Already updated
2. `lib/PantryContext.tsx` - Update error handling
3. `lib/CollaborativeListsContext.tsx` - Update error handling
4. `lib/RecipesContext.tsx` - Update error handling
5. `lib/BarcodeService.ts` - Update error handling
6. `lib/ScanningService.ts` - Update error handling

### Medium Priority:
7. `app/(tabs)/index.tsx` - Replace console.logs
8. `app/(tabs)/pantry.tsx` - Replace console.logs
9. `app/scan.tsx` - Replace console.logs
10. `components/SageAssistantV2.tsx` - Replace console.logs

---

## 7. 🔍 Finding Console.logs to Replace

### Search Command:
```bash
# Find all console.log statements
grep -r "console\.log" --include="*.ts" --include="*.tsx" lib/ app/ components/

# Find all console.error statements
grep -r "console\.error" --include="*.ts" --include="*.tsx" lib/ app/ components/

# Find all `any` types
grep -r ": any" --include="*.ts" --include="*.tsx" lib/ app/ components/
```

---

## 8. ✅ Checklist for Each File

When updating a file:

- [ ] Replace `console.log` → `logger.info`
- [ ] Replace `console.error` → `logger.error`
- [ ] Replace `console.warn` → `logger.warn`
- [ ] Replace `catch (error: any)` → `catch (error: unknown)`
- [ ] Add proper error types (DatabaseError, APIError, etc.)
- [ ] Use type guards (`isAppError`, etc.)
- [ ] Add context to logger calls
- [ ] Test the changes

---

## 9. 🎯 Quick Reference

### Logger Methods:
```typescript
logger.debug('Debug message', { context })
logger.info('Info message', { context })
logger.warn('Warning message', { context })
logger.error('Error message', { context })
logger.apiError('/endpoint', error, { context })
logger.dbError('operation', error, { context })
```

### Error Types:
```typescript
new AppError(message, code?, context?)
new ValidationError(message, field?, context?)
new APIError(message, statusCode?, endpoint?, context?)
new DatabaseError(message, operation?, table?, context?)
new NetworkError(message?, context?)
new AuthenticationError(message?, context?)
new ConfigurationError(message, missingKey?, context?)
```

### Type Guards:
```typescript
isAppError(error)
isValidationError(error)
isAPIError(error)
isDatabaseError(error)
isNetworkError(error)
```

### Helpers:
```typescript
getErrorMessage(error)      // Safe error message extraction
getErrorDetails(error)      // Safe error details extraction
```

---

## 10. 🚀 Benefits After Migration

✅ **Better Error Handling:**
- Proper error types instead of `any`
- Type-safe error handling
- Better IDE support

✅ **Better Logging:**
- Environment-based logging
- Structured logs with context
- Production-ready logging

✅ **Better Testing:**
- Test infrastructure ready
- Example tests provided
- Coverage tracking

✅ **Better User Experience:**
- Error Boundary prevents crashes
- User-friendly error messages
- Better debugging in dev mode

---

## 11. 📞 Need Help?

If you encounter issues during migration:

1. Check the example files:
   - `lib/__tests__/Logger.test.ts`
   - `lib/__tests__/errors.test.ts`
   - `lib/AuthContext.tsx` (partially migrated)

2. Run tests to verify:
   ```bash
   npm test
   ```

3. Check TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

---

**Happy Migrating! 🎉**
