# JARVIS API Documentation

Complete API reference for JARVIS Kernel services.

## Core Services

| Service | Description | Status |
|---------|-------------|--------|
| [Image Generator](./IMAGE_GENERATOR.md) | AI image generation with DALL-E 3 | ✅ Complete |
| [Memory Service](./MEMORY_SERVICE.md) | Semantic memory storage & search | ✅ Complete |
| [Voice Service](./VOICE_SERVICE.md) | Speech recognition & synthesis | ✅ Complete |
| [Vision Service](./VISION_SERVICE.md) | Computer vision & camera control | ✅ Complete |

---

## Quick Reference

### Most Common Operations

```typescript
// Store a memory
await memory.store({
  content: "User preference",
  type: 'PREFERENCE',
  tags: ['ui']
});

// Generate an image
const image = await imageGenerator.generateImage("prompt");

// Speak text
await voice.speak("Hello");

// Start camera
await vision.startCamera();
```

---

## Service Overview

```
┌─────────────────────────────────────────┐
│           JARVIS Kernel API             │
├─────────────────────────────────────────┤
│  Memory      → Store & search memories  │
│  Voice       → Listen & speak           │
│  Vision      → See & analyze            │
│  Image Gen   → Create images            │
│  Kernel      → Process requests         │
│  EventBus    → Communication            │
└─────────────────────────────────────────┘
```

---

## Getting Started

1. **Import services:**
```typescript
import { memory } from './services/memory';
import { voice } from './services/voice';
import { imageGenerator } from './services/imageGenerator';
```

2. **Use the APIs:**
```typescript
// All services are singletons
await memory.store({...});
await voice.speak("Hello");
```

---

## Documentation Status

| Service | Docs | Examples | Error Handling |
|---------|------|----------|----------------|
| Image Generator | ✅ | ✅ | ✅ |
| Memory | ✅ | ✅ | ✅ |
| Voice | ✅ | ✅ | ✅ |
| Vision | ✅ | ✅ | ✅ |
| Kernel Processor | 📝 | 📝 | 📝 |
| EventBus | 📝 | 📝 | 📝 |

✅ Complete | 📝 Planned

---

## Contributing

To add API documentation:

1. Create `[SERVICE_NAME].md` in this folder
2. Follow the existing format
3. Include: Quick start, methods, examples, error handling
4. Update this README

---

## See Also

- [Main README](../../README.md) - Project overview
- [Architecture Docs](../ARCHITECTURE.md) - System design
- [Testing Guide](../TESTING.md) - Testing documentation
