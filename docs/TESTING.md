# Testing Guide

Comprehensive testing strategy for JARVIS including unit, integration, performance, and E2E tests.

## Test Structure

```
tests/
├── unit/                    # Unit tests (381 tests)
│   ├── cache.test.ts
│   ├── secureStorage.test.ts
│   ├── eventBus.test.ts
│   ├── notificationService.test.ts
│   ├── logger.test.ts
│   ├── settings.test.ts
│   ├── providers.test.ts
│   └── services.integration.test.ts
├── performance/             # Performance & stress tests (21 tests)
│   └── services.performance.test.ts
└── setup.ts                 # Test configuration
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run specific test file
npm test -- tests/unit/cache.test.ts

# Run with coverage
npm test -- --coverage

# Run only unit tests
npm test -- tests/unit

# Run only performance tests
npm test -- tests/performance
```

## Unit Tests (381 tests)

### Test Categories

| Service | Tests | Focus |
|---------|-------|-------|
| CacheService | 28 | get, set, TTL, eviction |
| SecureStorage | 22 | encrypt, decrypt, migration |
| EventBus | 35 | subscribe, publish, wildcard, once |
| NotificationService | 25 | show, dismiss, history |
| Logger | 41 | log, filter, export, stats |
| SettingsManager | 48 | import, export, encryption |
| Providers | 35 | Gemini, Ollama error handling |
| Service Integration | 19 | cross-service workflows |

### Example Unit Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { cacheService } from '../services/cacheService';

describe('CacheService', () => {
  beforeEach(() => {
    cacheService.clear();
  });

  it('should set and get a value', () => {
    cacheService.set('key1', 'value1', 60000);
    expect(cacheService.get('key1')).toBe('value1');
  });

  it('should return null for expired entries', async () => {
    cacheService.set('key1', 'value1', 10); // 10ms TTL
    await new Promise(r => setTimeout(r, 20));
    expect(cacheService.get('key1')).toBeNull();
  });
});
```

## Performance Tests (21 tests)

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| EventBus | 3 | 1000+ subscribers, high-frequency events |
| CacheService | 4 | 200+ entries, rapid operations |
| NotificationService | 3 | High-volume bursts |
| Logger | 3 | 1000+ log entries |
| Memory Leak | 3 | Subscribe/unsubscribe cycles |
| Concurrent Ops | 2 | Parallel operations |
| Long-running | 1 | 10-hour session simulation |
| Edge Cases | 2 | Large payloads, special chars |

### Example Performance Test

```typescript
import { describe, it, expect } from 'vitest';
import { eventBus } from '../../services/eventBus';

describe('EventBus Performance', () => {
  it('should handle 1000+ subscribers efficiently', () => {
    const handlers = Array.from({ length: 1000 }, () => vi.fn());
    const startTime = performance.now();
    
    const unsubscribers = handlers.map((h, i) => 
      eventBus.subscribe(`channel-${i}`, h)
    );
    
    expect(performance.now() - startTime).toBeLessThan(500);
    unsubscribers.forEach(unsub => unsub());
  });

  it('should not leak memory with repeated subscribe/unsubscribe', () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    for (let i = 0; i < 1000; i++) {
      const unsub = eventBus.subscribe('test', () => {});
      unsub();
    }
    
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    expect(finalMemory - initialMemory).toBeLessThan(10 * 1024 * 1024); // 10MB
  });
});
```

### Performance Thresholds

| Operation | Threshold | Environment |
|-----------|-----------|-------------|
| 1000 subscribers | <500ms | jsdom |
| 1000 events | <1000ms | jsdom |
| 100 cache ops | <500ms | jsdom |
| Memory growth | <50MB | jsdom |
| 10-hour degradation | <100% | jsdom |

## Test Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts}',
      'tests/performance/**/*.{test,spec}.{js,ts}'
    ],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./tests/setup.ts'],
  }
});
```

### Test Setup (`tests/setup.ts`)

```typescript
import { vi } from 'vitest';

// Mock crypto for secureStorage tests
global.crypto = {
  getRandomValues: vi.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    importKey: vi.fn(),
    deriveKey: vi.fn(),
  }
} as any;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;
```

## Writing Tests

### Test Naming Convention

