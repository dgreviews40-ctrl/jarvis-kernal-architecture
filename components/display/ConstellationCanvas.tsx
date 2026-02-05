import React, { useEffect, useRef } from 'react';
import { ProcessorState, VoiceState } from '../../types';

export interface ConstellationProps {
  state: ProcessorState;
  voiceState: VoiceState;
}

export const ConstellationCanvas: React.FC<ConstellationProps> = ({ state, voiceState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activityRef = useRef({
     isActive: false,
     energy: 1.0
  });

  useEffect(() => {
     const active =
        state === ProcessorState.EXECUTING ||
        state === ProcessorState.ANALYZING ||
        state === ProcessorState.ROUTING ||
        voiceState === VoiceState.SPEAKING ||
        voiceState === VoiceState.LISTENING ||
        voiceState === VoiceState.PROCESSING;

     activityRef.current.isActive = active;
  }, [state, voiceState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const PARTICLE_COUNT = 140;
    const CONNECTION_DIST = 180;
    const BASE_SPEED = 0.4;
    const ACTIVE_SPEED_MULT = 3.0;

    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    const signals: { fromIdx: number; toIdx: number; progress: number; speed: number }[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * BASE_SPEED,
            vy: (Math.random() - 0.5) * BASE_SPEED
        });
    }

    let animationFrame: number;

    const render = () => {
        const { isActive } = activityRef.current;
        const currentSpeedMult = isActive ? ACTIVE_SPEED_MULT : 1.0;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        particles.forEach(p => {
            p.x += p.vx * currentSpeedMult;
            p.y += p.vy * currentSpeedMult;
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
        });

        ctx.lineWidth = 1;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            for (let j = i + 1; j < PARTICLE_COUNT; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONNECTION_DIST) {
                    const opacity = 1 - (dist / CONNECTION_DIST);
                    ctx.strokeStyle = `rgba(6, 182, 212, ${opacity * 0.4})`;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();

                    const spawnChance = isActive ? 0.005 : 0.0002;
                    if (Math.random() < spawnChance) {
                        signals.push({
                            fromIdx: i,
                            toIdx: j,
                            progress: 0,
                            speed: 0.02 + Math.random() * 0.04
                        });
                    }
                }
            }
        }

        for (let i = signals.length - 1; i >= 0; i--) {
            const sig = signals[i];
            sig.progress += sig.speed * (isActive ? 1.5 : 1);
            if (sig.progress >= 1) {
                signals.splice(i, 1);
                continue;
            }
            const p1 = particles[sig.fromIdx];
            const p2 = particles[sig.toIdx];
            const sx = p1.x + (p2.x - p1.x) * sig.progress;
            const sy = p1.y + (p2.y - p1.y) * sig.progress;
            const glowSize = isActive ? 5 : 3;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = isActive ? 'rgba(34, 211, 238, 0.8)' : 'rgba(6, 182, 212, 0.4)';
            ctx.beginPath();
            ctx.arc(sx, sy, glowSize, 0, Math.PI * 2);
            ctx.fill();
        }

        particles.forEach(p => {
             ctx.fillStyle = isActive ? '#22d3ee' : '#0891b2';
             ctx.beginPath();
             ctx.arc(p.x, p.y, isActive ? 2.5 : 2, 0, Math.PI * 2);
             ctx.fill();
        });

        animationFrame = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
        if (!canvas) return;
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(animationFrame);
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default ConstellationCanvas;
