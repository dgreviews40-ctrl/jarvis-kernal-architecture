# Memory Service API

Store, search, and manage memories with semantic vector search.

## Quick Start

```typescript
import { memory } from './services/memory';

// Store a memory
await memory.store({
  content: "User prefers dark mode",
  type: 'PREFERENCE',
  tags: ['ui', 'theme']
});

// Search memories
const results = await memory.search("user preferences");
```

---

## Core Methods

### `store(memoryInput)`

Store a new memory in the system.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | `string` | ✅ | The memory content |
| `type` | `MemoryType` | ❌ | Type: 'FACT', 'PREFERENCE', 'EVENT', 'CONVERSATION' |
| `tags` | `string[]` | ❌ | Searchable tags |
| `importance` | `number` | ❌ | 1-10 importance score |

**Returns:** `Promise<MemoryNode>`

```typescript
const memory = await memory.store({
  content: "Project deadline is March 15th",
  type: 'FACT',
  tags: ['work', 'deadline'],
  importance: 8
});
// Returns: { id: 'mem_xxx', content: '...', created: 1234567890, ... }
```

---

### `search(query, options?)`

Search memories using semantic vector search.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | - | Search query |
| `options.limit` | `number` | 10 | Max results |
| `options.threshold` | `number` | 0.7 | Similarity threshold (0-1) |
| `options.type` | `MemoryType` | - | Filter by type |

**Returns:** `Promise<MemorySearchResult[]>`

```typescript
const results = await memory.search("work deadlines", {
  limit: 5,
  threshold: 0.8
});

// Results sorted by relevance
results.forEach(r => {
  console.log(`${r.score}: ${r.node.content}`);
});
```

---

### `getById(id)`

Retrieve a specific memory by ID.

```typescript
const memory = await memory.getById('mem_abc123');
if (memory) {
  console.log(memory.content);
}
```

---

### `update(id, updates)`

Update an existing memory.

```typescript
await memory.update('mem_abc123', {
  content: "Updated content",
  tags: ['new', 'tags']
});
```

---

### `delete(id)`

Delete a memory.

```typescript
await memory.delete('mem_abc123');
```

---

## Memory Types

```typescript
type MemoryType = 
  | 'FACT'           // Objective information
  | 'PREFERENCE'     // User preferences
  | 'EVENT'          // Time-based events
  | 'CONVERSATION'   // Conversation snippets
  | 'TASK'           // Tasks and todos
  | 'IDENTITY';      // User identity info
```

---

## Advanced Features

### Vector DB Integration

Memories are automatically synced to Vector DB for semantic search:

```typescript
// Automatic embedding generation
// Automatic similarity search
// No manual configuration needed
```

### Memory Consolidation

Duplicate memories are automatically merged:

```typescript
// Store similar memories
await memory.store({ content: "User likes dark mode" });
await memory.store({ content: "User prefers dark theme" });

// Automatically merged into single memory
```

### Importance Scoring

Higher importance = longer retention:

```typescript
await memory.store({
  content: "Critical security info",
  importance: 10  // Never auto-deleted
});
```

---

## Events

Subscribe to memory events:

```typescript
import { eventBus } from './services/eventBus';

eventBus.subscribe('memory.stored', (event) => {
  console.log('New memory:', event.payload);
});

eventBus.subscribe('memory.search', (event) => {
  console.log('Search performed:', event.payload.query);
});
```

---

## Error Handling

```typescript
try {
  await memory.store({ content: "..." });
} catch (error) {
  if (error.code === 'MEMORY_FULL') {
    // Handle storage limit
  }
}
```

---

## Performance

| Operation | Typical Time |
|-----------|-------------|
| Store | ~50ms |
| Search | ~100ms |
| Get by ID | ~5ms |
| Update | ~50ms |

---

## See Also

- `memoryConsolidationService.ts` - Deduplication
- `vectorDB.ts` - Vector storage
- `advancedMemoryService.ts` - Enhanced features
