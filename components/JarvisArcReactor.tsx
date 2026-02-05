/**
 * JarvisArcReactor - React Wrapper
 * Uses the jarvis-arc-reactor package
 */

import React, { useEffect, useRef } from 'react';
import { JarvisArcReactor as ArcReactorClass } from './jarvis-arc-reactor';

interface JarvisArcReactorProps {
  audioStream?: MediaStream | null;
  width?: number;
  height?: number;
  glowIntensity?: number;
  rotationSpeed?: number;
}

export const JarvisArcReactor: React.FC<JarvisArcReactorProps> = ({
  audioStream,
  width = 400,
  height = 400,
  glowIntensity = 1.2,
  rotationSpeed = 1.0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactorRef = useRef<ArcReactorClass | null>(null);
  const animationRef = useRef<number | null>(null);

  // Main initialization effect
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Always clean up any existing canvas first (handles React StrictMode)
    const existingCanvas = containerRef.current.querySelector('canvas');
    if (existingCanvas) {
      containerRef.current.removeChild(existingCanvas);
    }

    console.log('[JarvisArcReactor] Creating reactor instance SMALL CORE v3...');
    
    // Create reactor instance
    const reactor = new ArcReactorClass(containerRef.current);
    reactorRef.current = reactor;
    
    // If audioStream is already provided, initialize audio now
    if (audioStream) {
      console.log('[JarvisArcReactor] Audio stream available at creation, initializing...');
      reactor.initAudio(audioStream).then(() => {
        console.log('[JarvisArcReactor] Audio initialized');
      }).catch(err => {
        console.error('[JarvisArcReactor] Audio init failed:', err);
      });
    }

    // Animation loop
    const animate = () => {
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
      reactorRef.current = null;
    };
  }, []); // Run once on mount

  // Handle audio stream changes
  useEffect(() => {
    if (!audioStream || !reactorRef.current) {
      console.log('[JarvisArcReactor] Audio effect - stream:', !!audioStream, 'reactor:', !!reactorRef.current);
      return;
    }

    console.log('[JarvisArcReactor] Audio stream changed, initializing...');
    reactorRef.current.initAudio(audioStream).then(() => {
      console.log('[JarvisArcReactor] Audio initialized from stream change');
    }).catch(console.error);
  }, [audioStream]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        background: 'transparent',
        position: 'relative',
        overflow: 'visible'
      }}
    />
  );
};

export default JarvisArcReactor;
