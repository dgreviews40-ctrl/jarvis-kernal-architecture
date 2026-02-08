# Circuit Breaker Pattern

Resilience pattern for handling cascading failures in external service calls.

## Overview

The Circuit Breaker prevents repeated calls to failing services, allowing them time to recover while providing immediate feedback to callers.

```
CLOSED ──failures──> OPEN ──timeout──> HALF_OPEN ──success──> CLOSED
   ↑                                              │
   └─────────────── failure ──────────────────────┘
```

| State | Behavior |
|-------|----------|
| **CLOSED** | Normal operation - requests pass through |
| **OPEN** | Failing fast - requests immediately rejected |
| **HALF_OPEN** | Testing - limited requests allowed to check recovery |

## Usage

```typescript
import { EnhancedCircuitBreaker } from './services/CircuitBreaker';

const breaker = new EnhancedCircuitBreaker({
  failureThreshold: 5,        // Open after 5 failures
  resetTimeout: 60000,        // Try again after 60 seconds
  timeout: 10000,             // Operation timeout 10s
  halfOpenSuccessThreshold: 1 // Close after 1 success in half-open
});

// Use the circuit breaker
try {
  const result = await breaker.call(() => fetchExternalData());
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    // Handle circuit open
  }
}
```

## Configuration

```typescript
interface CircuitBreakerOptions {
  /** Failures before opening circuit (default: 5) */
  failureThreshold?: number;
  
  /** Time before attempting reset in ms (default: 60000) */
  resetTimeout?: number;
  
  /** Operation timeout in ms (default: 10000) */
  timeout?: number;
  
  /** Successes needed to close from half-open (default: 1) */
  halfOpenSuccessThreshold?: number;
  
  /** Add jitter to prevent thundering herd (default: true) */
  enableJitter?: boolean;
  
  /** Maximum jitter in ms (default: 5000) */
  maxJitterMs?: number;
}
```

## State Transitions

### CLOSED → OPEN

Triggered when failures exceed threshold:

```
Failure count: 1 → 2 → 3 → 4 → 5 (threshold)
                                    ↓
                              State: OPEN
```

### OPEN → HALF_OPEN

After `resetTimeout` + optional jitter:

```typescript
// Without jitter
nextAttempt = now + resetTimeout;  // Exactly 60s

// With jitter (default)
jitter = Math.random() * maxJitterMs;  // 0-5000ms
nextAttempt = now + resetTimeout + jitter;  // 60-65s
```

Jitter prevents multiple clients from retrying simultaneously (thundering herd).

### HALF_OPEN → CLOSED

After `halfOpenSuccessThreshold` successful calls:

```
Half-open state
  ↓
Success: 1/1 (threshold met)
  ↓
State: CLOSED
Failure count reset to 0
```

### HALF_OPEN → OPEN

Any failure in half-open returns to open:

```
Half-open state
  ↓
Failure!
  ↓
State: OPEN
Reset timer with new jitter
```

## Monitoring

Check circuit breaker state:

```typescript
const state = breaker.getState();

console.log(state);
// {
//   state: 'OPEN',
//   failureCount: 5,
//   lastFailureTime: 1704067200000,
//   nextAttemptTime: 1704067265000,
//   canAttemptCall: false,
//   retryAfterMs: 45000
// }
```

### State Properties

| Property | Description |
|----------|-------------|
| `state` | Current state (CLOSED/OPEN/HALF_OPEN) |
| `failureCount` | Consecutive failures since last success |
| `lastFailureTime` | Timestamp of last failure |
| `nextAttemptTime` | When circuit will try HALF_OPEN |
| `canAttemptCall` | Whether calls are currently allowed |
| `retryAfterMs` | Milliseconds until next attempt (if OPEN) |

## Manual Control

### Reset Circuit

```typescript
// Force circuit to CLOSED
breaker.reset();
```

Useful after:
- Manual service recovery verification
- Configuration changes
- Testing

## Integration Examples

### API Client

```typescript
class APIClient {
  private breaker = new EnhancedCircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 30000,
    timeout: 5000
  });

  async fetchData(endpoint: string) {
    return this.breaker.call(
      () => fetch(endpoint).then(r => r.json()),
      8000 // Override timeout for this call
    );
  }
}
```

### With Error Handler

```typescript
import { withRetry } from './services/errorHandler';
import { EnhancedCircuitBreaker } from './services/CircuitBreaker';

const breaker = new EnhancedCircuitBreaker();

async function resilientCall() {
  try {
    return await breaker.call(() => 
      withRetry(() => externalService.call(), {
        operation: 'externalCall'
      })
    );
  } catch (error) {
    if (error.message.includes('Circuit breaker is OPEN')) {
      // Return cached data or fallback
      return getCachedData();
    }
    throw error;
  }
}
```

### Multiple Services

```typescript
const breakers = {
  gemini: new EnhancedCircuitBreaker({ failureThreshold: 3 }),
  ollama: new EnhancedCircuitBreaker({ failureThreshold: 5 }),
  weather: new EnhancedCircuitBreaker({ failureThreshold: 2 })
};

async function callService(service: string, fn: () => Promise<any>) {
  const breaker = breakers[service];
  if (!breaker) throw new Error(`Unknown service: ${service}`);
  
  return breaker.call(fn);
}
```

## Best Practices

### 1. Set Appropriate Thresholds

```typescript
// ✅ Good - external API with occasional hiccups
const apiBreaker = new EnhancedCircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000
});

// ✅ Good - critical service that should fail fast
const criticalBreaker = new EnhancedCircuitBreaker({
  failureThreshold: 2,
  resetTimeout: 30000
});

// ❌ Bad - threshold too high for critical service
const badBreaker = new EnhancedCircuitBreaker({
  failureThreshold: 100  // Too many failures allowed
});
```

### 2. Use Jitter in Distributed Systems

```typescript
// ✅ Good - prevents thundering herd
const breaker = new EnhancedCircuitBreaker({
  enableJitter: true,
  maxJitterMs: 5000
});

// ❌ Bad - all clients retry simultaneously
const badBreaker = new EnhancedCircuitBreaker({
  enableJitter: false
});
```

### 3. Provide Fallbacks

```typescript
// ✅ Good - handle open circuit gracefully
try {
  return await breaker.call(() => fetchData());
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    return getCachedData();
  }
  throw error;
}

// ❌ Bad - let circuit open crash the app
try {
  return await breaker.call(() => fetchData());
} catch (error) {
  throw error;  // No handling
}
```

### 4. Monitor Circuit State

```typescript
// Log state changes for debugging
const state = breaker.getState();
if (state.state === 'OPEN') {
  console.warn(`Circuit open, retry after ${state.retryAfterMs}ms`);
}
```

### 5. Different Timeouts for Different Operations

```typescript
// Quick operation
await breaker.call(() => quickOp(), 1000);

// Slow operation
await breaker.call(() => slowOp(), 30000);
```

## Error Messages

When circuit is OPEN:

```
Circuit breaker is OPEN - service temporarily unavailable. 
Retry after: 45s
```

When operation times out:

```
Operation timed out after 10000ms
```

## Comparison with Retry

| Feature | Circuit Breaker | Retry |
|---------|----------------|-------|
| Purpose | Prevent cascading failures | Handle transient failures |
| State | Maintains state (CLOSED/OPEN/HALF_OPEN) | Stateless |
| Failure handling | Fails fast after threshold | Retries until max attempts |
| Recovery | Waits before retrying | Retries immediately with backoff |
| Use case | External services | Network hiccups |

**Use both together**: Retry for transient failures within a healthy circuit, Circuit Breaker to prevent overwhelming failing services.
