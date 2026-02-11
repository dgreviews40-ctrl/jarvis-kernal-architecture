# Vision Service API

Computer vision for image analysis and camera integration.

## Quick Start

```typescript
import { vision } from './services/vision';

// Start camera
await vision.startCamera();

// Capture and analyze
const result = await vision.captureAndAnalyze(
  "What's in this image?"
);

// Stop camera
vision.stopCamera();
```

---

## Camera Control

### `startCamera(source?)`

Start the camera feed.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | `'webcam' \| 'ha'` | 'webcam' | Camera source |

**Returns:** `Promise<void>`

```typescript
// Start webcam
await vision.startCamera('webcam');

// Start Home Assistant camera
await vision.startCamera('ha');
```

---

### `stopCamera()`

Stop the camera feed.

```typescript
vision.stopCamera();
```

---

### `isActive()`

Check if camera is active.

```typescript
if (vision.isActive()) {
  console.log('Camera is running');
}
```

---

## Image Capture

### `capture()`

Capture current frame as base64.

**Returns:** `Promise<string>` - Base64 encoded image

```typescript
const imageBase64 = await vision.capture();
// Use for analysis or storage
```

---

### `captureAndAnalyze(prompt?)`

Capture and analyze in one call.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | `string` | "Describe this image" | Analysis prompt |

**Returns:** `Promise<VisionResult>`

```typescript
const result = await vision.captureAndAnalyze(
  "What objects do you see?"
);

console.log(result.description);
console.log(result.objects); // Detected objects
```

---

## Image Analysis

### `analyze(imageBase64, prompt?)`

Analyze an existing image.

```typescript
const result = await vision.analyze(imageBase64, {
  prompt: "Describe the scene",
  detectObjects: true,
  detectText: true
});

console.log(result.description);
console.log(result.objects);   // Bounding boxes
console.log(result.text);      // OCR text
```

---

## Home Assistant Integration

### `configureHA(url, token)`

Configure Home Assistant camera access.

```typescript
vision.configureHA(
  'http://homeassistant.local:8123',
  'your-long-lived-token'
);
```

---

### `listHACameras()`

List available Home Assistant cameras.

```typescript
const cameras = await vision.listHACameras();
// [{ entity_id: 'camera.front_door', name: 'Front Door' }, ...]
```

---

### `switchHACamera(entityId)`

Switch to a specific HA camera.

```typescript
await vision.switchHACamera('camera.front_door');
```

---

## Vision Memory

Store and search visual memories:

```typescript
import { visionMemory } from './services/visionMemory';

// Store visual memory
await visionMemory.store({
  imageBase64: image,
  description: "User showing their new setup",
  tags: ['setup', 'workspace']
});

// Search visual memories
const results = await visionMemory.search("workspace setup");
```

---

## Object Detection

```typescript
const detection = await vision.detectObjects(imageBase64);

// Results include bounding boxes
detection.objects.forEach(obj => {
  console.log(`${obj.label}: ${obj.confidence}`);
  console.log(`  at (${obj.x}, ${obj.y})`);
});
```

---

## OCR (Text Recognition)

```typescript
const ocr = await vision.recognizeText(imageBase64);

console.log(ocr.fullText);
ocr.blocks.forEach(block => {
  console.log(`Text: ${block.text}`);
  console.log(`Bounds: ${block.bounds}`);
});
```

---

## Events

```typescript
// Camera events
vision.on('frame', (frame) => {
  // Process frame
});

vision.on('error', (error) => {
  console.error('Vision error:', error);
});

// Motion detection
vision.on('motion', (region) => {
  console.log('Motion detected in:', region);
});
```

---

## Configuration

```typescript
vision.configure({
  resolution: { width: 1280, height: 720 },
  frameRate: 30,
  enableMotionDetection: true,
  motionSensitivity: 0.5
});
```

---

## Error Handling

```typescript
try {
  await vision.startCamera();
} catch (error) {
  switch (error.code) {
    case 'CAMERA_NOT_FOUND':
      // No camera connected
      break;
    case 'PERMISSION_DENIED':
      // Camera permission denied
      break;
    case 'HA_CONNECTION_FAILED':
      // Home Assistant not reachable
      break;
  }
}
```

---

## Performance

| Operation | Typical Time |
|-----------|-------------|
| Start Camera | ~500ms |
| Capture | ~50ms |
| Analyze (local) | ~2s |
| Analyze (cloud) | ~3s |
| OCR | ~1s |

---

## See Also

- `vision_ha_camera.ts` - HA camera integration
- `visionMemory.ts` - Visual memory storage
- `imagePool.ts` - Image resource management
