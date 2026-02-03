# JARVIS Improvement Recommendations

## Priority Matrix

| Priority | Impact | Effort | Items |
|----------|--------|--------|-------|
| 🔴 Critical | High | Low-Med | 1-10 |
| 🟠 High | High | Med-High | 11-20 |
| 🟡 Medium | Med | Low-Med | 21-30 |
| 🟢 Low | Low | Low | 31-35 |

---

## 🔴 Critical Improvements

### 1. Implement Code Splitting & Lazy Loading

**Problem:** 884 KB bundle exceeds 500 KB recommendation  
**Impact:** Faster initial load, better caching  
**Effort:** Medium

```typescript
// BEFORE: Eager loading
import { IntegrationsDashboard } from './components/IntegrationsDashboard';
import { DevDashboard } from './components/DevDashboard';

// AFTER: Lazy loading
const IntegrationsDashboard = lazy(() => import('./components/IntegrationsDashboard'));
const DevDashboard = lazy(() => import('./components/DevDashboard'));
```

**Implementation:**
```typescript
// Create LazyComponents.tsx
export const LazyIntegrationsDashboard = lazy(() => 
  import('./IntegrationsDashboard').then(m => ({ default: m.IntegrationsDashboard }))
);

// In App.tsx - wrap with Suspense
<Suspense fallback={<LoadingFallback />}>
  {view === 'INTEGRATIONS' && <LazyIntegrationsDashboard />}
</Suspense>
```

**Expected Impact:** Reduce initial bundle to ~400 KB

---

### 2. Add Global Error Boundary

**Problem:** Unhandled errors crash the entire app  
**Impact:** Graceful error recovery  
**Effort:** Low

```typescript
// components/ErrorBoundary.tsx
export class JARVISErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.log('ERROR_BOUNDARY', error.message, 'error', { 
      stack: error.stack,
      componentStack: info.componentStack 
    });
    cortex.reportEvent({
      sourceId: 'ui.error_boundary',
      type: HealthEventType.CRASH,
      impact: ImpactLevel.HIGH,
      latencyMs: 0,
      context: { errorMessage: error.message }
    });
  }

  render() {
    if (this.state.hasError) {
      return <SystemRecoveryScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

---

### 3. Centralize API Key Management

**Problem:** API key retrieval duplicated in 5+ files  
**Impact:** Security, maintainability  
**Effort:** Low

```typescript
// services/apiKeyManager.ts
class APIKeyManager {
  private cache: Map<string, string> = new Map();
  
  getKey(provider: 'gemini' | 'openai'): string | null {
    // Check cache first
    if (this.cache.has(provider)) {
      return this.cache.get(provider)!;
    }
    
    // Environment variable
    const envKey = import.meta.env[`VITE_${provider.toUpperCase()}_API_KEY`];
    if (envKey) {
      this.cache.set(provider, envKey);
      return envKey;
    }
    
    // localStorage (encoded)
    const stored = localStorage.getItem(`${provider.toUpperCase()}_API_KEY`);
    if (stored) {
      try {
        const decoded = atob(stored);
        this.cache.set(provider, decoded);
        return decoded;
      } catch (e) {
        console.error(`Failed to decode ${provider} API key`);
      }
    }
    
    return null;
  }
  
  setKey(provider: string, key: string): void {
    const encoded = btoa(key);
    localStorage.setItem(`${provider.toUpperCase()}_API_KEY`, encoded);
    this.cache.set(provider, key);
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}

export const apiKeyManager = new APIKeyManager();
```

---

### 4. Implement Request Deduplication

**Problem:** Duplicate requests can fire simultaneously  
**Impact:** Reduce API costs, prevent race conditions  
**Effort:** Low

```typescript
// services/requestDeduplication.ts (exists but underutilized)
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();
  
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }
    
    const promise = fn().finally(() => {
      this.pending.delete(key);
    });
    
    this.pending.set(key, promise);
    return promise;
  }
}

