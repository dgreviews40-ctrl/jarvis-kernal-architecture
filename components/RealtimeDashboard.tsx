/**
 * Real-Time System Dashboard
 * 
 * Combines real-time metrics chart, process list, and alert panel
 * into a unified dashboard with live updates
 * 
 * Features:
 * - Live CPU/Memory charts
 * - Real-time process monitoring with kill controls
 * - System alert panel with acknowledgment
 * - Auto-refreshing metrics
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { RealtimeMetricsChart } from './RealtimeMetricsChart';
import { RealtimeProcessList } from './RealtimeProcessList';
import { RealtimeAlertPanel } from './RealtimeAlertPanel';
import { realtimeMetrics } from '../services/realtimeMetrics';
import { hardware } from '../services/hardware';
import { 
  getProcessStats, 
  getProcessList,
  ProcessStats, 
  formatBytes,
  generateTestActivity
} from '../services/coreOs';

interface RealtimeDashboardProps {
  onClose?: () => void;
}

interface StatsSummary {
  totalProcesses: number;
  runningProcesses: number;
  totalCpu: number;
  totalMemory: number;
  topCpuProcess: string;
  topMemoryProcess: string;
}

export const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({ onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'processes' | 'alerts'>('overview');
  const [updateInterval, setUpdateInterval] = useState(2000);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const [rawProcessCount, setRawProcessCount] = useState(0);
  
  // Hardware metrics for real CPU data
  const [hardwareMetrics, setHardwareMetrics] = useState<{ cpuLoad: number; memoryUsage: number; gpuTemperature: number; cpuTemperature?: number } | null>(null);
  const [hardwareConnected, setHardwareConnected] = useState(false);

  // Start/stop metrics service
  useEffect(() => {
    const running = realtimeMetrics.isRunning();
    setDebugInfo(`Service running: ${running}`);
    console.log('[RealtimeDashboard] Mounting, metrics running:', running);
    
    if (!running) {
      try {
        realtimeMetrics.start(updateInterval);
        setDebugInfo('Service started successfully');
        console.log('[RealtimeDashboard] Started metrics service');
      } catch (e) {
        setDebugInfo(`Start error: ${e}`);
        console.error('[RealtimeDashboard] Failed to start:', e);
      }
    }
    setIsRunning(realtimeMetrics.isRunning());

    return () => {
      // Don't stop on unmount - other components might need it
    };
  }, [updateInterval]);

  // Subscribe to metrics updates for summary stats
  useEffect(() => {
    console.log('[RealtimeDashboard] Subscribing to metrics...');
    setDebugInfo(prev => prev + ' | Subscribing...');
    
    const unsubscribe = realtimeMetrics.subscribe(async (data) => {
      console.log('[RealtimeDashboard] Received event:', data.type);
      setDebugInfo(`Last event: ${data.type} at ${new Date().toLocaleTimeString()}`);
      
      if (data.type === 'metrics:update') {
        setIsRunning(true);
        setRawProcessCount(data.processes?.length || 0);
        
        // Fetch additional stats
        const processStats = await getProcessStats();
        
        // Find top processes
        const topCpu = data.processes.reduce((max: any, p: any) => p.cpu > max.cpu ? p : max, data.processes[0]);
        const topMem = data.processes.reduce((max: any, p: any) => p.memory > max.memory ? p : max, data.processes[0]);
        
        setStats({
          totalProcesses: processStats.total,
          runningProcesses: processStats.running,
          totalCpu: processStats.totalCpu,
          totalMemory: processStats.totalMemory,
          topCpuProcess: topCpu?.name || 'N/A',
          topMemoryProcess: topMem?.name || 'N/A',
        });
      }
    });

    return unsubscribe;
  }, []);

  // Subscribe to hardware metrics for real CPU data
  useEffect(() => {
    console.log('[RealtimeDashboard] Subscribing to hardware metrics...');
    setHardwareConnected(hardware.isBackendConnected());
    
    const unsubscribe = hardware.subscribe((metrics) => {
      setHardwareMetrics({
        cpuLoad: metrics.cpuLoad,
        memoryUsage: metrics.memoryUsage,
        gpuTemperature: metrics.gpuTemperature,
        cpuTemperature: metrics.cpuTemperature
      });
      // Mark as connected if we receive data
      if (metrics.cpuLoad > 0 || metrics.memoryUsage > 0) {
        setHardwareConnected(true);
      }
    });

    return unsubscribe;
  }, []);

  const toggleMonitoring = () => {
    if (realtimeMetrics.isRunning()) {
      realtimeMetrics.stop();
      setIsRunning(false);
    } else {
      realtimeMetrics.start(updateInterval);
      setIsRunning(true);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.titleRow}>
            {onClose && (
              <button onClick={onClose} style={styles.backBtn} title="Back to Dashboard">
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 style={styles.title}>[RT] Real-Time System Dashboard</h1>
          </div>
          <div style={styles.subtitle}>
            <span style={isRunning ? styles.statusActive : styles.statusInactive}>
              {isRunning ? '[LIVE]' : '[STOPPED]'}
            </span>
            <span style={styles.separator}>|</span>
            <span style={styles.version}>core.os v1.2.1</span>
          </div>
        </div>
        
        <div style={styles.headerRight}>
          {/* Update Interval Selector */}
          <select
            value={updateInterval}
            onChange={(e) => setUpdateInterval(Number(e.target.value))}
            style={styles.select}
            disabled={isRunning}
          >
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
          </select>
          
          <button
            onClick={toggleMonitoring}
            style={isRunning ? styles.stopBtn : styles.startBtn}
          >
            {isRunning ? '[STOP]' : '[START]'}
          </button>
          
          <button
            onClick={() => generateTestActivity(3)}
            style={styles.testBtn}
            title="Generate test processes"
          >
            [TEST]
          </button>
          
          <button
            onClick={async () => {
              const processes = await getProcessList();
              setRawProcessCount(processes.length);
              setDebugInfo(`Manual check: ${processes.length} processes found`);
              console.log('[RealtimeDashboard] Manual check:', processes);
            }}
            style={styles.refreshBtn}
            title="Manual refresh"
          >
            [REFRESH]
          </button>
        </div>
      </div>

      {/* Debug Info */}
      <div style={{ padding: '10px 20px', background: '#1a1a1a', borderBottom: '1px solid #333', fontSize: '11px', color: '#888' }}>
        <div>Debug: {debugInfo}</div>
        <div>Raw processes: {rawProcessCount} | Service: {isRunning ? 'Running' : 'Stopped'} | Hardware: {hardwareConnected ? 'Connected' : 'Not Connected'}</div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.totalProcesses}</span>
            <span style={styles.statLabel}>Processes</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.runningProcesses}</span>
            <span style={styles.statLabel}>Running</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>
              {hardwareMetrics ? `${hardwareMetrics.cpuLoad.toFixed(0)}%` : `${stats.totalCpu.toFixed(1)}%`}
            </span>
            <span style={styles.statLabel}>{hardwareMetrics ? 'Real CPU' : 'Total CPU'}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>
              {hardwareMetrics ? `${hardwareMetrics.memoryUsage.toFixed(0)}%` : formatBytes(stats.totalMemory)}
            </span>
            <span style={styles.statLabel}>{hardwareMetrics ? 'System RAM' : 'Total Memory'}</span>
          </div>
          {hardwareMetrics && hardwareMetrics.gpuTemperature > 0 && (
            <div style={styles.statItem}>
              <span style={styles.statValue}>{hardwareMetrics.gpuTemperature.toFixed(0)}°C</span>
              <span style={styles.statLabel}>GPU Temp</span>
            </div>
          )}
          {hardwareMetrics && hardwareMetrics.cpuTemperature && hardwareMetrics.cpuTemperature > 0 && (
            <div style={styles.statItem}>
              <span style={styles.statValue}>{hardwareMetrics.cpuTemperature.toFixed(0)}°C</span>
              <span style={styles.statLabel}>CPU Temp</span>
            </div>
          )}
          <div style={styles.statItem}>
            <span style={styles.statValue} title={stats.topCpuProcess}>
              {stats.topCpuProcess.length > 12 
                ? stats.topCpuProcess.substring(0, 12) + '...' 
                : stats.topCpuProcess}
            </span>
            <span style={styles.statLabel}>Top Process</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('overview')}
          style={activeTab === 'overview' ? styles.tabActive : styles.tab}
        >
          [OVERVIEW]
        </button>
        <button
          onClick={() => setActiveTab('processes')}
          style={activeTab === 'processes' ? styles.tabActive : styles.tab}
        >
          [PROCESSES]
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          style={activeTab === 'alerts' ? styles.tabActive : styles.tab}
        >
          [ALERTS]
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.content}>
        {activeTab === 'overview' && (
          <div style={styles.overviewGrid}>
            <div style={styles.chartSection}>
              <RealtimeMetricsChart height={250} showCpu showMemory />
            </div>
            <div style={styles.alertsSection}>
              <RealtimeAlertPanel maxAlerts={5} />
            </div>
            <div style={styles.processesSection}>
              <RealtimeProcessList maxProcesses={10} />
            </div>
          </div>
        )}

        {activeTab === 'processes' && (
          <div style={styles.processesTabContainer}>
            <RealtimeProcessList maxProcesses={50} fullHeight />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={styles.alertsTabContainer}>
            <RealtimeAlertPanel maxAlerts={50} showAcknowledged fullHeight />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          Real-Time Metrics Service • Updates every {updateInterval/1000}s • 
          Data retention: 2 minutes • 
          Hardware Monitor: {hardwareConnected ? '[CONNECTED]' : '[NOT CONNECTED - Run: node server/hardware-monitor.cjs]'}
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0a0a0a',
    color: '#00ff88',
    minHeight: '100vh',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    gap: '15px',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
    background: '#00ff88',
    border: '2px solid #00ff88',
    borderRadius: '8px',
    padding: '10px',
    color: '#000',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    textShadow: '0 0 10px rgba(0, 255, 136, 0.3)',
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
  },
  statusActive: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  statusInactive: {
    color: '#666',
  },
  separator: {
    color: '#333',
  },
  version: {
    color: '#666',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  select: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  startBtn: {
    background: '#00ff88',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  stopBtn: {
    background: '#ff4444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  testBtn: {
    background: '#4488ff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  refreshBtn: {
    background: '#ffaa44',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '15px 20px',
    background: '#111',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    gap: '20px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: '11px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  tabs: {
    display: 'flex',
    gap: '2px',
    padding: '0 20px',
    background: '#111',
    borderBottom: '1px solid #333',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '12px 20px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: '#0a0a0a',
    border: 'none',
    borderBottom: '2px solid #00ff88',
    padding: '12px 20px',
    color: '#00ff88',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: '20px',
    overflow: 'auto',
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gridTemplateRows: 'auto auto',
    gap: '20px',
  },
  chartSection: {
    gridColumn: '1 / 2',
    gridRow: '1 / 2',
  },
  alertsSection: {
    gridColumn: '2 / 3',
    gridRow: '1 / 3',
    overflow: 'auto',
    maxHeight: 'calc(100vh - 250px)', // Limit height in overview mode
  },
  processesSection: {
    gridColumn: '1 / 2',
    gridRow: '2 / 3',
    overflow: 'auto',
    maxHeight: 'calc(100vh - 250px)', // Limit height in overview mode
  },
  alertsTabContainer: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  processesTabContainer: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  footer: {
    padding: '15px 20px',
    borderTop: '1px solid #333',
    textAlign: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: '12px',
  },
};

export default RealtimeDashboard;
