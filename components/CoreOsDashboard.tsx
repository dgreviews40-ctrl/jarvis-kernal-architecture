/**
 * CoreOsDashboard - Real-time System Monitoring Dashboard
 * Displays core.os v1.2.0 metrics, alerts, and controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import { coreOs } from '../services/coreOs';
import { coreOsIntegration } from '../services/coreOsIntegration';

// Types
interface DashboardData {
  metrics: ReturnType<typeof coreOs.getSystemMetrics>;
  battery: Awaited<ReturnType<typeof coreOs.getBatteryInfo>>;
  network: ReturnType<typeof coreOs.getNetworkInfo>;
  storage: Awaited<ReturnType<typeof coreOs.getStorageInfo>>;
  performance: ReturnType<typeof coreOs.getPerformanceMetrics>;
  analysis: Awaited<ReturnType<typeof coreOs.getPredictiveAnalysis>> | null;
  health: ReturnType<typeof coreOs.getPluginHealth>;
  alerts: ReturnType<typeof coreOs.getActiveAlerts>;
  isMonitoring: boolean;
}

// Utility functions
const formatBytes = coreOs.formatBytes;
const formatUptime = coreOs.formatUptime;

export const CoreOsDashboard: React.FC = () => {
  // State
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [diagnosticReport, setDiagnosticReport] = useState<string>('');

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const displayData = await coreOsIntegration.getDisplayData();
      setData(displayData);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  // Listen for alerts
  useEffect(() => {
    const handleAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('core.os Alert:', customEvent.detail);
      fetchData(); // Refresh on alert
    };

    window.addEventListener('coreos-alert', handleAlert);
    return () => window.removeEventListener('coreos-alert', handleAlert);
  }, [fetchData]);

  // Run diagnostics
  const runDiagnostics = async () => {
    const report = await coreOs.runDiagnostics();
    setDiagnosticReport(report);
  };

  // Toggle monitoring
  const toggleMonitoring = () => {
    if (coreOs.isMonitoring()) {
      coreOs.stopMonitoring();
    } else {
      coreOs.startMonitoring(5000);
    }
    fetchData();
  };

  // Speak status
  const speakStatus = () => {
    coreOsIntegration.speakStatus();
  };

  // Acknowledge alert
  const acknowledgeAlert = (alertId: string) => {
    coreOs.acknowledgeAlert(alertId);
    fetchData();
  };

  // Get health color
  const getHealthColor = (score: number) => {
    if (score >= 90) return '#00ff88';
    if (score >= 70) return '#ffcc00';
    if (score >= 50) return '#ff8800';
    return '#ff4444';
  };

  // Get pressure color
  const getPressureColor = (pressure: string) => {
    switch (pressure) {
      case 'nominal': return '#00ff88';
      case 'fair': return '#ffcc00';
      case 'serious': return '#ff8800';
      case 'critical': return '#ff4444';
      default: return '#888';
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading system data...</div>;
  }

  if (error) {
    return <div style={styles.container}>Error: {error}</div>;
  }

  if (!data) {
    return <div style={styles.container}>No data available</div>;
  }

  const { metrics, battery, network, storage, performance, analysis, health, alerts, isMonitoring } = data;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🔧 System Core v1.2.0</h1>
        <div style={styles.headerRight}>
          <span style={styles.timestamp}>Updated: {lastUpdate.toLocaleTimeString()}</span>
          <button onClick={fetchData} style={styles.refreshBtn}>🔄</button>
        </div>
      </div>

      {/* Health Score */}
      {analysis && (
        <div style={styles.healthCard}>
          <div style={styles.healthScore}>
            <span style={{ ...styles.scoreNumber, color: getHealthColor(analysis.healthScore) }}>
              {analysis.healthScore}
            </span>
            <span style={styles.scoreLabel}>/ 100 Health Score</span>
          </div>
          <div style={styles.healthTrend}>
            <div>Memory Trend: <span style={{ color: analysis.memoryTrend === 'increasing' ? '#ff4444' : analysis.memoryTrend === 'decreasing' ? '#00ff88' : '#ffcc00' }}>{analysis.memoryTrend}</span></div>
            {analysis.batteryTimeRemaining && (
              <div>Battery Time: {formatUptime(analysis.batteryTimeRemaining)}</div>
            )}
          </div>
          {analysis.recommendedAction && (
            <div style={styles.recommendation}>💡 {analysis.recommendedAction}</div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div style={styles.grid}>
        {/* Memory Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>💾 Memory</h3>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Heap Used:</span>
            <span style={styles.metricValue}>{formatBytes(metrics.memory.heapUsed)}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Heap Total:</span>
            <span style={styles.metricValue}>{formatBytes(metrics.memory.heapTotal)}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>RSS:</span>
            <span style={styles.metricValue}>{formatBytes(metrics.memory.rss)}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>External:</span>
            <span style={styles.metricValue}>{formatBytes(metrics.memory.external)}</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: `${(metrics.memory.heapUsed / metrics.memory.heapTotal) * 100}%`,
              background: getPressureColor(performance.supported ? performance.memoryPressure : 'nominal')
            }} />
          </div>
        </div>

        {/* CPU Card */}
        {metrics.cpu.supported && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🖥️ CPU</h3>
            <div style={styles.metric}>
              <span style={styles.metricLabel}>Usage:</span>
              <span style={styles.metricValue}>{metrics.cpu.usagePercent}%</span>
            </div>
            <div style={styles.metric}>
              <span style={styles.metricLabel}>Load Avg:</span>
              <span style={styles.metricValue}>{metrics.cpu.loadAvg.map(v => v.toFixed(2)).join(', ')}</span>
            </div>
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${Math.min(metrics.cpu.usagePercent, 100)}%`,
                background: metrics.cpu.usagePercent > 80 ? '#ff4444' : metrics.cpu.usagePercent > 50 ? '#ffcc00' : '#00ff88'
              }} />
            </div>
          </div>
        )}

        {/* Battery Card */}
        <div style={{ ...styles.card, opacity: battery.supported ? 1 : 0.5 }}>
          <h3 style={styles.cardTitle}>🔋 Battery {battery.charging ? '⚡' : ''}</h3>
          {battery.supported ? (
            <>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Level:</span>
                <span style={{ ...styles.metricValue, color: battery.level < 20 ? '#ff4444' : '#00ff88' }}>
                  {battery.level.toFixed(0)}%
                </span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Status:</span>
                <span style={styles.metricValue}>{battery.charging ? 'Charging' : 'Discharging'}</span>
              </div>
              {battery.dischargingTime !== Infinity && (
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Time Rem:</span>
                  <span style={styles.metricValue}>{formatUptime(battery.dischargingTime)}</span>
                </div>
              )}
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressFill,
                  width: `${battery.level}%`,
                  background: battery.level < 20 ? '#ff4444' : battery.level < 50 ? '#ffcc00' : '#00ff88'
                }} />
              </div>
            </>
          ) : (
            <div style={styles.notAvailable}>Battery API not available</div>
          )}
        </div>

        {/* Network Card */}
        <div style={{ ...styles.card, opacity: network.supported ? 1 : 0.5 }}>
          <h3 style={styles.cardTitle}>🌐 Network {network.online ? '🟢' : '🔴'}</h3>
          {network.supported ? (
            <>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Type:</span>
                <span style={styles.metricValue}>{network.effectiveType}</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Downlink:</span>
                <span style={styles.metricValue}>{network.downlink} Mbps</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Latency:</span>
                <span style={styles.metricValue}>{network.rtt} ms</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Save Data:</span>
                <span style={styles.metricValue}>{network.saveData ? 'ON' : 'OFF'}</span>
              </div>
            </>
          ) : (
            <div style={styles.notAvailable}>Network API not available</div>
          )}
        </div>

        {/* Storage Card */}
        <div style={{ ...styles.card, opacity: storage.supported ? 1 : 0.5 }}>
          <h3 style={styles.cardTitle}>💿 Storage</h3>
          {storage.supported ? (
            <>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Used:</span>
                <span style={styles.metricValue}>{formatBytes(storage.usage)}</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Available:</span>
                <span style={styles.metricValue}>{formatBytes(storage.available)}</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Total:</span>
                <span style={styles.metricValue}>{formatBytes(storage.quota)}</span>
              </div>
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressFill,
                  width: `${storage.percentUsed}%`,
                  background: storage.percentUsed > 90 ? '#ff4444' : storage.percentUsed > 70 ? '#ffcc00' : '#00ff88'
                }} />
              </div>
            </>
          ) : (
            <div style={styles.notAvailable}>Storage API not available</div>
          )}
        </div>

        {/* Performance Card */}
        <div style={{ ...styles.card, opacity: performance.supported ? 1 : 0.5 }}>
          <h3 style={styles.cardTitle}>⚡ Performance</h3>
          {performance.supported ? (
            <>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Memory Pressure:</span>
                <span style={{ ...styles.metricValue, color: getPressureColor(performance.memoryPressure) }}>
                  {performance.memoryPressure}
                </span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Latency:</span>
                <span style={styles.metricValue}>{performance.latency.toFixed(0)} ms</span>
              </div>
            </>
          ) : (
            <div style={styles.notAvailable}>Performance API not available</div>
          )}
        </div>

        {/* Plugins Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🔌 Plugins</h3>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Active:</span>
            <span style={{ ...styles.metricValue, color: '#00ff88' }}>{health.active}/{health.total} ✅</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Disabled:</span>
            <span style={styles.metricValue}>{health.disabled} ⚠️</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Errors:</span>
            <span style={{ ...styles.metricValue, color: health.error > 0 ? '#ff4444' : '#00ff88' }}>{health.error} ❌</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Paused:</span>
            <span style={styles.metricValue}>{health.paused} ⏸️</span>
          </div>
        </div>

        {/* System Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚙️ System</h3>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Uptime:</span>
            <span style={styles.metricValue}>{formatUptime(metrics.uptime)}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Monitoring:</span>
            <span style={{ ...styles.metricValue, color: isMonitoring ? '#00ff88' : '#ff4444' }}>
              {isMonitoring ? 'Active 🟢' : 'Inactive 🔴'}
            </span>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div style={styles.alertsSection}>
          <h3 style={styles.sectionTitle}>🚨 Active Alerts ({alerts.length})</h3>
          {alerts.map(alert => (
            <div key={alert.id} style={{ ...styles.alert, borderLeftColor: alert.type === 'critical' ? '#ff4444' : alert.type === 'warning' ? '#ffcc00' : '#00ff88' }}>
              <div style={styles.alertContent}>
                <span style={styles.alertIcon}>{alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'}</span>
                <span style={styles.alertMessage}>{alert.message}</span>
              </div>
              <button onClick={() => acknowledgeAlert(alert.id)} style={styles.ackBtn}>Acknowledge</button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button onClick={runDiagnostics} style={styles.actionBtn}>🔍 Run Diagnostics</button>
        <button onClick={toggleMonitoring} style={styles.actionBtn}>
          {isMonitoring ? '⏹️ Stop Monitoring' : '▶️ Start Monitoring'}
        </button>
        <button onClick={speakStatus} style={styles.actionBtn}>🔊 Speak Status</button>
      </div>

      {/* Diagnostic Report */}
      {diagnosticReport && (
        <div style={styles.reportSection}>
          <h3 style={styles.sectionTitle}>📊 Diagnostic Report</h3>
          <pre style={styles.report}>{diagnosticReport}</pre>
          <button onClick={() => setDiagnosticReport('')} style={styles.closeBtn}>Close</button>
        </div>
      )}
    </div>
  );
};

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    background: '#0a0a0a',
    color: '#00ff88',
    padding: '20px',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid #00ff88',
    paddingBottom: '10px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    textShadow: '0 0 10px #00ff88',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  timestamp: {
    color: '#888',
    fontSize: '12px',
  },
  refreshBtn: {
    background: '#00ff88',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  healthCard: {
    background: '#111',
    border: '1px solid #00ff88',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
    flexWrap: 'wrap',
  },
  healthScore: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
  },
  scoreNumber: {
    fontSize: '48px',
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: '14px',
    color: '#888',
  },
  healthTrend: {
    flex: 1,
    fontSize: '14px',
    color: '#ccc',
  },
  recommendation: {
    background: '#1a1a1a',
    padding: '10px 15px',
    borderRadius: '4px',
    borderLeft: '3px solid #ffcc00',
    color: '#ffcc00',
    maxWidth: '400px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '15px',
    marginBottom: '20px',
  },
  card: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '15px',
  },
  cardTitle: {
    margin: '0 0 15px 0',
    fontSize: '14px',
    color: '#00ff88',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  metric: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '13px',
  },
  metricLabel: {
    color: '#888',
  },
  metricValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
  progressBar: {
    height: '6px',
    background: '#333',
    borderRadius: '3px',
    marginTop: '10px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  notAvailable: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: '12px',
    textAlign: 'center',
    padding: '20px',
  },
  alertsSection: {
    background: '#111',
    border: '1px solid #ff4444',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '20px',
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    color: '#ff4444',
  },
  alert: {
    background: '#1a1a1a',
    borderLeft: '3px solid',
    padding: '12px',
    marginBottom: '10px',
    borderRadius: '0 4px 4px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  alertIcon: {
    fontSize: '16px',
  },
  alertMessage: {
    color: '#fff',
    fontSize: '13px',
  },
  ackBtn: {
    background: '#333',
    border: '1px solid #666',
    color: '#fff',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  actionBtn: {
    background: '#00ff88',
    color: '#000',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  reportSection: {
    background: '#111',
    border: '1px solid #00ff88',
    borderRadius: '8px',
    padding: '15px',
  },
  report: {
    background: '#000',
    padding: '15px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
    lineHeight: 1.4,
    color: '#0f0',
    fontFamily: 'Courier New, monospace',
    maxHeight: '400px',
  },
  closeBtn: {
    background: '#333',
    border: '1px solid #666',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '10px',
  },
};

export default CoreOsDashboard;