// Usage in providers.ts
const response = await deduplicator.dedupe(
  `intent:${input}`,
  () => ai.models.generateContent({...})
);
```

---

### 5. Add Input Sanitization

**Problem:** User input passed directly to AI without validation  
**Impact:** Security, prompt injection prevention  
**Effort:** Low

```typescript
// services/inputValidator.ts
export function sanitizeInput(input: string): { 
  valid: boolean; 
  sanitized: string; 
  error?: string 
} {
  // Length check
  if (input.length > 5000) {
    return { valid: false, sanitized: '', error: 'Input too long' };
  }
  
  // Remove control characters
  const sanitized = input
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '')
    .trim();
  
  // Check for prompt injection attempts
  const injectionPatterns = [
    /ignore\s+previous\s+instructions/i,
    /system\s*:\s*/i,
    /you\s+are\s+now/i,
    /\[\s*INST\s*\]/i,
  ];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      return { 
        valid: false, 
        sanitized, 
        error: 'Potentially harmful input detected' 
      };
    }
  }
  
  return { valid: true, sanitized };
}
```

---

### 6. Refactor processKernelRequest

**Problem:** 400+ line function with multiple responsibilities  
**Impact:** Maintainability, testability  
**Effort:** Medium

```typescript
// BEFORE: Monolithic
const processKernelRequest = useCallback(async (input: string, origin: 'USER_TEXT' | 'USER_VOICE') => {
  // 400+ lines of mixed concerns
}, [deps]);

// AFTER: Strategy pattern
class RequestHandler {
  private handlers: Map<IntentType, IntentHandler> = new Map();
  
  register(type: IntentType, handler: IntentHandler) {
    this.handlers.set(type, handler);
  }
  
  async handle(context: RequestContext): Promise<Response> {
    const handler = this.handlers.get(context.intent.type);
    if (!handler) {
      return this.handleGeneralQuery(context);
    }
    return handler.handle(context);
  }
}

// Individual handlers
class VisionHandler implements IntentHandler {
  async handle(ctx: RequestContext): Promise<Response> {
    // Vision-specific logic
  }
}

class MemoryHandler implements IntentHandler {
  async handle(ctx: RequestContext): Promise<Response> {
    // Memory-specific logic
  }
}
```

---

### 7. Add Service Worker for Offline Support

**Problem:** App doesn't work offline  
**Impact:** Reliability, PWA capabilities  
**Effort:** Medium

```typescript
// sw.ts
const CACHE_NAME = 'jarvis-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

### 8. Implement Proper Retry Logic with Exponential Backoff

**Problem:** No retry mechanism for failed API calls  
**Impact:** Reliability  
**Effort:** Low

```typescript
// services/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryableErrors?: string[];
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) break;
      
      // Check if error is retryable
      if (error.code === 429 || error.message?.includes('rate limit')) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error; // Non-retryable
      }
    }
  }
  
  throw lastError;
}
```

---

### 9. Add Structured Logging

**Problem:** Console.log scattered throughout codebase  
**Impact:** Debugging, observability  
**Effort:** Low

```typescript
// Enhance existing logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  component?: string;
  service?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

class StructuredLogger {
  private logBuffer: LogEntry[] = [];
  private readonly BUFFER_SIZE = 1000;
  
  log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: new Date(),
      level,
      message,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    };
    
    this.logBuffer.push(entry);
    
    if (this.logBuffer.length > this.BUFFER_SIZE) {
      this.logBuffer.shift();
    }
    
    // Console output with structured format
    const formatted = `[${entry.timestamp.toISOString()}] ${LogLevel[level]}: ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG: console.debug(formatted, context); break;
      case LogLevel.INFO: console.info(formatted, context); break;
      case LogLevel.WARN: console.warn(formatted, context); break;
      case LogLevel.ERROR: console.error(formatted, context, error); break;
    }
  }
  
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }
}
```

---

### 10. Create Configuration Constants File

**Problem:** Magic numbers scattered throughout  
**Impact:** Maintainability  
**Effort:** Low

```typescript
// constants/config.ts
export const CONFIG = {
  // Timing
  DEBOUNCE_MS: 500,
  REQUEST_TIMEOUT_MS: 30000,
  CIRCUIT_RESET_TIMEOUT_MS: 5000,
  VAD_SILENCE_TIMEOUT: 1500,
  
  // Limits
  MAX_CONTEXT_TURNS: 6,
  MAX_CONTEXT_CHARS: 2000,
  MAX_MEMORY_NODES: 10000,
  INTENT_CACHE_SIZE: 50,
  INTENT_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  
  // Rate Limiting
  GEMINI_DAILY_REQUEST_LIMIT: 1400,
  GEMINI_PER_MINUTE_LIMIT: 14,
  
  // Audio
  AUDIO_BUFFER_SIZE: 4096,
  VAD_THRESHOLD: 0.01,
  
  // Thresholds
  HIGH_LATENCY_THRESHOLD: 1000,
  CIRCUIT_FAILURE_THRESHOLD: 3,
} as const;
```

---

## 🟠 High Priority Improvements

### 11. Add Unit Tests

**Priority Files to Test:**
- `services/localIntent.ts` - Intent classification
- `services/memoryOptimized.ts` - Memory operations
- `services/rateLimiter.ts` - Rate limiting logic
- `services/execution.ts` - Circuit breaker

```typescript
// tests/localIntent.test.ts
import { describe, it, expect } from 'vitest';
import { localIntentClassifier } from '../services/localIntent';

