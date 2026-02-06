/**
 * Canvas Web Worker for Offscreen Rendering
 * Moves heavy canvas operations off the main thread
 * Dramatically improves UI responsiveness
 */

// Worker context type
type DedicatedWorkerGlobalScope = typeof globalThis & {
  postMessage: (message: any, transfer?: Transferable[]) => void;
  addEventListener: (type: string, listener: (event: any) => void) => void;
  removeEventListener: (type: string, listener: (event: any) => void) => void;
};
declare const self: DedicatedWorkerGlobalScope;

interface CanvasMessage {
  id: string;
  type: 'RENDER_PARTICLES' | 'PROCESS_IMAGE' | 'GENERATE_THUMBNAIL' | 'APPLY_FILTER';
  payload: unknown;
}

interface ParticleSystem {
  particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
  }>;
  connections: Array<{
    from: number;
    to: number;
    opacity: number;
  }>;
}

interface ImageProcessingRequest {
  imageData: ImageData;
  operations: Array<{
    type: 'resize' | 'blur' | 'sharpen' | 'grayscale' | 'brightness' | 'contrast';
    params: Record<string, number>;
  }>;
}

// Simple particle simulation without canvas API
function simulateParticles(
  system: ParticleSystem,
  width: number,
  height: number,
  isActive: boolean
): ParticleSystem {
  const speedMult = isActive ? 3.0 : 1.0;
  const newParticles = system.particles.map(p => {
    let x = p.x + p.vx * speedMult;
    let y = p.y + p.vy * speedMult;
    let vx = p.vx;
    let vy = p.vy;

    // Bounce off walls
    if (x < 0 || x > width) vx *= -1;
    if (y < 0 || y > height) vy *= -1;

    // Keep in bounds
    x = Math.max(0, Math.min(width, x));
    y = Math.max(0, Math.min(height, y));

    return { ...p, x, y, vx, vy };
  });

  // Calculate connections
  const connections: typeof system.connections = [];
  const connectionDist = 180;
  const spawnChance = isActive ? 0.005 : 0.0002;

  for (let i = 0; i < newParticles.length; i++) {
    for (let j = i + 1; j < newParticles.length; j++) {
      const dx = newParticles[i].x - newParticles[j].x;
      const dy = newParticles[i].y - newParticles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < connectionDist) {
        const opacity = 1 - (dist / connectionDist);
        connections.push({ from: i, to: j, opacity: opacity * 0.4 });

        // Spawn signal
        if (Math.random() < spawnChance) {
          // Signal will be tracked separately
        }
      }
    }
  }

  return { particles: newParticles, connections };
}

// Image processing functions
function resizeImageData(imageData: ImageData, newWidth: number, newHeight: number): ImageData {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(newWidth * newHeight * 4);

  const xRatio = width / newWidth;
  const yRatio = height / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * newWidth + x) * 4;

      newData[dstIdx] = data[srcIdx];
      newData[dstIdx + 1] = data[srcIdx + 1];
      newData[dstIdx + 2] = data[srcIdx + 2];
      newData[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return new ImageData(newData, newWidth, newHeight);
}

function applyGrayscale(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(data);

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    newData[i] = gray;
    newData[i + 1] = gray;
    newData[i + 2] = gray;
  }

  return new ImageData(newData, width, height);
}

function applyBrightness(imageData: ImageData, amount: number): ImageData {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(data);

  for (let i = 0; i < data.length; i += 4) {
    newData[i] = Math.min(255, Math.max(0, data[i] + amount));
    newData[i + 1] = Math.min(255, Math.max(0, data[i + 1] + amount));
    newData[i + 2] = Math.min(255, Math.max(0, data[i + 2] + amount));
  }

  return new ImageData(newData, width, height);
}

function applyBlur(imageData: ImageData, radius: number): ImageData {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(data);

  // Simple box blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = (ny * width + nx) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
          }
        }
      }

      const idx = (y * width + x) * 4;
      newData[idx] = r / count;
      newData[idx + 1] = g / count;
      newData[idx + 2] = b / count;
    }
  }

  return new ImageData(newData, width, height);
}

// Message handler
self.onmessage = (event: MessageEvent<CanvasMessage>) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'RENDER_PARTICLES': {
        const { system, width, height, isActive } = payload as {
          system: ParticleSystem;
          width: number;
          height: number;
          isActive: boolean;
        };

        const result = simulateParticles(system, width, height, isActive);
        
        self.postMessage({
          id,
          type: 'PARTICLES_RESULT',
          payload: result
        });
        break;
      }

      case 'PROCESS_IMAGE': {
        const { imageData, operations } = payload as ImageProcessingRequest;
        
        let result = imageData;
        
        for (const op of operations) {
          switch (op.type) {
            case 'resize':
              result = resizeImageData(result, op.params.width, op.params.height);
              break;
            case 'grayscale':
              result = applyGrayscale(result);
              break;
            case 'brightness':
              result = applyBrightness(result, op.params.amount);
              break;
            case 'blur':
              result = applyBlur(result, op.params.radius);
              break;
          }
        }

        self.postMessage({
          id,
          type: 'IMAGE_RESULT',
          payload: { imageData: result }
        }, [result.data.buffer]);
        break;
      }

      case 'GENERATE_THUMBNAIL': {
        const { imageData, maxSize } = payload as {
          imageData: ImageData;
          maxSize: number;
        };

        const { width, height } = imageData;
        let newWidth = width;
        let newHeight = height;

        if (width > height) {
          if (width > maxSize) {
            newHeight = Math.round((height * maxSize) / width);
            newWidth = maxSize;
          }
        } else {
          if (height > maxSize) {
            newWidth = Math.round((width * maxSize) / height);
            newHeight = maxSize;
          }
        }

        const result = resizeImageData(imageData, newWidth, newHeight);

        self.postMessage({
          id,
          type: 'THUMBNAIL_RESULT',
          payload: { imageData: result, width: newWidth, height: newHeight }
        }, [result.data.buffer]);
        break;
      }

      default:
        self.postMessage({
          id,
          type: 'ERROR',
          payload: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      payload: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Export for TypeScript
export {};
