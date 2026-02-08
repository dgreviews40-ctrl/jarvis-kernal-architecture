# Error Handling System

Comprehensive error handling with structured error types, smart retry mechanisms, and graceful degradation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Type System                        │
│  (services/errorTypes.ts)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Error Codes │  │   Retry     │  │   Error Severity    │ │
│  │  (enum)     │  │ Strategies  │  │   (enum)            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Error Handler Service                     │
│  (services/errorHandler.ts)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Retry     │  │   Graceful  │  │   Error Tracking    │ │
│  │   Logic     │  │  Degradation│  │   & Reporting       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Error Types (`services/errorTypes.ts`)

### Error Severity Levels

```typescript
enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}
```

### Error Codes

Organized by category with programmatic handling:

| Category | Range | Examples |
|----------|-------|----------|
| Network | 1xxx | `NET_001`, `NET_002` (timeout, refused) |
| HTTP | 2xxx | `HTTP_400`, `HTTP_500`, `HTTP_429` |
| API | 3xxx | `API_001`, `API_003` (key invalid, quota) |
| Validation | 4xxx | `VAL_001`, `VAL_002` |
| Resource | 5xxx | `RES_001`, `RES_004` |
| Runtime | 6xxx | `RUN_001`, `RUN_002` |
| Plugin | 7xxx | `PLG_001`, `PLG_004` |
| Security | 8xxx | `SEC_001`, `SEC_005` |

### Error Hierarchy

```typescript
// Base error class
class JARVISError extends Error {
  code: ErrorCode;
  severity: ErrorSeverity;
  context?: Record<string, unknown>;
  retryable: boolean;
}

// Specific error types
class NetworkError extends JARVISError {}
class TimeoutError extends JARVISError {}
class AuthError extends JARVISError {}
class QuotaError extends JARVISError {}
class ValidationError extends JARVISError {}
class PluginError extends JARVISError {}
class SecurityError extends JARVISError {}
```

### Retry Strategies

Each error code has a configured retry strategy:

```typescript
interface RetryStrategy {
  retryable: boolean;        // Can this error be retried?
  maxAttempts: number;       // Max retry attempts
  baseDelayMs: number;       // Initial delay
  maxDelayMs: number;        // Maximum delay
  backoffMultiplier: number; // 1 = linear, 2 = exponential
  useJitter: boolean;        // Add randomness to prevent thundering herd
}
```

#### Default Strategies

| Error Type | Retryable | Max Attempts | Backoff |
|------------|-----------|--------------|---------|
| Network | ✅ Yes | 5 | Exponential |
| Timeout | ✅ Yes | 3 | Exponential |
| Rate Limit | ✅ Yes | 3 | Linear |
| HTTP 5xx | ✅ Yes | 3 | Exponential |
| Auth | ❌ No | 0 | - |
| Validation | ❌ No | 0 | - |
| Quota | ✅ Limited | 2 | Linear |

### Error Classification

```typescript
import { classifyError, isRetryableError, getRetryStrategy } from './services/errorTypes';

try {
  await riskyOperation();
} catch (error) {
  const jarvisError = classifyError(error);
  
  if (isRetryableError(jarvisError)) {
    const strategy = getRetryStrategy(jarvisError.code);
    // Apply retry logic
  }
}
```

## Error Handler (`services/errorHandler.ts`)

### Smart Retry with `withRetry`

```typescript
import { withRetry } from './services/errorHandler';

const result = await withRetry(
  () => fetchData(),
  { 
    operation: 'fetchData', 
    component: 'DataComponent',
    maxAttempts: 3,
    onRetry: (error, attempt, delay) => {
      console.log(`Retry ${attempt} after ${delay}ms`);
    }
  }
);
```

### Retry Configuration

```typescript
interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  useJitter?: boolean;
  errorClassifier?: (error: unknown) => JARVISError;
  onRetry?: (error: JARVISError, attempt: number, nextDelay: number) => void;
  onFailed?: (error: JARVISError, attempts: number) => void;
}
```

### Graceful Degradation

```typescript
import { withDegradation } from './services/errorHandler';

const result = await withDegradation(
  () => heavyComputation(),           // Primary operation
  fallbackValue,                       // Fallback if operation fails
  { operation: 'compute', component: 'ComputeComponent' },
  'advancedFeature'                    // Feature name for tracking
);
```