describe('LocalIntentClassifier', () => {
  it('should classify memory write intent', () => {
    const result = localIntentClassifier.classify('Remember my password is 1234');
    expect(result.type).toBe('MEMORY_WRITE');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
  
  it('should classify command intent', () => {
    const result = localIntentClassifier.classify('Turn on the living room lights');
    expect(result.type).toBe('COMMAND');
    expect(result.entities).toContain('living room');
  });
});
```

---

### 12. Implement WebSocket for Home Assistant

**Problem:** Polling-based updates are inefficient  
**Impact:** Real-time updates, lower latency  
**Effort:** Medium

```typescript
// services/home_assistant_ws.ts
class HomeAssistantWebSocket {
  private ws: WebSocket | null = null;
  private messageId = 1;
  private pending = new Map<number, { resolve: Function; reject: Function }>();
  
  async connect(url: string, token: string): Promise<void> {
    this.ws = new WebSocket(`wss://${url}/api/websocket`);
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'auth_required') {
        this.send({ type: 'auth', access_token: token });
      }
      
      if (message.type === 'event' && message.event.event_type === 'state_changed') {
        this.handleStateChange(message.event.data);
      }
      
      // Resolve pending promises
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)!.resolve(message);
        this.pending.delete(message.id);
      }
    };
  }
  
  subscribeToEntities(entityIds: string[], callback: (state: HAEntity) => void): void {
    this.send({
      type: 'subscribe_entities',
      entity_ids: entityIds
    });
    this.stateCallbacks = callback;
  }
}
```

---

### 13. Add Performance Monitoring

**Problem:** No visibility into real-world performance  
**Impact:** Data-driven optimization  
**Effort:** Medium

```typescript
// services/performanceMonitor.ts
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    this.record(name, duration);
    return result;
  }
  
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    this.record(name, duration);
    return result;
  }
  
  private record(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    // Send to analytics if threshold exceeded
    if (duration > 1000) {
      this.reportSlowOperation(name, duration);
    }
  }
  
  getReport(): PerformanceReport {
    const report: PerformanceReport = {};
    this.metrics.forEach((times, name) => {
      report[name] = {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        p95: this.percentile(times, 0.95),
        p99: this.percentile(times, 0.99),
        max: Math.max(...times)
      };
    });
    return report;
  }
}
```

---

### 14. Implement Proper State Management (Zustand/Redux Toolkit)

**Problem:** React state scattered, prop drilling  
**Impact:** Maintainability, performance  
**Effort:** High

```typescript
// stores/jarvisStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface JARVISState {
  // Core state
  processorState: ProcessorState;
  provider: AIProvider | null;
  
  // Data
  logs: LogEntry[];
  memories: MemoryNode[];
  plugins: RuntimePlugin[];
  breakerStatuses: BreakerStatus[];
  
  // Actions
  setProcessorState: (state: ProcessorState) => void;
  addLog: (entry: LogEntry) => void;
  setMemories: (memories: MemoryNode[]) => void;
  
  // Async actions
  processRequest: (input: string, origin: Origin) => Promise<void>;
}

