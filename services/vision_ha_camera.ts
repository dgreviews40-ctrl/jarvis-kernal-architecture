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
  private selectedDeviceId: string | null = null;
  private haCameras: HACamera[] = [];
  private haCameraImages: Map<string, string> = new Map(); // Store base64 images for HA cameras
  private refreshInterval: NodeJS.Timeout | null = null;

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
    if (!haService.initialized) {
      console.warn("Home Assistant not initialized, skipping camera load");
      return [];
    }

    try {
      // Fetch all entities and filter for cameras
      const status = await haService.getStatus();
      if (!status.connected) {
        console.warn("Home Assistant not connected, skipping camera load");
        return [];
      }

      // Get all entities from the HA service
      const allEntities = Array.from((haService as any).entities.values());
      this.haCameras = allEntities
        .filter(entity => entity.entity_id.startsWith('camera.'))
        .map(entity => ({
          entity_id: entity.entity_id,
          friendly_name: entity.attributes.friendly_name || entity.entity_id,
          state: entity.state,
          attributes: entity.attributes
        }));

      return this.haCameras;
    } catch (error) {
      console.error("Error loading HA cameras:", error);
      return [];
    }
  }

  public getHACameras(): HACamera[] {
    return this.haCameras;
  }

  public async switchToHACamera(cameraEntityId: string): Promise<void> {
    // Stop any active local camera
    if (this.state.type === 'local' && this.state.localStream) {
      this.state.localStream.getTracks().forEach(track => track.stop());
    }

    // Update state to HA camera mode
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

  public async captureHACamera(entityId: string): Promise<string | null> {
    if (!haService.initialized) {
      console.error("Home Assistant not initialized");
      return null;
    }

    try {
      // Get camera image from HA
      const response = await fetch(`http://localhost:3101/ha-api/camera_proxy/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${(haService as any).token}`,
          'Content-Type': 'image/jpeg'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch camera image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]); // Return base64 part
        };
        reader.onerror = () => reject(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`Error capturing HA camera ${entityId}:`, error);
      return null;
    }
  }

  public async refreshHACameraImage(entityId: string): Promise<void> {
    const base64Image = await this.captureHACamera(entityId);
    if (base64Image) {
      this.haCameraImages.set(entityId, base64Image);
    }
  }

  public getHACameraImage(entityId: string): string | null {
    return this.haCameraImages.get(entityId) || null;
  }

  public async startHACameraRefresh(entityId: string, intervalMs: number = 5000): Promise<void> {
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