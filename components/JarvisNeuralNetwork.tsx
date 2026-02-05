/**
 * JarvisNeuralNetwork - React Wrapper for Neural Network Visualization
 * 
 * Replaces the Arc Reactor with a brain-inspired neural network.
 * Reacts to system load (CPU/GPU) and voice state.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NeuralNetworkCore } from './jarvis-neural-network';

type VoiceState = 'idle' | 'listening' | 'speaking';
type ColorTheme = 'cyan' | 'orange' | 'purple' | 'green';

interface JarvisNeuralNetworkProps {
  /** CPU load percentage (0-100) */
  cpuLoad?: number;
  /** GPU load percentage (0-100) */
  gpuLoad?: number;
  /** Current voice state */
  voiceState?: VoiceState;
  /** Visual theme color */
  colorTheme?: ColorTheme;
  /** Base activity level (0-1) */
  activityLevel?: number;
  /** Network rotation speed */
  rotationSpeed?: number;
  /** Electrical pulse speed */
  pulseSpeed?: number;
  /** Width of the visualization */
  width?: number;
  /** Height of the visualization */
  height?: number;
  /** Show control panel */
  showControls?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when color theme changes */
  onColorChange?: (theme: ColorTheme) => void;
  /** Callback when activity level changes */
  onActivityChange?: (level: number) => void;
  /** Callback when rotation speed changes */
  onRotationChange?: (speed: number) => void;
}

