# JARVIS Logging Guidelines

This document defines the logging standards for the JARVIS kernel architecture to ensure consistent, maintainable, and production-ready logging across all services.

## Overview

JARVIS uses a two-tier logging approach:
1. **Logger Service** (`services/logger.ts`) - For structured, persistent application logs
2. **Console** (`console.log/warn/error`) - For development/debugging and boot-time logs

## When to Use Each

### Use Logger Service (Preferred)

The logger service should be used for **most application logging**:

```typescript
import { logger } from './logger';

// Info level - general information
logger.info('SOURCE', 'Message here', { optional: 'details' });

// Success level - successful operations
logger.success('SOURCE', 'Operation completed', { result: 'data' });

// Warning level - non-critical issues
logger.warning('SOURCE', 'Something unexpected happened', { detail: 'info' });

// Error level - errors and exceptions
logger.error('SOURCE', 'Operation failed', { error: errorObject });

// Debug level - development only (not persisted)
logger.debug('SOURCE', 'Debug message', { data: 'value' });
```

**Benefits of using logger service:**
- Logs are persisted to localStorage
- Structured format with timestamps
- Queryable and filterable
- Cortex integration for error tracking
- Exportable for debugging
- Controllable via configuration

### Use Console (Limited Cases)

Console logging is appropriate only for:

1. **Boot-time initialization** (before logger is available)
   ```typescript
   // In boot.ts - logger may not be initialized yet
   console.log(`[Boot] JARVIS Kernel v${version} starting...`);
   ```

2. **Service constructors** (early initialization)
   ```typescript
   constructor() {
     console.log('[ServiceName] Initializing...');
   }
   ```

3. **Logger service itself** (the logger cannot use itself)
   ```typescript
   // Inside logger.ts only
   console.error('[LOGGER] Failed to persist logs');
   ```

4. **Debug-only verbose logging** (will be tree-shaken in production)
   ```typescript
   if (process.env.NODE_ENV === 'development') {
     console.log('[DEBUG] Verbose debug info');
   }
   ```

## Log Source Naming Convention

Use uppercase snake_case for log sources:

```typescript
// Good
logger.info('KERNEL', 'Message');
logger.info('HOME_ASSISTANT', 'Message');
logger.info('VOICE', 'Message');
logger.error('MEMORY', 'Message');

// Avoid
logger.info('kernel', 'Message');
logger.info('HomeAssistant', 'Message');
logger.info('myService', 'Message');
```

## Log Level Guidelines

| Level | Use For | Persistence |
|-------|---------|-------------|
| `debug` | Development tracing, verbose output | No |
| `info` | General information, state changes | Yes |
| `success` | Completed operations, confirmations | Yes |
| `warning` | Non-critical issues, fallbacks | Yes |
| `error` | Errors, exceptions, failures | Yes (with Cortex report) |

## Error Logging Best Practices

Always include the error object for better debugging:

```typescript
// Good - includes full error details
try {
  await operation();
} catch (e) {
  logger.error('SERVICE', 'Operation failed', { error: e });
}

// Avoid - loses error information
try {
  await operation();
} catch (e) {
  logger.error('SERVICE', 'Operation failed');
}
```

## Migration Guide

When refactoring existing code:

1. Replace `console.log('[SOURCE] Message')` with `logger.info('SOURCE', 'Message')`
2. Replace `console.warn('[SOURCE] Message')` with `logger.warning('SOURCE', 'Message')`
3. Replace `console.error('[SOURCE] Message')` with `logger.error('SOURCE', 'Message')`
4. Add appropriate details as the third parameter

## Configuration

The logger can be configured at runtime:

```typescript
import { logger } from './logger';

// Disable console output (production)
logger.setConfig({ enableConsole: false });

// Disable persistence
logger.setConfig({ persistLogs: false });

// Adjust max logs
logger.setConfig({ maxLogs: 500 });

// Auto-cleanup old logs
logger.setConfig({ autoCleanup: true, cleanupDays: 7 });
```

## Checking for Console Usage

To find console usage that should be migrated:

```bash
# Find console usage in services
grep -r "console\." services/ --include="*.ts" | grep -v "logger.ts"
```

## Future Improvements

Planned enhancements to the logging system:

1. **ESLint Rule**: Add lint rule to prevent console usage (with exceptions)
2. **Production Mode**: Automatically disable console in production builds
3. **Log Levels**: Support for more granular log level control per source
4. **Remote Logging**: Optional remote log aggregation for debugging