When degradation occurs:
1. Returns fallback value immediately
2. Tracks feature as degraded
3. Logs error to cortex
4. Prevents cascading failures

### Error State Tracking

The error handler tracks:

- **Error counts** per operation
- **Error timestamps** for rate analysis
- **Degraded features** to prevent repeated attempts

```typescript
// Check if feature is degraded
import { isFeatureDegraded } from './services/errorHandler';

if (isFeatureDegraded('advancedFeature')) {
  // Use simplified approach
}

// Reset degradation
resetDegradedFeature('advancedFeature');
```

## Usage Examples

### Basic Retry

```typescript
import { withRetry } from './services/errorHandler';

async function fetchUserData(userId: string) {
  return withRetry(
    () => api.get(`/users/${userId}`),
    { operation: 'fetchUser', component: 'UserService' }
  );
}
```

### With Fallback

```typescript
import { withDegradation } from './services/errorHandler';

async function getRecommendations() {
  return withDegradation(
    () => aiService.getRecommendations(),
    getDefaultRecommendations(), // Fallback
    { operation: 'getRecommendations', component: 'RecommendationEngine' },
    'aiRecommendations'
  );
}
```

### Custom Error Handling

```typescript
import { JARVISError, ErrorCode, ErrorSeverity } from './services/errorTypes';

function validateInput(data: unknown) {
  if (!data) {
    throw new JARVISError(
      'Input is required',
      ErrorCode.MISSING_REQUIRED_FIELD,
      ErrorSeverity.ERROR,
      { field: 'data' }
    );
  }
}
```

### Error Reporting

```typescript
import { logError } from './services/errorTypes';

logError(error, {
  source: 'MyComponent',
  context: { userId: '123', action: 'save' }
});
```

## Legacy Support

Backward-compatible functions for existing code:

```typescript
// Legacy classification (maps to ErrorCategory)
const category = classifyErrorLegacy(error);

// Legacy retry check
const shouldRetry = isRetryable(error, { 
  retryableErrors: ['network', 'timeout'] 
});

// Legacy delay calculation
const delay = calculateRetryDelayLegacy(attempt, { 
  baseDelay: 1000 
});
```

## Integration with Cortex

Errors are automatically reported to Cortex for health tracking:

```typescript
// High severity errors reported as CRASH
cortex.reportEvent({
  sourceId: component,
  type: HealthEventType.CRASH,
  impact: ImpactLevel.HIGH,
  latencyMs: 0,
  context: { error: error.message }
});
```

## Best Practices

### 1. Use Structured Error Types

```typescript
// ✅ Good - structured error
throw new NetworkError('Connection failed', { endpoint: '/api/data' });

// ❌ Bad - generic error
throw new Error('Connection failed');
```

### 2. Provide Context

```typescript
// ✅ Good - helpful context
throw new ValidationError('Invalid input', {
  field: 'email',
  value: input,
  constraint: 'must be valid email'
});

// ❌ Bad - no context
throw new ValidationError('Invalid');
```

### 3. Choose Appropriate Severity

```typescript
// DEBUG - diagnostic info
logger.debug('Processing item', { id });

// INFO - normal operations
logger.info('User logged in', { userId });

// WARNING - recoverable issues
logger.warning('API slow', { latency: 5000 });

// ERROR - operation failed
logger.error('Save failed', { error });

// FATAL - system cannot continue
logger.fatal('Database unreachable');
```

### 4. Handle Retryable Errors

```typescript
// ✅ Good - check retryable before retrying
if (isRetryableError(error)) {
  await retry(operation);
} else {
  // Fail fast for non-retryable errors
  throw error;
}
```

### 5. Use Graceful Degradation

```typescript
// ✅ Good - provide fallback for non-critical features
const result = await withDegradation(
  () => aiEnhancement(data),
  data, // Return original if enhancement fails
  context,
  'aiEnhancement'
);
```

## Error Recovery Dashboard

Errors are tracked and can be monitored through:

- Console logs with structured format
- Cortex health events
- Error counts and timestamps (internal tracking)
- Degraded features list

Access error statistics programmatically:

```typescript
import { getErrorStats } from './services/errorHandler';

const stats = getErrorStats();
console.log(stats.errorCounts);
console.log(stats.degradedFeatures);
```