export const useJARVISStore = create<JARVISState>()(
  devtools(
    persist(
      (set, get) => ({
        processorState: ProcessorState.IDLE,
        provider: null,
        logs: [],
        memories: [],
        plugins: [],
        breakerStatuses: [],
        
        setProcessorState: (state) => set({ processorState: state }),
        
        addLog: (entry) => set((state) => ({
          logs: [entry, ...state.logs].slice(0, 100)
        })),
        
        processRequest: async (input, origin) => {
          set({ processorState: ProcessorState.ANALYZING });
          // ... processing logic
        }
      }),
      { name: 'jarvis-storage' }
    )
  )
);
```

---

### 15. Add Docker Support

**Problem:** No containerization  
**Impact:** Easier deployment, consistency  
**Effort:** Medium

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  jarvis:
    build: .
    ports:
      - "3000:80"
    environment:
      - VITE_GEMINI_API_KEY=${GEMINI_API_KEY}
    
  proxy:
    build: ./server
    ports:
      - "3101:3101"
    environment:
      - HA_URL=${HA_URL}
      - HA_TOKEN=${HA_TOKEN}
      
  piper:
    image: rhasspy/wyoming-piper
    ports:
      - "10200:10200"
    volumes:
      - ./piper-voices:/data
```

---

### 16. Implement Proper CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      
  bundle-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - name: Analyze bundle size
        run: npx bundlesize
```

---

### 17. Add E2E Tests with Playwright

```typescript
// e2e/jarvis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('JARVIS Core', () => {
  test('should process text input', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for boot sequence
    await page.waitForSelector('[data-testid="terminal"]');
    
    // Type a query
    await page.fill('[data-testid="terminal-input"]', 'What is the weather?');
    await page.press('[data-testid="terminal-input"]', 'Enter');
    
    // Verify response appears
    await expect(page.locator('[data-testid="log-entry"]').first()).
      toContainText('weather');
  });
  
  test('should toggle voice', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.click('[data-testid="voice-toggle"]');
    
    await expect(page.locator('[data-testid="voice-state"]')).
      toHaveText('LISTENING');
  });
});
```

---

### 18. Implement Feature Flags

**Problem:** No way to toggle features without deployment  
**Impact:** Safer rollouts, A/B testing  
**Effort:** Medium

```typescript
// services/featureFlags.ts
class FeatureFlagManager {
  private flags: Map<string, boolean> = new Map();
  private userOverrides: Map<string, boolean> = new Map();
  
  constructor() {
    // Load from localStorage or remote config
    this.loadFlags();
  }
  
  isEnabled(flag: string): boolean {
    // Check user override first
    if (this.userOverrides.has(flag)) {
      return this.userOverrides.get(flag)!;
    }
    return this.flags.get(flag) ?? false;
  }
  
  enable(flag: string): void {
    this.userOverrides.set(flag, true);
    this.saveOverrides();
  }
  
  private loadFlags(): void {
    // Default flags
    this.flags.set('neural-tts', true);
    this.flags.set('vision-analysis', true);
    this.flags.set('proactive-suggestions', false); // Beta
    this.flags.set('websocket-ha', false); // Beta
  }
}

// Usage
if (featureFlags.isEnabled('websocket-ha')) {
  haService.connectWebSocket();
}
```

---

### 19. Add Analytics & Telemetry

```typescript
// services/analytics.ts
class Analytics {
  private sessionId: string;
  
  track(event: string, properties?: Record<string, any>): void {
    const payload = {
      event,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      properties
    };
    
    // Send to analytics endpoint
    this.send(payload);
  }
  
  trackIntent(classified: ParsedIntent, actual: IntentType): void {
    this.track('intent.classified', {
      predicted: classified.type,
      actual,
      confidence: classified.confidence,
      provider: classified.suggestedProvider
    });
  }
  
  trackError(error: Error, context: string): void {
    this.track('error.occurred', {
      message: error.message,
      context,
      stack: error.stack
    });
  }
}
```

---

### 20. Implement Plugin System v2

**Problem:** Current plugin system is mock/stub  
**Impact:** Extensibility  
**Effort:** High

```typescript
// plugins/PluginRuntime.ts
interface PluginRuntime {
  // Sandboxed execution
  execute(code: string, context: PluginContext): Promise<any>;
  
  // Permission management
  checkPermission(pluginId: string, permission: Permission): boolean;
  
