/**
 * Real-Time Process List Component
 * 
 * Displays live process information with kill controls and auto-refresh
 */

import React, { useEffect, useState, useCallback } from 'react';
import { realtimeMetrics } from '../services/realtimeMetrics';
import { ProcessInfo, formatBytes, formatUptime } from '../services/coreOs';

interface RealtimeProcessListProps {
  maxProcesses?: number;
  autoRefresh?: boolean;
}

export const RealtimeProcessList: React.FC<RealtimeProcessListProps> = ({
  maxProcesses = 20,
  autoRefresh = true,
}) => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [sortBy, setSortBy] = useState<'cpu' | 'memory' | 'name' | 'pid'>('cpu');
  const [sortDesc, setSortDesc] = useState(true);
  const [filter, setFilter] = useState('');
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Start real-time metrics
  useEffect(() => {
    if (autoRefresh && !realtimeMetrics.isRunning()) {
      realtimeMetrics.start();
    }
  }, [autoRefresh]);

  // Subscribe to process updates
  useEffect(() => {
    const unsubscribe = realtimeMetrics.subscribe((data) => {
      if (data.type === 'metrics:update' && data.processes) {
        setProcesses(data.processes);
        setLastUpdate(new Date());
      }
    });

    return unsubscribe;
  }, []);

  // Sort and filter processes
  const sortedProcesses = useCallback(() => {
    let filtered = processes;
    
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filtered = processes.filter(p => 
        p.name.toLowerCase().includes(lowerFilter) ||
        p.pid.toString().includes(lowerFilter)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'cpu':
          comparison = a.cpu - b.cpu;
          break;
        case 'memory':
          comparison = a.memory - b.memory;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'pid':
          comparison = a.pid - b.pid;
          break;
      }
      return sortDesc ? -comparison : comparison;
    });

    return sorted.slice(0, maxProcesses);
  }, [processes, sortBy, sortDesc, filter, maxProcesses]);

  // Handle kill process
  const handleKill = async (pid: number, force: boolean = false) => {
    setKillingPid(pid);
    try {
      const success = await realtimeMetrics.killProcess(pid, force);
      if (!success) {
        alert(`Failed to kill process ${pid}. It may be a system process or already terminated.`);
      }
    } finally {
      setKillingPid(null);
    }
  };

  // Toggle sort
  const toggleSort = (column: 'cpu' | 'memory' | 'name' | 'pid') => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(true);
    }
  };

  const displayProcesses = sortedProcesses();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.title}>⚙️ Processes ({processes.length})</span>
          <span style={styles.timestamp}>
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
        
        <div style={styles.controls}>
          <input
            type="text"
            placeholder="Filter processes..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.filterInput}
          />
          <button
            onClick={() => realtimeMetrics.isRunning() ? realtimeMetrics.stop() : realtimeMetrics.start()}
            style={realtimeMetrics.isRunning() ? styles.stopBtn : styles.startBtn}
          >
            {realtimeMetrics.isRunning() ? '⏹️ Stop' : '▶️ Start'}
          </button>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th} onClick={() => toggleSort('pid')}>
                PID {sortBy === 'pid' && (sortDesc ? '▼' : '▲')}
              </th>
              <th style={styles.thName} onClick={() => toggleSort('name')}>
                Name {sortBy === 'name' && (sortDesc ? '▼' : '▲')}
              </th>
              <th style={styles.th}>
                Status
              </th>
              <th style={styles.th} onClick={() => toggleSort('cpu')}>
                CPU {sortBy === 'cpu' && (sortDesc ? '▼' : '▲')}
              </th>
              <th style={styles.th} onClick={() => toggleSort('memory')}>
                Memory {sortBy === 'memory' && (sortDesc ? '▼' : '▲')}
              </th>
              <th style={styles.th}>Uptime</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayProcesses.map((proc) => (
              <tr 
                key={proc.pid} 
                style={{
                  ...styles.tr,
                  backgroundColor: proc.pid < 1000 ? '#1a1a1a' : 'transparent',
                }}
              >
                <td style={styles.td}>{proc.pid}</td>
                <td style={styles.tdName} title={proc.command}>
                  {proc.name}
                </td>
                <td style={styles.td}>
                  <span style={getStatusStyle(proc.status)}>
                    {proc.status}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={styles.barContainer}>
                    <span style={styles.barValue}>{proc.cpu.toFixed(1)}%</span>
                    <div style={{
                      ...styles.bar,
                      width: `${Math.min(proc.cpu, 100)}%`,
                      backgroundColor: proc.cpu > 50 ? '#ff4444' : proc.cpu > 20 ? '#ffcc00' : '#00ff88',
                    }} />
                  </div>
                </td>
                <td style={styles.td}>{formatBytes(proc.memory)}</td>
                <td style={styles.td}>{formatUptime(proc.uptime || 0)}</td>
                <td style={styles.td}>
                  {proc.pid >= 10000 && ( // Only show kill for virtual processes
                    <button
                      onClick={() => handleKill(proc.pid)}
                      disabled={killingPid === proc.pid}
                      style={killingPid === proc.pid ? styles.killBtnDisabled : styles.killBtn}
                    >
                      {killingPid === proc.pid ? '...' : '✕'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {displayProcesses.length === 0 && (
          <div style={styles.emptyState}>
            {filter ? 'No processes match your filter.' : 'No processes running.'}
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <span style={styles.legend}>
          <span style={styles.legendItem}>🟢 Running</span>
          <span style={styles.legendItem}>⚪ Sleeping</span>
          <span style={styles.legendItem}>🔴 Stopped</span>
          <span style={styles.legendItem}>🟡 System (PID &lt; 1000)</span>
          <span style={styles.legendItem}>🟣 Virtual (PID ≥ 10000)</span>
        </span>
      </div>
    </div>
  );
};

const getStatusStyle = (status: string): React.CSSProperties => {
  switch (status) {
    case 'running':
      return { color: '#00ff88', fontSize: '11px' };
    case 'sleeping':
      return { color: '#888', fontSize: '11px' };
    case 'stopped':
      return { color: '#ff4444', fontSize: '11px' };
    default:
      return { color: '#ccc', fontSize: '11px' };
  }
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
    marginBottom: '15px',
  },
  titleRow: {
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
  timestamp: {
    color: '#666',
    fontSize: '11px',
  },
  controls: {
    display: 'flex',
    gap: '10px',
  },
  filterInput: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '6px 10px',
    color: '#fff',
    fontSize: '12px',
  },
  startBtn: {
    background: '#00ff88',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  stopBtn: {
    background: '#ff4444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  tableContainer: {
    overflowX: 'auto',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '1px solid #333',
    color: '#00ff88',
    fontWeight: 'bold',
    cursor: 'pointer',
    userSelect: 'none',
    position: 'sticky',
    top: 0,
    background: '#111',
  },
  thName: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '1px solid #333',
    color: '#00ff88',
    fontWeight: 'bold',
    cursor: 'pointer',
    userSelect: 'none',
    width: '30%',
    position: 'sticky',
    top: 0,
    background: '#111',
  },
  tr: {
    borderBottom: '1px solid #222',
  },
  td: {
    padding: '8px 10px',
    color: '#ccc',
  },
  tdName: {
    padding: '8px 10px',
    color: '#fff',
    fontWeight: 'bold',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  barContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '80px',
  },
  barValue: {
    color: '#ccc',
    fontSize: '11px',
    minWidth: '40px',
  },
  bar: {
    height: '6px',
    borderRadius: '3px',
    minWidth: '30px',
  },
  killBtn: {
    background: '#ff4444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  killBtnDisabled: {
    background: '#333',
    color: '#666',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'not-allowed',
    fontSize: '12px',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #222',
  },
  legend: {
    display: 'flex',
    gap: '15px',
    flexWrap: 'wrap',
    fontSize: '11px',
  },
  legendItem: {
    color: '#888',
  },
};

export default RealtimeProcessList;
