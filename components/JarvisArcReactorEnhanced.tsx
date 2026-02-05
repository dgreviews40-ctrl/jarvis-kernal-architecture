/**
 * JarvisArcReactorEnhanced - Cinematic React Wrapper
 * Enhanced visuals with color modes, glow control, and UI overlay
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CinematicArcReactor } from './jarvis-arc-reactor';

interface JarvisArcReactorEnhancedProps {
  audioStream?: MediaStream | null;
  width?: number;
  height?: number;
  glowIntensity?: number;
  colorMode?: 'classic' | 'warm' | 'cyberpunk';
  showControls?: boolean;
  particleCount?: number;
  className?: string;
}

export const JarvisArcReactorEnhanced: React.FC<JarvisArcReactorEnhancedProps> = ({
  audioStream,
  width = 500,
  height = 500,
  glowIntensity = 1.0,
  colorMode = 'classic',
  showControls = true,
  particleCount = 150,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactorRef = useRef<CinematicArcReactor | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Local state for controls
  const [currentGlow, setCurrentGlow] = useState(glowIntensity);
  const [currentColorMode, setCurrentColorMode] = useState(colorMode);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [fps, setFps] = useState(60);

  // Color mode options
  const colorModes = [
    { id: 'classic', name: 'Classic Blue', color: '#00ddff' },
    { id: 'warm', name: 'Warm Orange', color: '#ffaa00' },
    { id: 'cyberpunk', name: 'Cyberpunk', color: '#ff00ff' }
  ] as const;

  // Initialize reactor
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up existing canvas
    const existingCanvas = containerRef.current.querySelector('canvas');
    if (existingCanvas) {
      containerRef.current.removeChild(existingCanvas);
    }

    console.log('[JarvisArcReactorEnhanced] Creating cinematic reactor...');

    const colorShift = colorModes.findIndex(m => m.id === currentColorMode);
    
    const reactor = new CinematicArcReactor(containerRef.current, {
      glowIntensity: currentGlow,
      colorShift: colorShift >= 0 ? colorShift : 0,
      particleCount
    });
    
    reactorRef.current = reactor;

    // Initialize audio if stream provided
    if (audioStream) {
      reactor.initAudio(audioStream).then(() => {
        setIsAudioActive(true);
        console.log('[JarvisArcReactorEnhanced] Audio initialized');
      }).catch(err => {
        console.error('[JarvisArcReactorEnhanced] Audio init failed:', err);
      });
    }

    // Animation loop with FPS tracking
    let lastTime = performance.now();
    let frames = 0;
    let lastFpsTime = lastTime;

    const animate = () => {
      const now = performance.now();
      frames++;
      
      // Update FPS every 500ms
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
      console.log('[JarvisArcReactorEnhanced] Cleaning up...');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (reactorRef.current) {
        reactorRef.current.destroy();
      }
      reactorRef.current = null;
    };
  }, []); // Only run once on mount

  // Handle prop changes
  useEffect(() => {
    if (!reactorRef.current) return;
    
    // Update glow intensity
    setCurrentGlow(glowIntensity);
    // Note: Real-time glow updates would require modifying the reactor's uniforms
    // For now, the reactor uses the initial value
  }, [glowIntensity]);

  useEffect(() => {
    if (!reactorRef.current) return;
    setCurrentColorMode(colorMode);
  }, [colorMode]);

  // Handle audio stream changes
  useEffect(() => {
    if (!audioStream || !reactorRef.current) return;

    reactorRef.current.initAudio(audioStream).then(() => {
      setIsAudioActive(true);
    }).catch(console.error);
  }, [audioStream]);

  const handleGlowChange = useCallback((value: number) => {
    setCurrentGlow(value);
    // Apply to reactor if method exists
    if (reactorRef.current && 'setGlowIntensity' in reactorRef.current) {
      (reactorRef.current as any).setGlowIntensity(value);
    }
  }, []);

  const handleColorChange = useCallback((mode: typeof colorMode) => {
    setCurrentColorMode(mode);
    // Note: Color mode changes would require recreating the reactor
    // or implementing a dynamic color update method
  }, []);

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

      {/* Control overlay */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 10, 30, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 170, 255, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minWidth: '200px',
            boxShadow: '0 4px 20px rgba(0, 170, 255, 0.2)',
          }}
        >
          {/* Header with status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#00aaff', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Arc Reactor v2.0
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isAudioActive && (
                <span style={{ color: '#00ff88', fontSize: '9px' }}>● AUDIO</span>
              )}
              <span style={{ color: '#666', fontSize: '9px' }}>{fps} FPS</span>
            </div>
          </div>

          {/* Color mode selector */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {colorModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleColorChange(mode.id as typeof colorMode)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  border: `1px solid ${currentColorMode === mode.id ? mode.color : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: '6px',
                  background: currentColorMode === mode.id ? `${mode.color}30` : 'rgba(255,255,255,0.05)',
                  color: currentColorMode === mode.id ? mode.color : '#aaa',
                  fontSize: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                }}
              >
                {mode.name}
              </button>
            ))}
          </div>

          {/* Glow intensity slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: '#888', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Glow Intensity</span>
              <span style={{ color: '#00aaff' }}>{Math.round(currentGlow * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={currentGlow}
              onChange={(e) => handleGlowChange(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: '4px',
                background: 'rgba(0,170,255,0.2)',
                borderRadius: '2px',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* Stats display */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              fontSize: '9px',
              color: '#666',
              textAlign: 'center',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div>
              <div style={{ color: '#00aaff' }}>{particleCount}</div>
              <div>PARTICLES</div>
            </div>
            <div>
              <div style={{ color: '#00aaff' }}>10</div>
              <div>COILS</div>
            </div>
            <div>
              <div style={{ color: '#00aaff' }}>24</div>
              <div>SEGMENTS</div>
            </div>
          </div>
        </div>
      )}

      {/* Corner accents */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderTop: '2px solid rgba(0, 170, 255, 0.3)',
          borderRight: '2px solid rgba(0, 170, 255, 0.3)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          width: '40px',
          height: '40px',
          borderBottom: '2px solid rgba(0, 170, 255, 0.3)',
          borderLeft: '2px solid rgba(0, 170, 255, 0.3)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default JarvisArcReactorEnhanced;
