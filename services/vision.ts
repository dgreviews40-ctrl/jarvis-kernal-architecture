import { VisionState } from "../types";

class VisionCore {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private state: VisionState = VisionState.OFF;
  private observers: ((state: VisionState) => void)[] = [];
  private selectedDeviceId: string | null = null;
  
  // Recording State
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    // Hidden elements for capture
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    
    this.canvasElement = document.createElement('canvas');
  }

  public subscribe(callback: (state: VisionState) => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  public setDeviceId(deviceId: string) {
    this.selectedDeviceId = deviceId;
    if (this.state === VisionState.ACTIVE) {
      this.stopCamera();
      this.startCamera(); 
    }
  }

  private setState(newState: VisionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.observers.forEach(cb => cb(newState));
  }

  public getState(): VisionState {
    return this.state;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public async startCamera(): Promise<void> {
    if (this.state === VisionState.ACTIVE) return;
    
    try {
      this.setState(VisionState.STARTING);
      
      const constraints: MediaStreamConstraints = {
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined
        } 
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }

      this.setState(VisionState.ACTIVE);
    } catch (error) {
      console.error("Vision Access Denied:", error);
      this.setState(VisionState.ERROR);
      throw new Error("Could not access camera.");
    }
  }

  public stopCamera() {
    this.stopRecording();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.setState(VisionState.OFF);
  }

  public async applyConstraint(name: string, value: any) {
    if (!this.stream) return;
    const track = this.stream.getVideoTracks()[0];
    if (track) {
      try {
        const constraints: any = { advanced: [{ [name]: value }] };
        await track.applyConstraints(constraints);
      } catch (e) {
        console.warn(`Constraint ${name} not supported or failed:`, e);
      }
    }
  }

  public getCapabilities(): MediaTrackCapabilities | null {
    if (!this.stream) return null;
    const track = this.stream.getVideoTracks()[0];
    return track ? track.getCapabilities() : null;
  }

  public captureFrame(): string | null {
    if (this.state !== VisionState.ACTIVE || !this.videoElement || !this.canvasElement) {
      return null;
    }

    this.setState(VisionState.CAPTURING);
    
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;
    
    const ctx = this.canvasElement.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(this.videoElement, 0, 0);
    const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.95);
    
    setTimeout(() => this.setState(VisionState.ACTIVE), 300);

    return dataUrl.split(',')[1];
  }

  public startRecording() {
    if (!this.stream || this.mediaRecorder) return;

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JARVIS_OPTIC_LOG_${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    this.mediaRecorder.start();
  }

  public stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
  }

  public isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  public async getDevices(): Promise<MediaDeviceInfo[]> {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch (e) {
      console.warn("Could not enumerate devices", e);
      return [];
    }
  }
}

export const vision = new VisionCore();