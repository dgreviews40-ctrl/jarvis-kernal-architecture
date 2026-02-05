/**
 * JarvisNeuralNetwork - React Wrapper for 3D Spherical Neural Network
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NeuralNetworkCore } from './jarvis-neural-network';

type VoiceState = 'idle' | 'listening' | 'speaking';

interface JarvisNeuralNetworkProps {
  cpuLoad?: number;
  gpuLoad?: number;
  voiceState?: VoiceState;
  nodeSize?: number;
  brightness?: number;
  rotationSpeed?: number;
  width?: number;
  height?: number;
  showControls?: boolean;
  className?: string;
  onNodeSizeChange?: (size: number) => void;
  onBrightnessChange?: (brightness: number) => void;
  onRotationChange?: (speed: number) => void;
}

export const JarvisNeuralNetwork: React.FC<JarvisNeuralNetworkProps> = ({
  cpuLoad = 0,
  gpuLoad = 0,
  voiceState = 'idle',
  nodeSize: initialNodeSize = 0.08,
  brightness: initialBrightness = 1.0,
  rotationSpeed: initialRotation = 0.001,
  width = 640,
  height = 640,
  showControls = true,
  className = '',
  onNodeSizeChange,
  onBrightnessChange,
  onRotationChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<NeuralNetworkCore | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const [nodeSize, setNodeSize] = useState(initialNodeSize);
  const [brightness, setBrightness] = useState(initialBrightness);
  const [rotationSpeed, setRotationSpeed] = useState(initialRotation);
  const [fps, setFps] = useState(60);

  useEffect(() => setNodeSize(initialNodeSize), [initialNodeSize]);
  useEffect(() => setBrightness(initialBrightness), [initialBrightness]);
  useEffect(() => setRotationSpeed(initialRotation), [initialRotation]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (networkRef.current) {
      networkRef.current.destroy();
    }
    
    const existingCanvas = containerRef.current.querySelector('canvas');
    if (existingCanvas && containerRef.current.contains(existingCanvas)) {
      containerRef.current.removeChild(existingCanvas);
    }

    const network = new NeuralNetworkCore(containerRef.current, {
      nodeCount: 120,
      nodeSize,
      connectionDistance: 4.5,
      rotationSpeed,
      brightness,
      cpuLoad,
      gpuLoad,
      voiceState,
    });
    
    networkRef.current = network;

    let lastTime = performance.now();
    let frames = 0;
    let lastFpsTime = lastTime;

    const animate = () => {
      const now = performance.now();
      frames++;
      if (now - lastFpsTime >= 500) {
        setFps(Math.round(frames * 2));
        frames = 0;
        lastFpsTime = now;
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      network.destroy();
      networkRef.current = null;
    };
  }, []);

  useEffect(() => { if (networkRef.current) networkRef.current.setCpuLoad(cpuLoad); }, [cpuLoad]);
  useEffect(() => { if (networkRef.current) networkRef.current.setGpuLoad(gpuLoad); }, [gpuLoad]);
  useEffect(() => { if (networkRef.current) networkRef.current.setVoiceState(voiceState); }, [voiceState]);
  useEffect(() => { if (networkRef.current) networkRef.current.setNodeSize(nodeSize); }, [nodeSize]);
  useEffect(() => { if (networkRef.current) networkRef.current.setBrightness(brightness); }, [brightness]);
  useEffect(() => { if (networkRef.current) networkRef.current.setRotationSpeed(rotationSpeed); }, [rotationSpeed]);

  const handleNodeSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setNodeSize(value);
    localStorage.setItem('jarvis.neural.nodeSize', String(value));
    onNodeSizeChange?.(value);
  }, [onNodeSizeChange]);

  const handleBrightnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setBrightness(value);
    localStorage.setItem('jarvis.neural.brightness', String(value));
    onBrightnessChange?.(value);
  }, [onBrightnessChange]);

  const handleRotationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setRotationSpeed(value);
    localStorage.setItem('jarvis.neural.rotation', String(value));
    onRotationChange?.(value);
  }, [onRotationChange]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <div
        ref={containerRef}
        style={{
          width,
          height,
          background: 'transparent',
          position: 'relative',
          overflow: 'visible',
        }}
      />

      {showControls && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50"
          style={{
            background: 'linear-gradient(180deg, rgba(10,15,30,0.95) 0%, rgba(5,8,16,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100, 150, 255, 0.25)',
            borderRadius: '16px',
            padding: '16px 20px',
            minWidth: '280px',
            maxWidth: '320px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 30px rgba(100, 150, 255, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'linear-gradient(135deg, #00ddff, #ff00ff)' }} />
              <span className="text-xs font-bold tracking-widest bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                NEURAL NET
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{fps} FPS</span>
          </div>

          {/* Node Size */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Node Size</label>
              <span className="text-[10px] font-mono font-bold text-cyan-400">{(nodeSize * 1000).toFixed(0)}</span>
            </div>
            <input
              type="range"
              min="0.03"
              max="0.18"
              step="0.01"
              value={nodeSize}
              onChange={handleNodeSizeChange}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #00ddff 0%, #00ddff ${((nodeSize - 0.03) / 0.15) * 100}%, rgba(255,255,255,0.1) ${((nodeSize - 0.03) / 0.15) * 100}%)`,
              }}
            />
          </div>

          {/* Brightness */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Brightness</label>
              <span className="text-[10px] font-mono font-bold text-yellow-400">{(brightness * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.5"
              step="0.1"
              value={brightness}
              onChange={handleBrightnessChange}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #444 0%, #ffff00 ${((brightness - 0.3) / 1.2) * 100}%, rgba(255,255,255,0.1) ${((brightness - 0.3) / 1.2) * 100}%)`,
              }}
            />
          </div>

          {/* Rotation */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Rotation</label>
              <span className="text-[10px] font-mono font-bold text-purple-400">{(rotationSpeed * 1000).toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.005"
              step="0.0005"
              value={rotationSpeed}
              onChange={handleRotationChange}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #8844ff 0%, #ff4488 ${(rotationSpeed / 0.005) * 100}%, rgba(255,255,255,0.1) ${(rotationSpeed / 0.005) * 100}%)`,
              }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
            <div className="text-center">
              <div className="text-sm font-bold font-mono text-cyan-400">{Math.round(cpuLoad)}%</div>
              <div className="text-[8px] text-slate-500 uppercase">CPU</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold font-mono text-purple-400">{Math.round(gpuLoad)}%</div>
              <div className="text-[8px] text-slate-500 uppercase">GPU</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold font-mono uppercase text-pink-400">
                {voiceState === 'speaking' ? 'TTS' : voiceState === 'listening' ? 'STT' : 'IDLE'}
              </div>
              <div className="text-[8px] text-slate-500 uppercase">Voice</div>
            </div>
          </div>

          <style>{`
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: white;
              cursor: pointer;
              box-shadow: 0 0 0 2px rgba(0,0,0,0.8), 0 0 8px rgba(255,255,255,0.5);
              transition: transform 0.1s;
            }
            input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.1); }
          `}</style>

          <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 rounded-tl-lg border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 rounded-tr-lg border-purple-500/50" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 rounded-bl-lg border-pink-500/50" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 rounded-br-lg border-orange-500/50" />
        </div>
      )}
    </div>
  );
};

export default JarvisNeuralNetwork;
