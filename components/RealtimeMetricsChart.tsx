/**
 * Real-Time Metrics Chart Component
 * 
 * Displays live CPU and Memory usage charts with real-time updates
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { realtimeMetrics, MetricsDataPoint } from '../services/realtimeMetrics';
import { formatBytes } from '../services/coreOs';

interface RealtimeMetricsChartProps {
  height?: number;
  showCpu?: boolean;
  showMemory?: boolean;
}

export const RealtimeMetricsChart: React.FC<RealtimeMetricsChartProps> = ({
  height = 200,
  showCpu = true,
  showMemory = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<MetricsDataPoint[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);

  // Start real-time metrics
  useEffect(() => {
    if (!realtimeMetrics.isRunning()) {
      realtimeMetrics.start();
    }
    setIsRunning(realtimeMetrics.isRunning());

    return () => {
      // Don't stop on unmount - other components might need it
    };
  }, []);

  // Subscribe to metrics updates
  useEffect(() => {
    const unsubscribe = realtimeMetrics.subscribe((data) => {
      if (data.type === 'metrics:update' && data.history) {
        setHistory(data.history);
      }
    });

    return unsubscribe;
  }, []);

  // Draw chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const chartHeight = canvas.height;
    const padding = { top: 10, right: 10, bottom: 30, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartInnerHeight = chartHeight - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, chartHeight);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, chartHeight);

    // Grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartInnerHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    if (history.length < 2) return;

    // Find max values for scaling
    const maxMemory = Math.max(...history.map(d => d.heapTotal)) * 1.1;
    const maxCpu = 100;

    // Draw Memory line (heap used)
    if (showMemory) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();

      history.forEach((point, index) => {
        const x = padding.left + (index / (history.length - 1)) * chartWidth;
        const y = padding.top + chartInnerHeight - (point.heapUsed / maxMemory) * chartInnerHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Fill area under line
      ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
      ctx.lineTo(padding.left + chartWidth, padding.top + chartInnerHeight);
      ctx.lineTo(padding.left, padding.top + chartInnerHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Draw CPU line
    if (showCpu) {
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 2;
      ctx.beginPath();

      history.forEach((point, index) => {
        const x = padding.left + (index / (history.length - 1)) * chartWidth;
        const y = padding.top + chartInnerHeight - (point.cpuUsage / maxCpu) * chartInnerHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Draw axes labels
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    // Y-axis labels (Memory)
    if (showMemory) {
      for (let i = 0; i <= 4; i++) {
        const value = (maxMemory / 4) * (4 - i);
        const y = padding.top + (chartInnerHeight / 4) * i;
        ctx.fillText(formatBytes(value).padStart(8), padding.left - 5, y + 3);
      }
    }

    // Y-axis labels (CPU) - on right side
    if (showCpu) {
      ctx.textAlign = 'left';
      for (let i = 0; i <= 4; i++) {
        const value = 100 - (100 / 4) * i;
        const y = padding.top + (chartInnerHeight / 4) * i;
        ctx.fillText(`${value.toFixed(0)}%`, width - padding.right + 5, y + 3);
      }
    }

    // Legend
    let legendX = padding.left;
    const legendY = chartHeight - 15;

    if (showMemory) {
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'left';
      ctx.fillText('Memory', legendX + 16, legendY + 10);
      legendX += 70;
    }

    if (showCpu) {
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'left';
      ctx.fillText('CPU', legendX + 16, legendY + 10);
    }

    // Current values display
    const latest = history[history.length - 1];
    if (latest) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px monospace';
      
      let infoX = width - padding.right;
      
      if (showCpu) {
        ctx.fillStyle = '#ff8800';
        ctx.fillText(`CPU: ${latest.cpuUsage.toFixed(1)}%`, infoX, 20);
        infoX -= 80;
      }
      
      if (showMemory) {
        ctx.fillStyle = '#00ff88';
        ctx.fillText(`Mem: ${formatBytes(latest.heapUsed)}`, infoX, 20);
      }
    }
  }, [history, showCpu, showMemory]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawChart();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawChart]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>📊 Real-Time Metrics</span>
        <span style={isRunning ? styles.statusActive : styles.statusInactive}>
          {isRunning ? '● Live' : '○ Stopped'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        style={styles.canvas}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '15px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  title: {
    color: '#00ff88',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  statusActive: {
    color: '#00ff88',
    fontSize: '12px',
  },
  statusInactive: {
    color: '#666',
    fontSize: '12px',
  },
  canvas: {
    width: '100%',
    height: 'auto',
    maxHeight: '200px',
    background: '#0a0a0a',
    borderRadius: '4px',
  },
};

export default RealtimeMetricsChart;