```typescript
// ✅ Good - descriptive
it('should return cached value when key exists', () => {});
it('should throw ValidationError when input is empty', () => {});

// ❌ Bad - vague
it('works', () => {});
it('test cache', () => {});
```

### Arrange-Act-Assert

```typescript
it('should filter logs by level', () => {
  // Arrange
  logger.info('SOURCE', 'info message');
  logger.error('SOURCE', 'error message');
  
  // Act
  const filtered = logger.getFilteredLogs({ level: 'error' });
  
  // Assert
  expect(filtered).toHaveLength(1);
  expect(filtered[0].message).toBe('error message');
});
```

### Testing Async Code

```typescript
it('should fetch and cache data', async () => {
  const fetchFn = vi.fn().mockResolvedValue('fresh data');
  
  const result = await cacheService.getOrSet('key', fetchFn, 60000);
  
  expect(result).toBe('fresh data');
  expect(fetchFn).toHaveBeenCalledOnce();
});
```

### Testing Errors

```typescript
it('should throw if fetch fails', async () => {
  const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));
  
  await expect(
    cacheService.getOrSet('key', fetchFn)
  ).rejects.toThrow('Network error');
});
```

## Mocking

### Service Mocks

```typescript
import { vi } from 'vitest';
import { logger } from '../services/logger';

// Spy on method
const logSpy = vi.spyOn(logger, 'log');

// Mock implementation
vi.spyOn(logger, 'error').mockImplementation(() => {});

// Restore after test
afterEach(() => {
  vi.restoreAllMocks();
});
```

### Module Mocks

```typescript
vi.mock('../services/cortex', () => ({
  cortex: {
    reportEvent: vi.fn(),
    getReliability: vi.fn().mockReturnValue({ score: 0.95 })
  }
}));
```

## Coverage

### Current Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Unit Tests | 381 | ✅ Passing |
| Performance | 21 | ✅ Passing |
| Integration | 19 | ⚠️ 10 flaky |
| **Total** | **421** | **409 passing** |

### Coverage Report

```bash
npm test -- --coverage
```

Generates coverage report in `coverage/` directory.

## Debugging Tests

### VS Code Launch Config

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "--reporter", "verbose"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Console Debugging

```typescript
it('should debug this', () => {
  const result = complexOperation();
  console.log('Result:', result); // View in test output
  expect(result).toBeDefined();
});
```

## Continuous Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm test -- --coverage
```

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ✅ Good - test what it does
it('should return cached value without calling fetch', async () => {
  cacheService.set('key', 'cached', 60000);
  const fetchFn = vi.fn();
  
  const result = await cacheService.getOrSet('key', fetchFn);
  
  expect(result).toBe('cached');
  expect(fetchFn).not.toHaveBeenCalled();
});

// ❌ Bad - test how it does it
it('should call Map.get internally', () => {
  const spy = vi.spyOn(cacheService['cache'], 'get');
  cacheService.get('key');
  expect(spy).toHaveBeenCalled();
});
```

### 2. Clean Up After Tests

```typescript
afterEach(() => {
  cacheService.clear();
  logger.clear();
  vi.restoreAllMocks();
});
```

### 3. Test Edge Cases

```typescript
it('should handle empty string key', () => {
  expect(() => cacheService.set('', 'value')).not.toThrow();
});

it('should handle null values', () => {
  cacheService.set('key', null);
  expect(cacheService.get('key')).toBeNull();
});

it('should handle very large values', () => {
  const largeValue = 'x'.repeat(1024 * 1024); // 1MB
  expect(() => cacheService.set('key', largeValue)).not.toThrow();
});
```

### 4. Use Descriptive Test Data

```typescript
// ✅ Good
const user = { id: 'user_123', name: 'John Doe' };

// ❌ Bad
const x = { a: 1, b: 2 };
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `localStorage not defined` | Add mock in setup.ts |
| `crypto not defined` | Add mock in setup.ts |
| `timeout in performance tests` | Increase threshold for jsdom |
| `flaky integration tests` | Add proper cleanup between tests |

### Performance Test Timeouts

If performance tests timeout in CI:

```typescript
// Increase timeout for slow environments
it('should handle rapid operations', { timeout: 10000 }, () => {
  // Test code
});
```
