/**
 * JarvisNeuralNetwork - React Wrapper for 3D Spherical Neural Network
 * 
 * A complete 3D globe of neural nodes with firing pulses.
 * Reacts to system load (CPU/GPU) and voice state.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NeuralNetworkCore } from './jarvis-neural-network';

type VoiceState = 'idle' | 'listening' | 'speaking';

interface JarvisNeuralNetworkProps {
  cpuLoad?: number;
  gpuLoad?: number;
  voiceState?: VoiceState;
  activityLevel?: number;
  rotationSpeed?: number;
  width?: number;
  height?: number;
  showControls?: boolean;
  className?: string;
  onActivityChange?: (level: number) => void;
  onRotationChange?: (speed: number) => void;
}

export const JarvisNeuralNetwork: React.FC<JarvisNeuralNetworkProps> = ({
  cpuLoad = 0,
  gpuLoad = 0,
  voiceState = 'idle',
  activityLevel: initialActivity = 0.8,
  rotationSpeed: initialRotation = 0.001,
  width = 600,
  height = 600,
  showControls = true,
  className = '',
  onActivityChange,
  onRotationChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<NeuralNetworkCore | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const [activityLevel, setActivityLevel] = useState(initialActivity);
  const [rotationSpeed, setRotationSpeed] = useState(initialRotation);
  const [fps, setFps] = useState(60);

  useEffect(() => setActivityLevel(initialActivity), [initialActivity]);
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
      connectionDensity: 0.12,
      radius: 7,
      rotationSpeed,
      activityLevel,
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
  useEffect(() => { if (networkRef.current) networkRef.current.setActivityLevel(activityLevel); }, [activityLevel]);
  useEffect(() => { if (networkRef.current) networkRef.current.setRotationSpeed(rotationSpeed); }, [rotationSpeed]);

  const handleActivityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setActivityLevel(value);
    localStorage.setItem('jarvis.neural.activity', String(value));
    onActivityChange?.(value);
  }, [onActivityChange]);

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
            padding: '18px 22px',
            minWidth: '260px',
            maxWidth: '300px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 30px rgba(100, 150, 255, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'linear-gradient(135deg, #00ddff, #ff00ff)' }} />
              <span className="text-xs font-bold tracking-widest bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                NEURAL SPHERE
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{fps} FPS</span>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Activity</label>
              <span className="text-[11px] font-mono font-bold text-cyan-400">{(activityLevel * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.5"
              step="0.1"
              value={activityLevel}
              onChange={handleActivityChange}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #00ddff 0%, #ff00ff ${((activityLevel - 0.3) / 1.2) * 50}%, #ff8800 ${((activityLevel - 0.3) / 1.2) * 100}%, rgba(255,255,255,0.1) ${((activityLevel - 0.3) / 1.2) * 100}%)`,
              }}
            />
            <style>{`
              input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: linear-gradient(135deg, #00ddff, #ff00ff);
                cursor: pointer;
                box-shadow: 0 0 0 2px rgba(0,0,0,0.8), 0 0 10px rgba(0,221,255,0.8);
                transition: transform 0.1s;
              }
              input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); }
            `}</style>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Rotation</label>
              <span className="text-[11px] font-mono font-bold text-purple-400">{(rotationSpeed * 1000).toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.005"
              step="0.0005"
              value={rotationSpeed}
              onChange={handleRotationChange}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #8844ff 0%, #ff4488 ${(rotationSpeed / 0.005) * 100}%, rgba(255,255,255,0.1) ${(rotationSpeed / 0.005) * 100}%)`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
            <div className="text-center">
              <div className="text-sm font-bold font-mono text-cyan-400">{Math.round(cpuLoad)}%</div>
              <div className="text-[9px] text-slate-500 uppercase">CPU</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold font-mono text-purple-400">{Math.round(gpuLoad)}%</div>
              <div className="text-[9px] text-slate-500 uppercase">GPU</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold font-mono uppercase text-pink-400">
                {voiceState === 'speaking' ? 'TTS' : voiceState === 'listening' ? 'STT' : 'IDLE'}
              </div>
              <div className="text-[9px] text-slate-500 uppercase">Voice</div>
            </div>
          </div>

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