  // Lifecycle
  load(manifest: PluginManifest): Promise<RuntimePlugin>;
  unload(pluginId: string): Promise<void>;
}

// Web Worker-based sandbox
class WorkerPluginRuntime implements PluginRuntime {
  private workers = new Map<string, Worker>();
  
  async load(manifest: PluginManifest): Promise<RuntimePlugin> {
    const worker = new Worker('/plugin-worker.js');
    
    worker.postMessage({
      type: 'LOAD',
      manifest,
      // Only expose allowed APIs
      api: this.buildPluginAPI(manifest.permissions)
    });
    
    this.workers.set(manifest.id, worker);
    
    return {
      manifest,
      status: 'ACTIVE',
      loadedAt: Date.now()
    };
  }
}
```

---

## 🟡 Medium Priority

### 21. Add Keyboard Shortcuts

```typescript
// hooks/useKeyboard.ts
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('[data-testid="terminal-input"]')?.focus();
      }
      
      // Ctrl/Cmd + M: Toggle mute
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        voice.toggleMute();
      }
      
      // Escape: Cancel current operation
      if (e.key === 'Escape') {
        voice.interrupt();
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
```

---

### 22. Implement Response Streaming

```typescript
// services/streaming.ts
async function* streamResponse(prompt: string): AsyncGenerator<string> {
  const response = await fetch('/api/stream', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield line.slice(6);
      }
    }
  }
}

// Usage in component
const [response, setResponse] = useState('');

useEffect(() => {
  (async () => {
    for await (const chunk of streamResponse(input)) {
      setResponse(prev => prev + chunk);
    }
  })();
}, [input]);
```

---

### 23. Add Voice Activity Visualization

```typescript
// components/VoiceVisualizer.tsx
export const VoiceVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d')!;
    const analyser = voice.getAnalyser();
    analyserRef.current = analyser;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const draw = () => {
      requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw frequency bars
      const barWidth = canvas.width / dataArray.length;
      
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        ctx.fillStyle = `hsl(${i / dataArray.length * 360}, 100%, 50%)`;
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
      }
    };
    
    draw();
  }, []);
  
  return <canvas ref={canvasRef} width={300} height={100} />;
};
```

---

### 24. Add Mobile Responsiveness Improvements

```typescript
// hooks/useMediaQuery.ts
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [query]);
  
  return matches;
}

// Usage
const isMobile = useMediaQuery('(max-width: 768px)');

// Layout adjustments
<div className={isMobile ? 'flex-col' : 'flex-row'}>
```

---

### 25. Implement Command Palette

```typescript
// components/CommandPalette.tsx
export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const commands = [
    { id: 'toggle-voice', label: 'Toggle Voice', action: () => voice.toggleMute() },
    { id: 'clear-logs', label: 'Clear Logs', action: () => clearLogs() },
    { id: 'export-memory', label: 'Export Memory', action: () => memory.exportToFile() },
    // ... more commands
  ];
  
  const filtered = commands.filter(c => 
    c.label.toLowerCase().includes(search.toLowerCase())
  );
  
  // Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  
  return isOpen ? (
    <Modal onClose={() => setIsOpen(false)}>
      <Input 
        value={search}
        onChange={setSearch}
        placeholder="Type a command..."
        autoFocus
      />
      <CommandList>
        {filtered.map(cmd => (
          <CommandItem key={cmd.id} onClick={cmd.action}>
            {cmd.label}
          </CommandItem>
        ))}
      </CommandList>
    </Modal>
  ) : null;
};
```

---

### 26. Add Dark/Light Theme Toggle

```typescript
// hooks/useTheme.ts
export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
  });
  
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  return { theme, setTheme };
}

// tailwind.config.js
module.exports = {
  darkMode: 'class',
  // ...
};
```

---

### 27. Implement Notification System

```typescript
// services/notifications.ts
type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

class NotificationManager {
  private notifications: Notification[] = [];
  private observers: ((notifications: Notification[]) => void)[] = [];
  
  show(notification: Omit<Notification, 'id'>): string {
    const id = generateId();
    const fullNotification = { ...notification, id };
    
    this.notifications.push(fullNotification);
    this.notify();
    
    if (notification.duration !== 0) {
      setTimeout(() => this.dismiss(id), notification.duration || 5000);
    }
    
    return id;
  }
  
