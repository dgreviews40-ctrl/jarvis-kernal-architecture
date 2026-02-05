/**
 * JarvisArcReactor - React Wrapper
 * Supports both classic (v7) and cinematic (v2.0) versions
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { JarvisArcReactor as ArcReactorClass, CinematicArcReactor } from './jarvis-arc-reactor';

interface JarvisArcReactorProps {
  audioStream?: MediaStream | null;
  width?: number;
  height?: number;
  glowIntensity?: number;
  rotationSpeed?: number;
  /** Enable enhanced cinematic mode with more effects */
  enhanced?: boolean;
  /** Color mode for enhanced version */
  colorMode?: 'classic' | 'warm' | 'cyberpunk';
  /** Show control panel in enhanced mode */
  showControls?: boolean;
  /** Number of particles in enhanced mode */
  particleCount?: number;
  className?: string;
  /** Callback when glow intensity changes */
  onGlowChange?: (value: number) => void;
  /** Callback when color mode changes */
  onColorChange?: (mode: 'classic' | 'warm' | 'cyberpunk') => void;
}

export const JarvisArcReactor: React.FC<JarvisArcReactorProps> = ({
  audioStream,
  width = 400,
  height = 400,
  glowIntensity: initialGlow = 1.2,
  enhanced = false,
  colorMode: initialColorMode = 'classic',
  showControls = true,
  particleCount = 150,
  className = '',
  onGlowChange,
  onColorChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactorRef = useRef<ArcReactorClass | CinematicArcReactor | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Local state for adjustable controls
  const [glowIntensity, setGlowIntensity] = useState(initialGlow);
  const [colorMode, setColorMode] = useState(initialColorMode);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [fps, setFps] = useState(60);

  const colorModes = [
    { id: 'classic' as const, name: 'Classic', color: '#00ddff', desc: 'Blue' },
    { id: 'warm' as const, name: 'Warm', color: '#ffaa00', desc: 'Orange' },
    { id: 'cyberpunk' as const, name: 'Neon', color: '#ff00ff', desc: 'Pink' }
  ];

  // Sync with props when they change externally
  useEffect(() => {
    setGlowIntensity(initialGlow);
  }, [initialGlow]);

  useEffect(() => {
    setColorMode(initialColorMode);
  }, [initialColorMode]);

  // Main initialization effect - recreates when mode or key props change
  useEffect(() => {
    if (!containerRef.current) return;

    console.log(`[JarvisArcReactor] ${enhanced ? 'CINEMATIC' : 'CLASSIC'} mode initializing...`);

    // Clean up existing reactor first
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (reactorRef.current && 'destroy' in reactorRef.current) {
      reactorRef.current.destroy();
    }
    
    // Remove existing canvas
    const existingCanvas = containerRef.current.querySelector('canvas');
    if (existingCanvas && containerRef.current.contains(existingCanvas)) {
      containerRef.current.removeChild(existingCanvas);
    }

    let reactor: ArcReactorClass | CinematicArcReactor;

    if (enhanced) {
      // Use cinematic version
      const colorShift = colorModes.findIndex(m => m.id === colorMode);
      reactor = new CinematicArcReactor(containerRef.current, {
        glowIntensity,
        colorShift: colorShift >= 0 ? colorShift : 0,
        particleCount,
        enablePostProcessing: true
      });
    } else {
      // Use classic version
      reactor = new ArcReactorClass(containerRef.current);
    }
    
    reactorRef.current = reactor;

    // Initialize audio if stream provided
    if (audioStream) {
      reactor.initAudio(audioStream).then(() => {
        setIsAudioActive(true);
        console.log('[JarvisArcReactor] Audio initialized');
      }).catch(err => {
        console.error('[JarvisArcReactor] Audio init failed:', err);
      });
    }

    // Animation loop with FPS tracking for enhanced mode
    let lastTime = performance.now();
    let frames = 0;
    let lastFpsTime = lastTime;

    const animate = () => {
      if (enhanced) {
        const now = performance.now();
        frames++;
        
        if (now - lastFpsTime >= 500) {
          setFps(Math.round(frames * 2));
          frames = 0;
          lastFpsTime = now;
        }
      }

      reactor.update();
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup function
    return () => {
      console.log('[JarvisArcReactor] Cleaning up...');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if ('destroy' in reactor) {
        reactor.destroy();
      }
      reactorRef.current = null;
    };
  }, [enhanced, colorMode, glowIntensity, particleCount]); // Recreate when these change

  // Handle audio stream changes separately
  useEffect(() => {
    if (!audioStream || !reactorRef.current) return;

    reactorRef.current.initAudio(audioStream).then(() => {
      setIsAudioActive(true);
    }).catch(console.error);
  }, [audioStream]);

  // Handlers for controls
  const handleGlowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    console.log('[ArcReactor] Glow change:', newValue);
    setGlowIntensity(newValue);
    onGlowChange?.(newValue);
  }, [onGlowChange]);

  const handleColorChange = useCallback((newMode: 'classic' | 'warm' | 'cyberpunk') => {
    console.log('[ArcReactor] Color mode change:', newMode);
    setColorMode(newMode);
    onColorChange?.(newMode);
  }, [onColorChange]);

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

      {/* Enhanced Mode Controls */}
      {enhanced && showControls && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 10, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 170, 255, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minWidth: '220px',
            boxShadow: '0 4px 30px rgba(0, 170, 255, 0.25)',
            zIndex: 100,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ 
              color: '#00aaff', 
              fontSize: '11px', 
              fontWeight: 'bold', 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              textShadow: '0 0 10px rgba(0,170,255,0.5)'
            }}>
              ⚡ CINEMATIC v2.0
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isAudioActive && (
                <span style={{ 
                  color: '#00ff88', 
                  fontSize: '9px',
                }}>● AUDIO</span>
              )}
              <span style={{ color: '#666', fontSize: '9px' }}>{fps} FPS</span>
            </div>
          </div>

          {/* Color mode selector - CLICKABLE */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {colorModes.map((mode) => (
              <button
                key={mode.id}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[ArcReactor] Color change:', mode.id);
                  handleColorChange(mode.id);
                }}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  border: `1px solid ${colorMode === mode.id ? mode.color : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: '6px',
                  background: colorMode === mode.id ? `${mode.color}25` : 'rgba(255,255,255,0.03)',
                  color: colorMode === mode.id ? mode.color : '#888',
                  fontSize: '9px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontWeight: 'bold', pointerEvents: 'none' }}>{mode.name}</span>
                <span style={{ opacity: 0.6, fontSize: '8px', pointerEvents: 'none' }}>{mode.desc}</span>
              </button>
            ))}
          </div>

          {/* Glow intensity slider - ADJUSTABLE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#888', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Glow Intensity</span>
              <span style={{ color: '#00aaff', fontWeight: 'bold' }}>{Math.round(glowIntensity * 100)}%</span>
            </label>
            <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={glowIntensity}
                onChange={handleGlowChange}
                className="arc-reactor-slider"
                style={{
                  width: '100%',
                  height: '6px',
                  background: `linear-gradient(to right, #00aaff 0%, #00aaff ${(glowIntensity / 2) * 100}%, rgba(255,255,255,0.1) ${(glowIntensity / 2) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  borderRadius: '3px',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  margin: 0,
                }}
              />
            </div>
            <style>{`
              .arc-reactor-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                background: #00aaff;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 0 10px rgba(0, 170, 255, 0.5);
                border: 2px solid #fff;
              }
              .arc-reactor-slider::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: #00aaff;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 0 10px rgba(0, 170, 255, 0.5);
                border: 2px solid #fff;
              }
            `}</style>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              fontSize: '9px',
              color: '#666',
              textAlign: 'center',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div>
              <div style={{ color: '#00aaff', fontWeight: 'bold', fontSize: '11px' }}>{particleCount}</div>
              <div style={{ fontSize: '8px', textTransform: 'uppercase' }}>Particles</div>
            </div>
            <div>
              <div style={{ color: '#00aaff', fontWeight: 'bold', fontSize: '11px' }}>10</div>
              <div style={{ fontSize: '8px', textTransform: 'uppercase' }}>Coils</div>
            </div>
            <div>
              <div style={{ color: '#00aaff', fontWeight: 'bold', fontSize: '11px' }}>36</div>
              <div style={{ fontSize: '8px', textTransform: 'uppercase' }}>Segments</div>
            </div>
          </div>
        </div>
      )}

      {/* Tech corner accents (enhanced mode only) */}
      {enhanced && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              width: '30px',
              height: '30px',
              borderTop: '2px solid rgba(0, 170, 255, 0.4)',
              borderRight: '2px solid rgba(0, 170, 255, 0.4)',
              borderRadius: '0 8px 0 0',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: enhanced && showControls ? '200px' : '15px',
              left: '15px',
              width: '30px',
              height: '30px',
              borderBottom: '2px solid rgba(0, 170, 255, 0.4)',
              borderLeft: '2px solid rgba(0, 170, 255, 0.4)',
              borderRadius: '0 0 0 8px',
              pointerEvents: 'none',
              transition: 'bottom 0.3s ease',
            }}
          />
        </>
      )}

      {/* Simple label for classic mode */}
      {!enhanced && (
        <div
          style={{
            position: 'absolute',
            bottom: '5px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(0, 170, 255, 0.6)',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}
        >
          Arc Reactor
        </div>
      )}
    </div>
  );
};

export default JarvisArcReactor;
