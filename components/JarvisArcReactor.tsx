/**
 * JarvisArcReactor - React Wrapper
 * Supports both classic (v7) and cinematic (v2.0) versions
 */

import React, { useEffect, useRef, useState } from 'react';
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
  enhanced = false,
  colorMode = 'classic',
  showControls = true,
  particleCount = 150,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactorRef = useRef<ArcReactorClass | CinematicArcReactor | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Use props directly for display, no local state management needed
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [fps, setFps] = useState(60);

  const colorModes = [
    { id: 'classic', name: 'Classic', color: '#00ddff', desc: 'Blue' },
    { id: 'warm', name: 'Warm', color: '#ffaa00', desc: 'Orange' },
    { id: 'cyberpunk', name: 'Neon', color: '#ff00ff', desc: 'Pink' }
  ] as const;

  // Main initialization effect - recreates when mode changes
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

          {/* Color mode selector */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {colorModes.map((mode) => (
              <div
                key={mode.id}
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
                  cursor: 'default',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{mode.name}</span>
                <span style={{ opacity: 0.6, fontSize: '8px' }}>{mode.desc}</span>
              </div>
            ))}
          </div>

          {/* Glow intensity display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: '#888', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Glow Intensity</span>
              <span style={{ color: '#00aaff', fontWeight: 'bold' }}>{Math.round(glowIntensity * 100)}%</span>
            </label>
            <div
              style={{
                width: '100%',
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(glowIntensity * 50, 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #00aaff, #00ff88)',
                  borderRadius: '2px',
                }}
              />
            </div>
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
