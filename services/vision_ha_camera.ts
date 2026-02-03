import { VisionState } from "../types";
import { haService } from "./home_assistant";

export interface HACamera {
  entity_id: string;
  friendly_name: string;
  state: string;
  attributes: {
    [key: string]: any;
  };
}

export interface VisionCameraState {
  type: 'local' | 'home_assistant';
  isActive: boolean;
  currentCamera?: string; // For HA cameras
  localStream?: MediaStream;
}

class VisionHACameraCore {
  private state: VisionCameraState = { type: 'local', isActive: false };
  private observers: ((state: VisionCameraState) => void)[] = [];
  private haCameras: HACamera[] = [];
  private haCameraImages: Map<string, string> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;
  private cameraErrorCounts: Map<string, number> = new Map();
  private maxErrorRetries = 3;

  constructor() {
    this.loadHACameras();
  }

  public subscribe(callback: (state: VisionCameraState) => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  private notifyObservers() {
    this.observers.forEach(cb => cb(this.state));
  }

  public getState(): VisionCameraState {
    return this.state;
  }

  public async loadHACameras(): Promise<HACamera[]> {
    try {
      const token = (haService as any).token;
      if (!token) {
        return [];
      }

      const response = await fetch('http://localhost:3101/ha-api/states', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[VISION_HA_CAMERA] Failed to fetch entities: ${response.status}`);
        return [];
      }

      const allEntities = await response.json();
      
      // Define type for HA entity
      interface HAEntity {
        entity_id: string;
        state: string;
        attributes: Record<string, any>;
      }

      // Filter for camera entities
      this.haCameras = allEntities
        .filter((entity: HAEntity) => entity.entity_id.startsWith('camera.'))
        .map((entity: HAEntity) => ({
          entity_id: entity.entity_id,
          friendly_name: entity.attributes?.friendly_name || entity.entity_id,
          state: entity.state,
          attributes: entity.attributes || {}
        }));

      // Filter to only include cameras that are available
      this.haCameras = this.haCameras.filter(camera =>
        camera.state !== 'unavailable' && camera.state !== 'unknown'
      );

      console.log(`[VISION_HA_CAMERA] Found ${this.haCameras.length} available cameras`);
      return this.haCameras;
    } catch (error) {
      console.error("[VISION_HA_CAMERA] Error loading HA cameras:", error);
      return [];
    }
  }

  public getHACameras(): HACamera[] {
    return this.haCameras;
  }

  public async switchToHACamera(cameraEntityId: string): Promise<void> {
    const cameraExists = this.haCameras.some(cam => cam.entity_id === cameraEntityId);
    if (!cameraExists) {
      throw new Error(`Camera does not exist: ${cameraEntityId}`);
    }

    this.resetCameraErrors(cameraEntityId);

    if (this.state.type === 'local' && this.state.localStream) {
      this.state.localStream.getTracks().forEach(track => track.stop());
    }

    this.state = {
      type: 'home_assistant',
      isActive: true,
      currentCamera: cameraEntityId
    };

    this.notifyObservers();
  }

  public async switchToLocalCamera(deviceId?: string): Promise<void> {
    // Stop HA camera mode
    this.state = {
      type: 'local',
      isActive: false
    };

    // Start local camera
    await this.startLocalCamera(deviceId);
  }

  public async startLocalCamera(deviceId?: string): Promise<void> {
    if (this.state.type === 'local' && this.state.isActive) return;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          deviceId: deviceId ? { exact: deviceId } : undefined
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.state = {
        type: 'local',
        isActive: true,
        localStream: stream
      };

      this.notifyObservers();
    } catch (error) {
      console.error("Vision Access Denied:", error);
      throw new Error("Could not access camera.");
    }
  }

  public stopCamera() {
    if (this.state.type === 'local' && this.state.localStream) {
      this.state.localStream.getTracks().forEach(track => track.stop());
    }

    this.state = {
      type: 'local',
      isActive: false
    };

    this.notifyObservers();
  }

  public async captureCurrentFeed(): Promise<string | null> {
    if (this.state.type === 'local' && this.state.localStream) {
      // Capture from local camera
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = this.state.localStream;

      await new Promise(resolve => {
        video.onloadedmetadata = () => resolve(void 0);
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      return dataUrl.split(',')[1]; // Return base64 part
    } else if (this.state.type === 'home_assistant' && this.state.currentCamera) {
      // Capture from HA camera
      return await this.captureHACamera(this.state.currentCamera);
    }

    return null;
  }

  // Get the MJPEG stream URL for a camera (for direct use in img src)
  public getStreamUrl(entityId: string): string | null {
    const token = (haService as any).token;
    if (!token) {
      return null;
    }
    // Use the stream endpoint which provides continuous MJPEG
    // Note: Some cameras support quality parameter, but it depends on the integration
    return `http://localhost:3101/ha-api/camera_proxy_stream/${entityId}`;
  }

  // Get a high-quality snapshot URL (single frame, but full resolution)
  public getSnapshotUrl(entityId: string): string | null {
    const token = (haService as any).token;
    if (!token) {
      return null;
    }
    // camera_proxy returns full resolution snapshots
    return `http://localhost:3101/ha-api/camera_proxy/${entityId}?_t=${Date.now()}`;
  }

  public async captureHACamera(entityId: string): Promise<string | null> {
    const token = (haService as any).token;
    if (!token) {
      console.error("[VISION_HA_CAMERA] Home Assistant token not available");
      return null;
    }

    try {
      const timestamp = Date.now();
      const proxyUrl = `http://localhost:3101/ha-api/camera_proxy/${entityId}?_t=${timestamp}`;

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'image/jpeg, image/png, image/*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        console.error(`[VISION_HA_CAMERA] Failed to fetch camera image: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('image')) {
        console.error(`[VISION_HA_CAMERA] Expected image response but got: ${contentType}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        console.error(`[VISION_HA_CAMERA] Received empty response`);
        return null;
      }

      const base64 = await this.arrayBufferToBase64(arrayBuffer);
      return base64 && base64.length > 0 ? base64 : null;
    } catch (error) {
      console.error(`[VISION_HA_CAMERA] Error capturing camera ${entityId}:`, error);
      return null;
    }
  }

  private async arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
    try {
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('[VISION_HA_CAMERA] Error converting array buffer to base64:', error);
      return '';
    }
  }

  public async refreshHACameraImage(entityId: string): Promise<boolean> {
    const errorCount = this.cameraErrorCounts.get(entityId) || 0;
    if (errorCount >= this.maxErrorRetries) {
      return false; // Stop retrying silently after max retries
    }

    try {
      const base64Image = await this.captureHACamera(entityId);
      if (base64Image && base64Image.length > 0) {
        this.haCameraImages.set(entityId, base64Image);
        this.cameraErrorCounts.set(entityId, 0);
        return true;
      } else {
        this.cameraErrorCounts.set(entityId, errorCount + 1);
        return false;
      }
    } catch (error) {
      this.cameraErrorCounts.set(entityId, errorCount + 1);
      console.error(`[VISION_HA_CAMERA] Error refreshing camera ${entityId}:`, error);
      return false;
    }
  }

  // Reset error count for a camera (call when user manually selects it)
  public resetCameraErrors(entityId: string): void {
    this.cameraErrorCounts.set(entityId, 0);
  }

  public getHACameraImage(entityId: string): string | null {
    return this.haCameraImages.get(entityId) || null;
  }

  public async startHACameraRefresh(entityId: string, intervalMs: number = 15000): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Initial load
    await this.refreshHACameraImage(entityId);

    // Set up periodic refresh
    this.refreshInterval = setInterval(async () => {
      await this.refreshHACameraImage(entityId);
    }, intervalMs);
  }

  public stopHACameraRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export const visionHACamera = new VisionHACameraCore();