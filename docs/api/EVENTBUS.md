# EventBus API

Pub/sub event system for inter-service communication.

## Quick Start

```typescript
import { eventBus } from './services/eventBus';

// Subscribe to events
const unsubscribe = eventBus.subscribe('user.message', (event) => {
  console.log('Received:', event.payload);
});

// Publish events
eventBus.publish('user.message', { text: 'Hello' });

// Unsubscribe when done
unsubscribe();
```

---

## Core Methods

### `subscribe(channel, handler, options?)`

Subscribe to an event channel.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | `string` | ✅ | Event channel name |
| `handler` | `function` | ✅ | Event handler |
| `options.priority` | `'critical' \| 'high' \| 'normal' \| 'low'` | 'normal' | Handler priority |
| `options.once` | `boolean` | false | Auto-unsubscribe after first event |

**Returns:** `() => void` - Unsubscribe function

```typescript
// Basic subscription
const unsub = eventBus.subscribe('app.start', (event) => {
  console.log('App started');
});

// Priority subscription
eventBus.subscribe('critical.error', handleError, {
  priority: 'critical'
});

// One-time subscription
eventBus.subscribe('user.login', (e) => {
  console.log('Welcome!');
}, { once: true });
```

---

### `publish(channel, payload, options?)`

Publish an event to a channel.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | `string` | ✅ | Target channel |
| `payload` | `any` | ✅ | Event data |
| `options.correlationId` | `string` | auto | Request tracking ID |
| `options.priority` | `EventPriority` | 'normal' | Event priority |

```typescript
// Basic publish
eventBus.publish('user.action', { type: 'click' });

// With correlation ID
eventBus.publish('api.request', data, {
  correlationId: 'req-123'
});
```

---

### `request(channel, payload, timeoutMs?)`

Request/response pattern.

```typescript
try {
  const response = await eventBus.request(
    'api.getUser',
    { userId: 123 },
    5000 // 5 second timeout
  );
  console.log(response);
} catch (error) {
  console.error('Request failed:', error);
}
```

---

### `reply(requestEvent, payload)`

Reply to a request.

```typescript
eventBus.subscribe('api.getUser', async (event) => {
  const user = await db.getUser(event.payload.userId);
  eventBus.reply(event, user);
});
```

---

## Channel Patterns

### Wildcards

```typescript
// Subscribe to all user.* channels
eventBus.subscribe('user.*', (event) => {
  // Matches: user.login, user.logout, user.update
});

// Subscribe to everything
eventBus.subscribe('*', (event) => {
  // All events
});
```

---

## Common Channels

| Channel | Description | Payload |
|---------|-------------|---------|
| `user.message` | User sent message | `{ text: string }` |
| `user.login` | User logged in | `{ userId: string }` |
| `voice.start` | Voice listening started | - |
| `voice.result` | Voice recognition result | `{ text: string }` |
| `memory.stored` | New memory stored | `{ memory: MemoryNode }` |
| `memory.search` | Memory search performed | `{ query: string }` |
| `plugin.install` | Plugin installed | `{ pluginId: string }` |
| `system.error` | System error | `{ error: Error }` |
| `system.alert` | System alert | `{ level: string, message: string }` |

---

## Advanced Features

### Event History

```typescript
// Get recent events
const recent = eventBus.getHistory('user.message', 10);

// Replay events
await eventBus.replay('user.message', 5);
```

---

### Statistics

```typescript
const stats = eventBus.getStats();
console.log(stats.totalEvents);
console.log(stats.channelCounts);
```

---

### Once Handler

```typescript
// Handle next event only
eventBus.once('user.login', (e) => {
  console.log('First login detected');
});
```

---

## Best Practices

1. **Always unsubscribe:**
```typescript
useEffect(() => {
  const unsub = eventBus.subscribe('event', handler);
  return unsub; // Cleanup on unmount
}, []);
```

2. **Use correlation IDs for tracing:**
```typescript
const correlationId = generateId();
eventBus.publish('start', data, { correlationId });
// All related events will have same correlationId
```

3. **Handle errors in handlers:**
```typescript
eventBus.subscribe('channel', async (event) => {
  try {
    await process(event);
  } catch (error) {
    logger.error('Handler failed:', error);
  }
});
```

---

## Performance

| Metric | Value |
|--------|-------|
| Publish latency | <1ms |
| 1000 subscribers | <500ms |
| 1000 events | <1000ms |

---

## See Also

- `eventSourcing.ts` - Event persistence
- `services/integration.test.ts` - Usage examples
