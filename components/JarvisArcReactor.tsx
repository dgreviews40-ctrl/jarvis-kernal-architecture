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
}

export const JarvisArcReactor: React.FC<JarvisArcReactorProps> = ({
  audioStream,
  width = 400,
  height = 400,
  glowIntensity = 1.2,
  rotationSpeed = 1.0,
  enhanced = false,
  colorMode = 'classic',
  showControls = true,
  particleCount = 150,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactorRef = useRef<ArcReactorClass | CinematicArcReactor | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // State for enhanced mode controls
  const [currentGlow, setCurrentGlow] = useState(glowIntensity);
  const [currentColorMode, setCurrentColorMode] = useState(colorMode);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [fps, setFps] = useState(60);

  const colorModes = [
    { id: 'classic', name: 'Classic', color: '#00ddff', desc: 'Blue' },
    { id: 'warm', name: 'Warm', color: '#ffaa00', desc: 'Orange' },
    { id: 'cyberpunk', name: 'Neon', color: '#ff00ff', desc: 'Pink' }
  ] as const;

  // Initialize reactor
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clean up existing canvas
    const existingCanvas = containerRef.current.querySelector('canvas');
    if (existingCanvas) {
      containerRef.current.removeChild(existingCanvas);
    }

    console.log(`[JarvisArcReactor] Creating ${enhanced ? 'CINEMATIC' : 'CLASSIC'} reactor...`);

    let reactor: ArcReactorClass | CinematicArcReactor;

    if (enhanced) {
      // Use cinematic version
      const colorShift = colorModes.findIndex(m => m.id === currentColorMode);
      reactor = new CinematicArcReactor(containerRef.current, {
        glowIntensity: currentGlow,
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

    return () => {
      console.log('[JarvisArcReactor] Cleaning up...');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (containerRef.current) {
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) {
          containerRef.current.removeChild(canvas);
        }
      }
      if ('destroy' in reactor) {
        reactor.destroy();
      }
      reactorRef.current = null;
    };
  }, [enhanced]); // Recreate when enhanced mode changes

  // Handle audio stream changes
  useEffect(() => {
    if (!audioStream || !reactorRef.current) return;

    reactorRef.current.initAudio(audioStream).then(() => {
      setIsAudioActive(true);
    }).catch(console.error);
  }, [audioStream]);

  // Control handlers (enhanced mode only)
  const handleGlowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCurrentGlow(value);
  }, []);

  const handleColorChange = useCallback((mode: typeof colorMode) => {
    setCurrentColorMode(mode);
    // Would need to recreate reactor to apply color change
    // Or implement dynamic color update in the reactor class
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
            zIndex: 10,
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
              ⚡ Arc Reactor v2.0
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isAudioActive && (
                <span style={{ 
                  color: '#00ff88', 
                  fontSize: '9px',
                  animation: 'pulse 1s infinite'
                }}>● AUDIO</span>
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
                  padding: '8px 6px',
                  border: `1px solid ${currentColorMode === mode.id ? mode.color : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: '6px',
                  background: currentColorMode === mode.id ? `${mode.color}25` : 'rgba(255,255,255,0.03)',
                  color: currentColorMode === mode.id ? mode.color : '#888',
                  fontSize: '9px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{mode.name}</span>
                <span style={{ opacity: 0.6, fontSize: '8px' }}>{mode.desc}</span>
              </button>
            ))}
          </div>

          {/* Glow intensity slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: '#888', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Glow Intensity</span>
              <span style={{ color: '#00aaff', fontWeight: 'bold' }}>{Math.round(currentGlow * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={currentGlow}
              onChange={handleGlowChange}
              style={{
                width: '100%',
                height: '4px',
                background: 'linear-gradient(90deg, rgba(0,170,255,0.2), rgba(0,170,255,0.6))',
                borderRadius: '2px',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
              }}
            />
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
              <div style={{ color: '#00aaff', fontWeight: 'bold', fontSize: '11px' }}>24</div>
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
              bottom: enhanced && showControls ? '180px' : '15px',
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
