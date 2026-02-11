# Image Generator Service API

Generate images using AI (OpenAI DALL-E 3) with SVG fallbacks.

## Quick Start

```typescript
import { imageGenerator } from './services/imageGenerator';

// Generate an image
const image = await imageGenerator.generateImage(
  'A futuristic cityscape with flying cars',
  { format: 'png', width: 1024, height: 1024 }
);

// Use the generated image
console.log(image.url);  // data:image/png;base64,...
```

## API Reference

### `generateImage(prompt, options?)`

Generates an image based on the provided prompt.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | ✅ | Text description of the image to generate |
| `options` | `ImageGenerationOptions` | ❌ | Generation options |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'png' \| 'jpeg' \| 'webp' \| 'svg'` | `'png'` | Output format |
| `width` | `number` | `1024` | Image width |
| `height` | `number` | `1024` | Image height |
| `style` | `'vivid' \| 'natural'` | `'vivid'` | DALL-E style |
| `quality` | `'standard' \| 'hd'` | `'standard'` | DALL-E quality |

**Returns:** `Promise<GeneratedImage>`

```typescript
interface GeneratedImage {
  url: string;        // Data URL for the image
  base64?: string;    // Base64 encoded image (PNG/JPEG only)
  svg?: string;       // SVG markup (SVG format only)
  format: string;     // Actual format used
  prompt: string;     // The prompt used (may be revised by AI)
  created: number;    // Timestamp
}
```

**Behavior:**
- If OpenAI API key is configured and format is not SVG → Uses DALL-E 3
- Otherwise → Generates SVG illustration
- Results are cached for 1 hour

## Examples

### Basic Usage

```typescript
const image = await imageGenerator.generateImage('A serene lake at sunset');
imgElement.src = image.url;
```

### With Options

```typescript
const image = await imageGenerator.generateImage(
  'A cyberpunk neon city',
  {
    format: 'png',
    width: 1792,
    height: 1024,
    style: 'vivid',
    quality: 'hd'
  }
);
```

### SVG Fallback

```typescript
// Force SVG generation (no API key needed)
const image = await imageGenerator.generateImage(
  'An abstract pattern',
  { format: 'svg' }
);

// Access raw SVG
console.log(image.svg);
```

## Setup

To use DALL-E 3 generation, configure your OpenAI API key:

```typescript
import { apiKeyManager } from './services/apiKeyManager';

await apiKeyManager.setKey('openai', 'your-api-key-here');
```

## SVG Templates

When using SVG fallback, the service generates context-aware illustrations:

| Prompt Type | Generated SVG |
|-------------|---------------|
| Portrait/Face | Abstract portrait with gradient |
| Landscape/Nature | Mountains, water, sky gradients |
| Animal | Bird, cat, or generic animal |
| Building | Architectural illustration |
| Abstract | Geometric shapes and patterns |
| Default | Generic gradient composition |

## Error Handling

The service always returns a valid image. On failure:
1. DALL-E errors fall back to SVG
2. All errors are logged via logger service
3. Cached results are returned on subsequent identical requests

```typescript
try {
  const image = await imageGenerator.generateImage('...');
  // Use image
} catch (error) {
  // Should rarely happen - service has built-in fallbacks
  console.error('Image generation failed:', error);
}
```

## Performance

- **Cache Duration:** 1 hour
- **DALL-E Timeout:** 30 seconds
- **SVG Generation:** < 10ms
- **Concurrent Requests:** Handled by connection pool
