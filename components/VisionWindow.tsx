import React, { useEffect, useRef, useState } from 'react';
import { useKernelStore } from '../stores';
import { VisionState } from '../types';
import {
  Eye, EyeOff, Camera, RefreshCw, Power, ShieldAlert,
  ZoomIn, ZoomOut, Circle, Square, Download, Settings2, Sliders, Maximize2, Minimize2, Monitor, Home,
  ArrowLeft, Video
} from 'lucide-react';
import { vision } from '../services/vision';
import { visionHACamera, HACamera } from '../services/vision_ha_camera';

export const VisionWindow: React.FC = () => {
  // Get vision state from kernel store
  const state = useKernelStore((s) => s.visionState);
  const setVisionState = useKernelStore((s) => s.setVisionState);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fps, setFps] = useState(30);
  const [isRecording, setIsRecording] = useState(false);
  const [isFitMode, setIsFitMode] = useState(false); // Toggle between 'cover' and 'contain'
  const [capabilities, setCapabilities] = useState<MediaTrackCapabilities | null>(null);
  const [feedType, setFeedType] = useState<'local' | 'home_assistant'>('local'); // Track which feed is active
  const [haCameras, setHACameras] = useState<HACamera[]>([]);
  const [selectedHACamera, setSelectedHACamera] = useState<string | null>(null);
  const [haCameraImage, setHaCameraImage] = useState<string | null>(null);
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);

  // Subscribe to visionHACamera state changes and load cameras
  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = visionHACamera.subscribe((cameraState) => {
      if (!isMounted) return;
      // Update UI based on camera state - image updates happen via selected camera effect
    });

    // Load HA cameras when component mounts
    const loadCameras = async () => {
      setIsLoadingCameras(true);
      try {
        const cams = await visionHACamera.loadHACameras();
        if (isMounted) {
          setHACameras(cams);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCameras(false);
        }
      }
    };

    loadCameras();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Update when HA camera image changes - poll for updates when a camera is selected
  useEffect(() => {
    if (!selectedHACamera) return;
    
    let isMounted = true;
    
    const updateImage = () => {
      if (!isMounted || !selectedHACamera) return;
      const img = visionHACamera.getHACameraImage(selectedHACamera);
      if (img) {
        setHaCameraImage(`data:image/jpeg;base64,${img}`);
      }
    };
    
    // Initial load
    updateImage();
    
    // Poll for updates every 2 seconds when camera is selected
    const interval = setInterval(updateImage, 2000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedHACamera]);

  useEffect(() => {
    if (feedType === 'local') {
      if (state === VisionState.ACTIVE || state === VisionState.CAPTURING) {
        const stream = vision.getStream();
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          const caps = vision.getCapabilities();
          setCapabilities(caps);

          // If hardware zoom is available, use it, otherwise stay at 1.0 for software zoom
          if (caps && (caps as any).zoom) {
             setZoom((caps as any).zoom.min || 1);
          }
        }
      } else {
        setCapabilities(null);
      }
    }
    // For HA cameras, we handle the image differently in the render
  }, [state, feedType]);

  const handleToggle = async () => {
    if (state === VisionState.OFF || state === VisionState.ERROR) {
      if (feedType === 'local') {
        try {
          await vision.startCamera();
        } catch (e) {
          console.error("Failed to start local camera feed");
        }
      } else if (feedType === 'home_assistant' && selectedHACamera) {
        try {
          await visionHACamera.switchToHACamera(selectedHACamera);
          // Start refreshing the HA camera image
          await visionHACamera.startHACameraRefresh(selectedHACamera, 5000); // Refresh every 5 seconds
          // Set vision state to ACTIVE so the UI shows the camera feed
          setVisionState(VisionState.ACTIVE);
        } catch (e) {
          console.error("Failed to start HA camera feed");
        }
      }
    } else {
      if (feedType === 'local') {
        vision.stopCamera();
      } else if (feedType === 'home_assistant') {
        visionHACamera.stopHACameraRefresh();
        // Set vision state back to OFF
        setVisionState(VisionState.OFF);
      }
      setIsRecording(false);
    }
  };

  const handleZoomChange = (val: number) => {
    setZoom(val);
    // Attempt hardware zoom
    if (capabilities && (capabilities as any).zoom) {
        vision.applyConstraint('zoom', val);
    }
  };

  const handleFpsChange = (val: number) => {
    setFps(val);
    vision.applyConstraint('frameRate', val);
  };

  const takeSnapshot = async () => {
    if (feedType === 'local') {
      const data = vision.captureFrame();
      if (data) {
        const a = document.createElement('a');
        a.href = `data:image/jpeg;base64,${data}`;
        a.download = `STARK_CAPTURE_${Date.now()}.jpg`;
        a.click();
      }
    } else if (feedType === 'home_assistant' && selectedHACamera) {
      // Capture from HA camera
      const data = await visionHACamera.captureHACamera(selectedHACamera);
      if (data) {
        const a = document.createElement('a');
        a.href = `data:image/jpeg;base64,${data}`;
        a.download = `HA_CAMERA_${selectedHACamera.replace(/\./g, '_')}_${Date.now()}.jpg`;
        a.click();
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      vision.stopRecording();
      setIsRecording(false);
    } else {
      vision.startRecording();
      setIsRecording(true);
    }
  };

  if (state === VisionState.OFF || state === VisionState.ERROR) {
    return (
      <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 h-full flex flex-col items-center justify-center text-gray-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="p-8 rounded-full bg-cyan-950/20 border border-cyan-900/30 relative">
            <EyeOff size={64} className="text-cyan-900" />
            <div className="absolute inset-0 rounded-full border border-cyan-500/10 animate-ping"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-cyan-700 tracking-widest uppercase mb-2">Optical Array Standby</h3>
            <p className="text-xs font-mono text-gray-500 leading-relaxed uppercase tracking-tight">
              Awaiting authorization. Visual ingestion protocols are currently dormant.
            </p>
          </div>

          {/* Camera Type Selector */}
          <div className="flex gap-4 w-full">
            <button
              onClick={() => setFeedType('local')}
              className={`flex-1 py-2 border rounded-sm transition-all uppercase text-xs font-bold ${
                feedType === 'local'
                  ? 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50'
                  : 'bg-gray-900/40 text-gray-500 border-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Monitor size={14} />
                Local Cam
              </div>
            </button>

            <button
              onClick={() => setFeedType('home_assistant')}
              className={`flex-1 py-2 border rounded-sm transition-all uppercase text-xs font-bold ${
                feedType === 'home_assistant'
                  ? 'bg-green-900/40 text-green-400 border-green-500/50'
                  : 'bg-gray-900/40 text-gray-500 border-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Home size={14} />
                Smart Home
              </div>
            </button>
          </div>

          {/* HA Camera Selection */}
          {feedType === 'home_assistant' && (
            <div className="w-full">
              <label className="block text-xs text-cyan-600 font-bold uppercase tracking-wider mb-2">
                Select Camera
              </label>
              {isLoadingCameras ? (
                <div className="text-xs text-gray-500 py-2">Loading cameras...</div>
              ) : haCameras.length > 0 ? (
                <select
                  value={selectedHACamera || ''}
                  onChange={(e) => setSelectedHACamera(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-600 rounded p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Choose a camera...</option>
                  {haCameras.map((camera) => (
                    <option key={camera.entity_id} value={camera.entity_id}>
                      {camera.friendly_name || camera.entity_id}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-red-500 py-2">No Home Assistant cameras found</div>
              )}
            </div>
          )}

          <button
            onClick={handleToggle}
            disabled={feedType === 'home_assistant' && !selectedHACamera}
            className={`group relative px-8 py-3 border text-cyan-400 font-bold tracking-[0.2em] rounded-sm transition-all hover:bg-cyan-500 hover:text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer active:scale-95 uppercase text-xs ${
              feedType === 'home_assistant' && !selectedHACamera
                ? 'bg-gray-900/40 border-gray-700 cursor-not-allowed opacity-50'
                : 'bg-cyan-950/40 border-cyan-500/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Power size={14} className="group-hover:animate-pulse" />
              {feedType === 'local' ? 'Initialize Sensors' : 'Connect to Camera'}
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Determine if we are using software or hardware zoom
  const hasHardwareZoom = !!(capabilities && (capabilities as any).zoom);

  return (
    <div className="bg-black border border-cyan-900/50 rounded-lg h-full relative overflow-hidden flex flex-col font-mono">
      {/* Main View Area */}
      <div className="flex-1 relative bg-black group overflow-hidden min-h-0">
        {feedType === 'local' ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              // If hardware zoom isn't supported, we use CSS transform scale
              transform: !hasHardwareZoom ? `scale(${zoom})` : 'scale(1)',
              transformOrigin: 'center center'
            }}
            className={`w-full h-full transition-all duration-300 ${isFitMode ? 'object-contain' : 'object-cover'} ${state === VisionState.CAPTURING ? 'brightness-150' : 'opacity-80 group-hover:opacity-100'}`}
          />
        ) : feedType === 'home_assistant' && haCameraImage ? (
          <img
            src={haCameraImage}
            alt="Home Assistant Camera Feed"
            className={`w-full h-full transition-all duration-300 ${isFitMode ? 'object-contain' : 'object-cover'} ${state === VisionState.CAPTURING ? 'brightness-150' : 'opacity-80 group-hover:opacity-100'}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            Loading camera feed...
          </div>
        )}

        {/* HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="text-[10px] text-cyan-400 bg-black/70 px-2 py-1.5 border border-cyan-500/30 flex items-center gap-2 backdrop-blur-sm">
              <Eye size={12} className="animate-pulse" />
              {feedType === 'local' ? 'OPTIC_FEED: LOCAL CAM' : `OPTIC_FEED: HA - ${selectedHACamera || 'NO_CAM'}`}
            </div>

            <div className="flex flex-col items-end gap-2 pointer-events-auto">
              {/* Camera Control Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Stop current feed and go back to camera selection
                    if (feedType === 'local') {
                      vision.stopCamera();
                    } else if (feedType === 'home_assistant') {
                      visionHACamera.stopHACameraRefresh();
                    }
                    // Reset vision state to OFF to show camera selection screen
                    setVisionState(VisionState.OFF);
                    setIsRecording(false);
                  }}
                  className="bg-cyan-900/70 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-600 hover:text-white px-3 py-1.5 rounded transition-all font-bold uppercase text-[10px] flex items-center gap-1.5 backdrop-blur-sm"
                >
                  <ArrowLeft size={12} />
                  Change Cam
                </button>
                <button
                  onClick={handleToggle}
                  className="bg-red-900/70 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded transition-all font-bold uppercase text-[10px] backdrop-blur-sm"
                >
                  Stop Camera
                </button>
              </div>

              <div className="flex gap-2 bg-black/70 p-1.5 border border-cyan-500/20 rounded backdrop-blur-sm">
                <button
                  onClick={() => setIsFitMode(!isFitMode)}
                  title={isFitMode ? "Fill Frame" : "Fit Frame"}
                  className="p-1.5 hover:bg-cyan-500/20 text-cyan-400 rounded transition-colors cursor-pointer"
                >
                  {isFitMode ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <div className="w-[1px] bg-cyan-900/50"></div>
                <button onClick={takeSnapshot} title="Capture Snapshot" className="p-1.5 hover:bg-cyan-500/20 text-cyan-400 rounded transition-colors cursor-pointer"><Camera size={16} /></button>
                <div className="w-[1px] bg-cyan-900/50"></div>
                <button
                  onClick={toggleRecording}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                  className={`p-1.5 rounded transition-all cursor-pointer ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-red-500/20 text-red-500'}`}
                >
                  {isRecording ? <Square size={16} fill="currentColor" /> : <Circle size={16} fill="currentColor" />}
                </button>
              </div>

              {isRecording && (
                 <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/50 px-2 py-1 rounded">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Recording</span>
                 </div>
              )}
            </div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity">
            <div className="w-full h-full border border-cyan-500/40 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"></div>
            </div>
            <div className="absolute inset-0 border-t border-cyan-500/20 top-1/2 -translate-y-1/2"></div>
            <div className="absolute inset-0 border-l border-cyan-500/20 left-1/2 -translate-x-1/2"></div>
          </div>

          <div className="flex justify-between items-end">
            <div className="bg-black/70 border border-cyan-900/50 p-2 rounded text-[10px] text-cyan-500 backdrop-blur-sm">
               <div className="flex gap-4">
                  <span>FEED: {feedType === 'local' ? 'LOCAL' : 'HA CAMERA'}</span>
                  {feedType === 'local' && (
                    <>
                      <span>RES: 1080P</span>
                      <span>FPS: {fps}</span>
                      <span className={!hasHardwareZoom ? "text-yellow-500" : ""}>
                        ZOOM: x{zoom.toFixed(1)} {!hasHardwareZoom && "(SW)"}
                      </span>
                    </>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel Area */}
      <div className="h-36 bg-[#050505] border-t border-cyan-900/30 grid grid-cols-3 gap-4 p-4 shrink-0">
         {/* Zoom Control */}
         <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] text-cyan-600 font-bold uppercase tracking-wider">
               <ZoomIn size={12} /> {hasHardwareZoom ? "Optical Zoom" : "Software Scale"}
            </div>
            <div className="flex-1 bg-cyan-950/10 border border-cyan-900/20 rounded p-2 flex items-center gap-4">
               <button onClick={() => handleZoomChange(Math.max(0.5, zoom - 0.2))} className="p-1.5 text-cyan-500 hover:bg-cyan-900/30 rounded cursor-pointer transition-colors"><ZoomOut size={16}/></button>
               <input
                  type="range"
                  min={hasHardwareZoom ? (capabilities as any).zoom.min : 0.5}
                  max={hasHardwareZoom ? (capabilities as any).zoom.max : 4}
                  step="0.1"
                  value={zoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-500 h-1 bg-cyan-900/20 rounded-lg appearance-none cursor-pointer"
               />
               <button onClick={() => handleZoomChange(Math.min(4, zoom + 0.2))} className="p-1.5 text-cyan-500 hover:bg-cyan-900/30 rounded cursor-pointer transition-colors"><ZoomIn size={16}/></button>
            </div>
         </div>

         {/* FPS / Frequency Control */}
         <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] text-cyan-600 font-bold uppercase tracking-wider">
               <Sliders size={12} /> Refresh Rate [FPS]
            </div>
            <div className="flex-1 bg-cyan-950/10 border border-cyan-900/20 rounded p-2 flex flex-col justify-center">
               <input
                  type="range" min="10" max="60" step="5"
                  value={fps} onChange={(e) => handleFpsChange(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 h-1 bg-cyan-900/20 rounded-lg appearance-none cursor-pointer mb-2"
               />
               <div className="flex justify-between text-[9px] text-cyan-700 font-bold">
                  <span>10 FPS</span>
                  <span>30 FPS</span>
                  <span>60 FPS</span>
               </div>
            </div>
         </div>

         {/* Meta Actions */}
         <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] text-cyan-600 font-bold uppercase tracking-wider">
               <Settings2 size={12} /> Camera Source
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
               <button
                  onClick={() => {
                    if (feedType !== 'local') {
                      setFeedType('local');
                      const currentState = state as VisionState;
                      if (currentState !== VisionState.OFF && currentState !== VisionState.ERROR) {
                        vision.stopCamera();
                        visionHACamera.stopHACameraRefresh();
                      }
                    }
                  }}
                  className={`border transition-all rounded flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase cursor-pointer ${
                    feedType === 'local' ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-cyan-900/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-white'
                  }`}
                >
                  <Monitor size={14} />
                  Local
               </button>
               <button
                  onClick={() => {
                    if (feedType !== 'home_assistant') {
                      setFeedType('home_assistant');
                      const currentState = state as VisionState;
                      if (currentState !== VisionState.OFF && currentState !== VisionState.ERROR) {
                        vision.stopCamera();
                        visionHACamera.stopHACameraRefresh();
                      }
                    }
                  }}
                  className={`border transition-all rounded flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase cursor-pointer ${
                    feedType === 'home_assistant' ? 'bg-green-500 text-white border-green-400' : 'bg-green-900/20 border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white'
                  }`}
                >
                  <Home size={14} />
                  HA Cam
               </button>
            </div>
         </div>
      </div>

      {/* Capture Flash Overlay */}
      {state === VisionState.CAPTURING && (
        <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none z-50"></div>
      )}
    </div>
  );
};

export default VisionWindow;