  dismiss(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notify();
  }
}

export const notifications = new NotificationManager();
```

---

### 28. Add Data Export/Import

```typescript
// services/backup.ts
class BackupManager {
  async createFullBackup(): Promise<BackupData> {
    return {
      version: '1.0',
      timestamp: Date.now(),
      data: {
        memories: await memory.getAll(),
        settings: this.exportSettings(),
        corrections: learningService.getRecentCorrections(1000),
        conversations: conversation.getSession()
      }
    };
  }
  
  async restoreFromBackup(backup: BackupData): Promise<void> {
    // Validate version
    if (!this.isCompatible(backup.version)) {
      throw new Error('Incompatible backup version');
    }
    
    // Restore with transaction-like behavior
    await memory.restore(backup.data.memories);
    this.importSettings(backup.data.settings);
  }
  
  async exportToFile(): Promise<void> {
    const backup = await this.createFullBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-backup-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

---

### 29. Implement Rate Limit UI Feedback

```typescript
// components/RateLimitIndicator.tsx
export const RateLimitIndicator: React.FC = () => {
  const [stats, setStats] = useState(geminiRateLimiter.getStats());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(geminiRateLimiter.getStats());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const percentUsed = (stats.daily.used / stats.daily.limit) * 100;
  
  return (
    <div className="rate-limit-indicator">
      <div className="progress-bar">
        <div 
          className="fill" 
          style={{ 
            width: `${percentUsed}%`,
            backgroundColor: percentUsed > 80 ? 'red' : percentUsed > 50 ? 'yellow' : 'green'
          }}
        />
      </div>
      <span>{stats.daily.remaining} requests remaining today</span>
      {stats.isRateLimited && (
        <span className="warning">Rate limited - retry after {stats.retryAfter}s</span>
      )}
    </div>
  );
};
```

---

### 30. Add Search to Memory Bank

```typescript
// components/MemorySearch.tsx
export const MemorySearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [filters, setFilters] = useState<{
    type?: MemoryType;
    dateRange?: [number, number];
    tags?: string[];
  }>({});
  
  useEffect(() => {
    const debounced = setTimeout(async () => {
      if (query.length > 2) {
        const searchResults = await memory.advancedSearch(query, filters);
        setResults(searchResults);
      }
    }, 300);
    
    return () => clearTimeout(debounced);
  }, [query, filters]);
  
  return (
    <div className="memory-search">
      <Input 
        value={query}
        onChange={setQuery}
        placeholder="Search memories..."
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <SearchResults results={results} />
    </div>
  );
};
```

---

## 🟢 Low Priority

### 31. Add Keyboard Navigation to Dashboards

### 32. Implement Auto-Update Check

### 33. Add Onboarding Flow for New Users

### 34. Create Keyboard Shortcut Cheat Sheet

### 35. Add Easter Eggs (fun responses to specific queries)

---

## Implementation Roadmap

### Phase 1: Stability (Weeks 1-2)
- [ ] Error boundaries
- [ ] Input sanitization
- [ ] Centralized API key management
- [ ] Constants file

### Phase 2: Performance (Weeks 3-4)
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Request deduplication
- [ ] Service worker

### Phase 3: Architecture (Weeks 5-6)
- [ ] Refactor processKernelRequest
- [ ] State management (Zustand)
- [ ] Structured logging
- [ ] Retry logic

### Phase 4: Features (Weeks 7-8)
- [ ] WebSocket HA
- [ ] Command palette
- [ ] Keyboard shortcuts
- [ ] Notifications

### Phase 5: Quality (Weeks 9-10)
- [ ] Unit tests
- [ ] E2E tests
- [ ] CI/CD pipeline
- [ ] Docker support

---

## Summary

| Category | Count | Priority Focus |
|----------|-------|----------------|
| Critical | 10 | Do first - stability & performance |
| High | 10 | Architecture & core features |
| Medium | 10 | UX improvements |
| Low | 5 | Nice-to-have |

**Estimated Timeline**: 10 weeks for full implementation  
**Quick Wins**: Items 2, 3, 5, 8, 9, 10 (can be done in 1-2 days)