export const JarvisNeuralNetwork: React.FC<JarvisNeuralNetworkProps> = ({
  cpuLoad = 0,
  gpuLoad = 0,
  voiceState = 'idle',
  colorTheme: initialColorTheme = 'cyan',
  activityLevel: initialActivity = 0.7,
  rotationSpeed: initialRotation = 0.002,
  pulseSpeed: initialPulseSpeed = 1.0,
  width = 520,
  height = 520,
  showControls = true,
  className = '',
  onColorChange,
  onActivityChange,
  onRotationChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<NeuralNetworkCore | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Local state
  const [colorTheme, setColorTheme] = useState<ColorTheme>(initialColorTheme);
  const [activityLevel, setActivityLevel] = useState(initialActivity);
  const [rotationSpeed, setRotationSpeed] = useState(initialRotation);
  const [pulseSpeed, setPulseSpeed] = useState(initialPulseSpeed);
  const [fps, setFps] = useState(60);

  // Sync props
  useEffect(() => setColorTheme(initialColorTheme), [initialColorTheme]);
  useEffect(() => setActivityLevel(initialActivity), [initialActivity]);
  useEffect(() => setRotationSpeed(initialRotation), [initialRotation]);

  // Initialize neural network
  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous instance
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (networkRef.current) {
      networkRef.current.destroy();
    }
    
    // Remove any existing canvas
    const existingCanvas = containerRef.current.querySelector('canvas');
    if (existingCanvas && containerRef.current.contains(existingCanvas)) {
      containerRef.current.removeChild(existingCanvas);
    }

    console.log('[JarvisNeuralNetwork] Initializing neural network...');

    const network = new NeuralNetworkCore(containerRef.current, {
      nodeCount: 64,
      connectionDensity: 0.15,
      rotationSpeed,
      pulseSpeed,
      activityLevel,
      colorTheme,
      cpuLoad,
      gpuLoad,
      voiceState,
    });
    
    networkRef.current = network;

    // FPS tracking
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
  }, []); // Only initialize once

  // Update network when props change (without recreating)
  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setCpuLoad(cpuLoad);
    }
  }, [cpuLoad]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setGpuLoad(gpuLoad);
    }
  }, [gpuLoad]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setVoiceState(voiceState);
    }
  }, [voiceState]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setColorTheme(colorTheme);
    }
  }, [colorTheme]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setActivityLevel(activityLevel);
    }
  }, [activityLevel]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setRotationSpeed(rotationSpeed);
    }
  }, [rotationSpeed]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setPulseSpeed(pulseSpeed);
    }
  }, [pulseSpeed]);

  // Handlers
  const handleColorChange = useCallback((newTheme: ColorTheme) => {
    setColorTheme(newTheme);
    localStorage.setItem('jarvis.neural.color', newTheme);
    onColorChange?.(newTheme);
  }, [onColorChange]);

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

  const themeInfo = {
    cyan: { name: 'Neural Blue', color: '#00ddff', bg: '#001a2e', desc: 'Standard' },
    orange: { name: 'Plasma', color: '#ff8800', bg: '#2e1500', desc: 'Warm' },
    purple: { name: 'Synaptic', color: '#ff00ff', bg: '#2e002e', desc: 'Electric' },
    green: { name: 'Bio', color: '#00ff88', bg: '#002e15', desc: 'Organic' }
  };

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Main neural network container */}
      <div
        ref={containerRef}
        style={{
          width,
          height,
          background: 'transparent',
          position: 'relative',
          overflow: 'visible',
          borderRadius: '50%',
        }}
      />

      {/* Professional Control Panel */}
      {showControls && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50"
          style={{
            background: 'linear-gradient(180deg, rgba(10,20,40,0.95) 0%, rgba(5,10,20,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 170, 255, 0.3)',
            borderRadius: '16px',
            padding: '20px 24px',
            minWidth: '280px',
            maxWidth: '320px',
            boxShadow: `
              0 0 0 1px rgba(0,0,0,0.5),
              0 4px 20px rgba(0,0,0,0.5),
              0 0 30px rgba(0, 170, 255, 0.15),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ 
                  background: themeInfo[colorTheme].color,
                  boxShadow: `0 0 10px ${themeInfo[colorTheme].color}` 
                }} 
              />
              <span className="text-xs font-bold tracking-widest" style={{ color: themeInfo[colorTheme].color }}>
                NEURAL NET
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500">{fps} FPS</span>
            </div>
          </div>

          {/* Color Theme Selector */}
          <div className="mb-5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Neural Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(themeInfo) as ColorTheme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleColorChange(t)}
                  className={`
                    relative px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider
                    transition-all duration-200 overflow-hidden
                    ${colorTheme === t 
                      ? 'text-white' 
                      : 'text-slate-500 hover:text-slate-300'
                    }
                  `}
                  style={{
                    background: colorTheme === t 
                      ? `linear-gradient(135deg, ${themeInfo[t].color}30 0%, ${themeInfo[t].color}10 100%)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${colorTheme === t ? themeInfo[t].color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: colorTheme === t 
                      ? `0 0 15px ${themeInfo[t].color}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                      : 'none',
                  }}
                >
                  <div className="relative z-10 flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ background: themeInfo[t].color }}
                    />
                    <div className="flex flex-col items-start">
                      <span>{themeInfo[t].name}</span>
                      <span className="text-[8px] opacity-60 font-normal normal-case">{themeInfo[t].desc}</span>
                    </div>
                  </div>
                  {colorTheme === t && (
                    <div 
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: `linear-gradient(135deg, ${themeInfo[t].color} 0%, transparent 100%)`,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Level Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Activity Level
              </label>
              <span 
                className="text-[11px] font-mono font-bold"
                style={{ color: themeInfo[colorTheme].color }}
              >
                {(activityLevel * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative h-6 flex items-center">
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.1"
                value={activityLevel}
                onChange={handleActivityChange}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, 
                    ${themeInfo[colorTheme].color} 0%, 
                    ${themeInfo[colorTheme].color} ${((activityLevel - 0.2) / 1.3) * 100}%, 
                    rgba(255,255,255,0.1) ${((activityLevel - 0.2) / 1.3) * 100}%, 
                    rgba(255,255,255,0.1) 100%
                  )`,
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                }}
              />
              <style>{`
                input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: ${themeInfo[colorTheme].color};
                  cursor: pointer;
                  box-shadow: 
                    0 0 0 2px rgba(0,0,0,0.8),
                    0 0 10px ${themeInfo[colorTheme].color},
                    0 0 20px ${themeInfo[colorTheme].color}80;
                  transition: transform 0.1s, box-shadow 0.2s;
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                  transform: scale(1.1);
                  box-shadow: 
                    0 0 0 2px rgba(0,0,0,0.8),
                    0 0 15px ${themeInfo[colorTheme].color},
                    0 0 30px ${themeInfo[colorTheme].color};
                }
              `}</style>
            </div>
          </div>

          {/* Rotation Speed Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Rotation Speed
              </label>
              <span 
                className="text-[11px] font-mono font-bold"
                style={{ color: themeInfo[colorTheme].color }}
              >
                {(rotationSpeed * 1000).toFixed(0)}x
              </span>
            </div>
            <div className="relative h-6 flex items-center">
              <input
                type="range"
                min="0"
                max="0.01"
                step="0.001"
                value={rotationSpeed}
                onChange={handleRotationChange}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, 
                    ${themeInfo[colorTheme].color} 0%, 
                    ${themeInfo[colorTheme].color} ${(rotationSpeed / 0.01) * 100}%, 
                    rgba(255,255,255,0.1) ${(rotationSpeed / 0.01) * 100}%, 
                    rgba(255,255,255,0.1) 100%
                  )`,
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <div className="text-center">
              <div 
                className="text-sm font-bold font-mono"
                style={{ color: themeInfo[colorTheme].color }}
              >
                {Math.round(cpuLoad)}%
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">CPU</div>
            </div>
            <div className="text-center">
              <div 
                className="text-sm font-bold font-mono"
                style={{ color: themeInfo[colorTheme].color }}
              >
                {Math.round(gpuLoad)}%
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">GPU</div>
            </div>
            <div className="text-center">
              <div 
                className="text-sm font-bold font-mono uppercase"
                style={{ color: themeInfo[colorTheme].color }}
              >
                {voiceState === 'speaking' ? 'TTS' : voiceState === 'listening' ? 'STT' : 'IDLE'}
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Voice</div>
            </div>
          </div>

          {/* Decorative corner accents */}
          <div 
            className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 rounded-tl-lg"
            style={{ borderColor: themeInfo[colorTheme].color, opacity: 0.5 }}
          />
          <div 
            className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 rounded-tr-lg"
            style={{ borderColor: themeInfo[colorTheme].color, opacity: 0.5 }}
          />
          <div 
            className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 rounded-bl-lg"
            style={{ borderColor: themeInfo[colorTheme].color, opacity: 0.5 }}
          />
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 rounded-br-lg"
            style={{ borderColor: themeInfo[colorTheme].color, opacity: 0.5 }}
          />
        </div>
      )}
    </div>
  );
};

export default JarvisNeuralNetwork;
