/**
 * Real-Time Alert Panel Component
 * 
 * Displays live system alerts with acknowledgment controls
 */

import React, { useEffect, useState, useCallback } from 'react';
import { realtimeMetrics } from '../services/realtimeMetrics';
import { SystemAlert } from '../services/coreOs';

interface RealtimeAlertPanelProps {
  maxAlerts?: number;
  showAcknowledged?: boolean;
  fullHeight?: boolean; // When true, fill available space with scrolling
}

export const RealtimeAlertPanel: React.FC<RealtimeAlertPanelProps> = ({
  maxAlerts = 10,
  showAcknowledged = false,
  fullHeight = false,
}) => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Start real-time metrics
  useEffect(() => {
    if (!realtimeMetrics.isRunning()) {
      realtimeMetrics.start();
    }
  }, []);

  // Subscribe to alert updates
  useEffect(() => {
    const unsubscribe = realtimeMetrics.subscribe((data) => {
      if (data.type === 'metrics:update' && data.alerts) {
        setAlerts(data.alerts);
        setLastUpdate(new Date());
        
        // Trigger pulse animation on new critical alerts
        const hasCritical = data.alerts.some((a: SystemAlert) => 
          a.type === 'critical' && !acknowledgedAlerts.has(a.id)
        );
        if (hasCritical) {
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 2000);
        }
      }
    });

    return unsubscribe;
  }, [acknowledgedAlerts]);

  // Handle acknowledge
  const handleAcknowledge = useCallback(async (alertId: string) => {
    setAcknowledgedAlerts(prev => new Set(prev).add(alertId));
    await realtimeMetrics.ackAlert(alertId);
  }, []);

  // Handle acknowledge all
  const handleAcknowledgeAll = useCallback(async () => {
    const activeAlerts = alerts.filter(a => !a.acknowledged);
    for (const alert of activeAlerts) {
      await handleAcknowledge(alert.id);
    }
  }, [alerts, handleAcknowledge]);

  // Filter and sort alerts
  const displayAlerts = alerts
    .filter(a => showAcknowledged || !a.acknowledged)
    .sort((a, b) => {
      // Sort by severity: critical > warning > info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.type] - severityOrder[b.type];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by timestamp (newest first)
      return b.timestamp - a.timestamp;
    })
    .slice(0, maxAlerts);

  const activeCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.type === 'critical' && !a.acknowledged).length;
  const warningCount = alerts.filter(a => a.type === 'warning' && !a.acknowledged).length;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return '[CRIT]';
      case 'warning': return '[WARN]';
      case 'info': return '[INFO]';
      default: return '[NOTE]';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return '#ff4444';
      case 'warning': return '#ffcc00';
      case 'info': return '#00ccff';
      default: return '#888';
    }
  };

  if (displayAlerts.length === 0) {
    return (
      <div style={fullHeight ? styles.containerFull : styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>[!] System Alerts</span>
          <span style={styles.badgeInactive}>0</span>
        </div>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>[OK]</span>
          <p>No active alerts</p>
          <p style={styles.emptySubtext}>System is operating normally</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...(fullHeight ? styles.containerFull : styles.container),
      borderColor: criticalCount > 0 ? '#ff4444' : warningCount > 0 ? '#ffcc00' : '#00ff88',
      animation: pulseAnimation ? 'pulse 0.5s ease-in-out 3' : undefined,
    }}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.title}>[!] System Alerts</span>
          <div style={styles.badges}>
            {criticalCount > 0 && (
              <span style={styles.badgeCritical}>{criticalCount}</span>
            )}
            {warningCount > 0 && (
              <span style={styles.badgeWarning}>{warningCount}</span>
            )}
            {activeCount === 0 && (
              <span style={styles.badgeInactive}>0</span>
            )}
          </div>
        </div>
        <span style={styles.timestamp}>
          Updated: {lastUpdate.toLocaleTimeString()}
        </span>
      </div>

      {activeCount > 0 && (
        <div style={styles.actions}>
          <button onClick={handleAcknowledgeAll} style={styles.ackAllBtn}>
            [OK] Acknowledge All ({activeCount})
          </button>
        </div>
      )}

      <div style={fullHeight ? styles.alertListFull : styles.alertList}>
        {displayAlerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              ...styles.alert,
              borderLeftColor: getAlertColor(alert.type),
              opacity: alert.acknowledged ? 0.5 : 1,
            }}
          >
            <div 
              style={styles.alertHeader}
              onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
            >
              <span style={styles.alertIcon}>{getAlertIcon(alert.type)}</span>
              <div style={styles.alertContent}>
                <span style={styles.alertMessage}>{alert.message}</span>
                <span style={styles.alertTime}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                  {alert.acknowledged && ' • Acknowledged'}
                </span>
              </div>
              <div style={styles.alertActions}>
                {!alert.acknowledged && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcknowledge(alert.id);
                    }}
                    style={styles.ackBtn}
                    title="Acknowledge"
                  >
                    [OK]
                  </button>
                )}
                <span style={styles.expandIcon}>
                  {expandedAlert === alert.id ? '▼' : '▶'}
                </span>
              </div>
            </div>
            
            {expandedAlert === alert.id && (
              <div style={styles.alertDetails}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Alert ID:</span>
                  <span style={styles.detailValue}>{alert.id}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Severity:</span>
                  <span style={{ ...styles.detailValue, color: getAlertColor(alert.type) }}>
                    {alert.type.toUpperCase()}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Timestamp:</span>
                  <span style={styles.detailValue}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                {alert.id && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Alert ID:</span>
                    <span style={styles.detailValue}>{alert.id.substring(0, 8)}...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {displayAlerts.length < alerts.length && (
        <div style={styles.moreAlerts}>
          +{alerts.length - displayAlerts.length} more alerts
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#111',
    border: '2px solid',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '15px',
    transition: 'border-color 0.3s ease',
  },
  containerFull: {
    background: '#111',
    border: '2px solid',
    borderRadius: '8px',
    padding: '15px',
    transition: 'border-color 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    color: '#ff4444',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  badges: {
    display: 'flex',
    gap: '5px',
  },
  badgeCritical: {
    background: '#ff4444',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '10px',
    minWidth: '20px',
    textAlign: 'center',
  },
  badgeWarning: {
    background: '#ffcc00',
    color: '#000',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '10px',
    minWidth: '20px',
    textAlign: 'center',
  },
  badgeInactive: {
    background: '#333',
    color: '#888',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '10px',
    minWidth: '20px',
    textAlign: 'center',
  },
  timestamp: {
    color: '#666',
    fontSize: '11px',
  },
  actions: {
    marginBottom: '15px',
  },
  ackAllBtn: {
    background: '#333',
    color: '#00ff88',
    border: '1px solid #00ff88',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    width: '100%',
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  alertListFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    overflowY: 'auto',
    minHeight: 0, // Important for flex child scrolling
  },
  alert: {
    background: '#1a1a1a',
    borderLeft: '3px solid',
    borderRadius: '4px',
    overflow: 'hidden',
    transition: 'opacity 0.2s ease',
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    cursor: 'pointer',
  },
  alertIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  alertContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  alertMessage: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  alertTime: {
    color: '#666',
    fontSize: '10px',
  },
  alertActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  ackBtn: {
    background: '#00ff88',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    width: '24px',
    height: '24px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    color: '#666',
    fontSize: '10px',
  },
  alertDetails: {
    padding: '10px 12px',
    paddingTop: 0,
    borderTop: '1px solid #333',
    background: '#0a0a0a',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '11px',
  },
  detailLabel: {
    color: '#666',
  },
  detailValue: {
    color: '#ccc',
    fontFamily: 'monospace',
  },
  moreAlerts: {
    textAlign: 'center',
    padding: '10px',
    color: '#666',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#00ff88',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '10px',
  },
  emptySubtext: {
    color: '#666',
    fontSize: '12px',
    marginTop: '5px',
  },
};

export default RealtimeAlertPanel;
