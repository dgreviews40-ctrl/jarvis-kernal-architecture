/**
 * JarvisArcReactor - React Wrapper
 * Supports: Classic, Cinematic, and Authentic (MCU-accurate) versions
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { JarvisArcReactor as ArcReactorClass, CinematicArcReactor, AuthenticArcReactor } from './jarvis-arc-reactor';

type ReactorMode = 'classic' | 'cinematic' | 'authentic';
type ColorMode = 'classic' | 'warm' | 'cyberpunk';

interface JarvisArcReactorProps {
  audioStream?: MediaStream | null;
  width?: number;
  height?: number;
  glowIntensity?: number;
  /** Reactor design mode */
  mode?: ReactorMode;
  /** Color mode for cinematic/authentic versions */
  colorMode?: ColorMode;
  /** Show control panel */
  showControls?: boolean;
  /** Number of particles in cinematic mode */
  particleCount?: number;
  className?: string;
  /** Callback when glow intensity changes */
  onGlowChange?: (value: number) => void;
  /** Callback when color mode changes */
  onColorChange?: (mode: ColorMode) => void;
  /** Callback when reactor mode changes */
  onModeChange?: (mode: ReactorMode) => void;
}

export const JarvisArcReactor: React.FC<JarvisArcReactorProps> = ({
  audioStream,
  width = 400,
  height = 400,
  glowIntensity: initialGlow = 1.0,
  mode = 'authentic',
  colorMode: initialColorMode = 'classic',
  showControls = true,
  particleCount = 150,
  className = '',
  onGlowChange,
  onColorChange,
  onModeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactorRef = useRef<ArcReactorClass | CinematicArcReactor | AuthenticArcReactor | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Local state
  const [glowIntensity, setGlowIntensity] = useState(initialGlow);
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorMode);
  const [reactorMode, setReactorMode] = useState<ReactorMode>(mode);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [fps, setFps] = useState(60);

  // Sync props
  useEffect(() => setGlowIntensity(initialGlow), [initialGlow]);
  useEffect(() => setColorMode(initialColorMode), [initialColorMode]);
  useEffect(() => setReactorMode(mode), [mode]);

  // Initialize reactor
  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (reactorRef.current && 'destroy' in reactorRef.current) {
      reactorRef.current.destroy();
    }
    
    const existingCanvas = containerRef.current.querySelector('canvas');
    if (existingCanvas && containerRef.current.contains(existingCanvas)) {
      containerRef.current.removeChild(existingCanvas);
    }

    console.log(`[JarvisArcReactor] Initializing ${reactorMode} mode...`);

    let reactor: ArcReactorClass | CinematicArcReactor | AuthenticArcReactor;

    switch (reactorMode) {
      case 'authentic':
        reactor = new AuthenticArcReactor(containerRef.current, {
          glowIntensity,
          colorMode,
          audioReactivity: true
        });
        break;
      case 'cinematic':
        const colorShift = ['classic', 'warm', 'cyberpunk'].indexOf(colorMode);
        reactor = new CinematicArcReactor(containerRef.current, {
          glowIntensity,
          colorShift: colorShift >= 0 ? colorShift : 0,
          particleCount,
        });
        break;
      case 'classic':
      default:
        reactor = new ArcReactorClass(containerRef.current);
    }
    
    reactorRef.current = reactor;

    if (audioStream) {
      reactor.initAudio(audioStream).then(() => {
        setIsAudioActive(true);
      }).catch(console.error);
    }

    // Animation loop
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
      reactor.update();
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if ('destroy' in reactor) reactor.destroy();
      reactorRef.current = null;
    };
  }, [reactorMode, colorMode, glowIntensity, particleCount, audioStream]);

  // Handlers
  const handleGlowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setGlowIntensity(value);
    onGlowChange?.(value);
  }, [onGlowChange]);

  const handleColorChange = useCallback((newMode: ColorMode) => {
    setColorMode(newMode);
    onColorChange?.(newMode);
  }, [onColorChange]);

  const handleModeChange = useCallback((newMode: ReactorMode) => {
    setReactorMode(newMode);
    onModeChange?.(newMode);
  }, [onModeChange]);

  const modeInfo = {
    authentic: { name: 'MARK I', desc: 'Palladium Core', color: '#00ddff' },
    cinematic: { name: 'CINEMATIC', desc: 'Enhanced FX', color: '#00ff88' },
    classic: { name: 'CLASSIC', desc: 'Original', color: '#888888' }
  };

  const colorInfo = {
    classic: { name: 'Palladium', color: '#00ddff', bg: '#001133' },
    warm: { name: 'Plasma', color: '#ff8800', bg: '#331100' },
    cyberpunk: { name: 'Vibranium', color: '#ff00ff', bg: '#330033' }
  };

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Main reactor container */}
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
                  background: colorInfo[colorMode].color,
                  boxShadow: `0 0 10px ${colorInfo[colorMode].color}` 
                }} 
              />
              <span className="text-xs font-bold tracking-widest" style={{ color: colorInfo[colorMode].color }}>
                ARC REACTOR
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isAudioActive && (
                <span className="text-[10px] font-mono text-green-400">● AUDIO</span>
              )}
              <span className="text-[10px] font-mono text-slate-500">{fps} FPS</span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="mb-5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Reactor Model
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(modeInfo) as ReactorMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`
                    relative px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider
                    transition-all duration-200 overflow-hidden
                    ${reactorMode === m 
                      ? 'text-white' 
                      : 'text-slate-500 hover:text-slate-300'
                    }
                  `}
                  style={{
                    background: reactorMode === m 
                      ? `linear-gradient(135deg, ${modeInfo[m].color}30 0%, ${modeInfo[m].color}10 100%)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${reactorMode === m ? modeInfo[m].color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: reactorMode === m 
                      ? `0 0 15px ${modeInfo[m].color}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                      : 'none',
                  }}
                >
                  <div className="relative z-10 flex flex-col items-center gap-0.5">
                    <span>{modeInfo[m].name}</span>
                    <span className="text-[8px] opacity-60 font-normal normal-case">{modeInfo[m].desc}</span>
                  </div>
                  {reactorMode === m && (
                    <div 
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: `linear-gradient(135deg, ${modeInfo[m].color} 0%, transparent 100%)`,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Color Mode Selector */}
          <div className="mb-5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Core Element
            </label>
            <div className="flex gap-2">
              {(Object.keys(colorInfo) as ColorMode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className={`
                    flex-1 relative px-3 py-2.5 rounded-lg
                    transition-all duration-200
                    ${colorMode === c ? 'scale-105' : 'hover:scale-102'}
                  `}
                  style={{
                    background: colorMode === c 
                      ? `linear-gradient(135deg, ${colorInfo[c].bg} 0%, rgba(0,0,0,0.5) 100%)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${colorMode === c ? colorInfo[c].color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: colorMode === c 
                      ? `0 0 20px ${colorInfo[c].color}40, inset 0 1px 0 rgba(255,255,255,0.1)`
                      : 'inset 0 1px 0 rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ 
                        background: colorInfo[c].color,
                        boxShadow: colorMode === c ? `0 0 10px ${colorInfo[c].color}` : 'none'
                      }}
                    />
                    <span 
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{ color: colorMode === c ? colorInfo[c].color : '#64748b' }}
                    >
                      {colorInfo[c].name}
                    </span>
                  </div>
                  {colorMode === c && (
                    <div 
                      className="absolute inset-0 opacity-10 rounded-lg"
                      style={{
                        background: `radial-gradient(circle at center, ${colorInfo[c].color} 0%, transparent 70%)`,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Glow Intensity Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Power Output
              </label>
              <span 
                className="text-[11px] font-mono font-bold"
                style={{ color: colorInfo[colorMode].color }}
              >
                {(glowIntensity * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative h-6 flex items-center">
              <input
                type="range"
                min="0.3"
                max="2"
                step="0.1"
                value={glowIntensity}
                onChange={handleGlowChange}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, 
                    ${colorInfo[colorMode].color} 0%, 
                    ${colorInfo[colorMode].color} ${((glowIntensity - 0.3) / 1.7) * 100}%, 
                    rgba(255,255,255,0.1) ${((glowIntensity - 0.3) / 1.7) * 100}%, 
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
                  background: ${colorInfo[colorMode].color};
                  cursor: pointer;
                  box-shadow: 
                    0 0 0 2px rgba(0,0,0,0.8),
                    0 0 10px ${colorInfo[colorMode].color},
                    0 0 20px ${colorInfo[colorMode].color}80;
                  transition: transform 0.1s, box-shadow 0.2s;
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                  transform: scale(1.1);
                  box-shadow: 
                    0 0 0 2px rgba(0,0,0,0.8),
                    0 0 15px ${colorInfo[colorMode].color},
                    0 0 30px ${colorInfo[colorMode].color};
                }
                input[type="range"]::-moz-range-thumb {
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: ${colorInfo[colorMode].color};
                  cursor: pointer;
                  border: 2px solid rgba(0,0,0,0.8);
                  box-shadow: 0 0 10px ${colorInfo[colorMode].color};
                }
              `}</style>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <div className="text-center">
              <div 
                className="text-sm font-bold font-mono"
                style={{ color: colorInfo[colorMode].color }}
              >
                {reactorMode === 'authentic' ? '10' : reactorMode === 'cinematic' ? '150' : '8'}
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">
                {reactorMode === 'authentic' ? 'Coils' : reactorMode === 'cinematic' ? 'Particles' : 'Segments'}
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-sm font-bold font-mono"
                style={{ color: colorInfo[colorMode].color }}
              >
                3GJ/s
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Output</div>
            </div>
            <div className="text-center">
              <div 
                className="text-sm font-bold font-mono"
                style={{ color: colorInfo[colorMode].color }}
              >
                {reactorMode === 'authentic' ? 'MK I' : reactorMode === 'cinematic' ? 'v2.0' : 'v1.0'}
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Version</div>
            </div>
          </div>

          {/* Decorative corner accents */}
          <div 
            className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 rounded-tl-lg"
            style={{ borderColor: colorInfo[colorMode].color, opacity: 0.5 }}
          />
          <div 
            className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 rounded-tr-lg"
            style={{ borderColor: colorInfo[colorMode].color, opacity: 0.5 }}
          />
          <div 
            className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 rounded-bl-lg"
            style={{ borderColor: colorInfo[colorMode].color, opacity: 0.5 }}
          />
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 rounded-br-lg"
            style={{ borderColor: colorInfo[colorMode].color, opacity: 0.5 }}
          />
        </div>
      )}
    </div>
  );
};

export default JarvisArcReactor;
