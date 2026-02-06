/**
 * core.os v1.2.0 - System Core Service
 * Enhanced with real-time system metrics, hardware monitoring, and predictive analytics
 */

import { registry } from './registry';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SystemMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    usagePercent: number;
    loadAvg: number[];
    supported: boolean;
  };
  uptime: number;
  timestamp: number;
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  supported: boolean;
}

export interface NetworkInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  supported: boolean;
  online: boolean;
}

export interface StorageInfo {
  quota: number;
  usage: number;
  available: number;
  percentUsed: number;
  supported: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  latency: number;
  memoryPressure: 'nominal' | 'fair' | 'serious' | 'critical';
  supported: boolean;
}

export interface PluginHealth {
  total: number;
  active: number;
  disabled: number;
  error: number;
  paused: number;
  details: Array<{
    id: string;
    name: string;
    status: string;
    version: string;
  }>;
}

export interface SystemAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// ============================================================================
// PROCESS MANAGEMENT INTERFACES (v1.2.1)
// ============================================================================

export interface ProcessInfo {
  pid: number;
  name: string;
  status: 'running' | 'sleeping' | 'stopped' | 'zombie' | 'unknown';
  cpu: number; // CPU usage percentage
  memory: number; // Memory in bytes
  ppid?: number; // Parent process ID
  command?: string; // Command line
  uptime: number; // Process uptime in seconds
  timestamp: number; // When info was collected
}

export interface ProcessFilter {
  status?: ProcessInfo['status'];
  minCpu?: number;
  minMemory?: number;
  namePattern?: string;
}

export interface ProcessKillResult {
  success: boolean;
  pid: number;
  message: string;
}

export interface ProcessStats {
  total: number;
  running: number;
  sleeping: number;
  stopped: number;
  totalCpu: number;
  totalMemory: number;
}

export interface ProcessManagement {
  processes: ProcessInfo[];
  stats: ProcessStats;
  timestamp: number;
}

export interface PredictiveAnalysis {
  batteryTimeRemaining: number | null;
  memoryTrend: 'increasing' | 'stable' | 'decreasing';
  recommendedAction: string | null;
  healthScore: number; // 0-100
}

// ============================================================================
// v1.1.0 FUNCTIONS (Enhanced)
// ============================================================================

/**
 * Get real-time system memory, CPU, and process metrics
 */
export function getSystemMetrics(): SystemMetrics {
  const memUsage = process.memoryUsage();
  
  // Calculate memory pressure
  const memoryPressure = calculateMemoryPressure(memUsage.heapUsed, memUsage.heapTotal);
  
  return {
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
    },
    cpu: {
      usagePercent: getCPUUsage(),
      loadAvg: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
      supported: process.platform !== 'win32',
    },
    uptime: process.uptime(),
    timestamp: Date.now(),
  };
}

/**
 * Get battery status (async - requires browser API)
 */
export async function getBatteryInfo(): Promise<BatteryInfo> {
  if (typeof navigator === 'undefined' || !('getBattery' in navigator)) {
    return {
      level: 0,
      charging: false,
      chargingTime: Infinity,
      dischargingTime: Infinity,
      supported: false,
    };
  }

  try {
    const battery = await (navigator as any).getBattery();
    return {
      level: battery.level * 100,
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
      supported: true,
    };
  } catch (e) {
    return {
      level: 0,
      charging: false,
      chargingTime: Infinity,
      dischargingTime: Infinity,
      supported: false,
    };
  }
}

/**
 * Get network connection info (v1.2.0: Added online status)
 */
export function getNetworkInfo(): NetworkInfo {
  const conn = (navigator as any).connection;
  if (!conn) {
    return {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
      supported: false,
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };
  }

  return {
    effectiveType: conn.effectiveType || 'unknown',
    downlink: conn.downlink || 0,
    rtt: conn.rtt || 0,
    saveData: conn.saveData || false,
    supported: true,
    online: navigator.onLine,
  };
}

/**
 * Get comprehensive plugin health status
 */
export function getPluginHealth(): PluginHealth {
  const plugins = registry.getAll();
  return {
    total: plugins.length,
    active: plugins.filter(p => p.status === 'ACTIVE').length,
    disabled: plugins.filter(p => p.status === 'DISABLED').length,
    error: plugins.filter(p => p.status === 'ERROR').length,
    paused: plugins.filter(p => p.status === 'PAUSED_DEPENDENCY').length,
    details: plugins.map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      status: p.status,
      version: p.manifest.version,
    })),
  };
}

// ============================================================================
// v1.2.0 NEW FUNCTIONS
// ============================================================================

/**
 * Get storage quota and usage information
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return {
      quota: 0,
      usage: 0,
      available: 0,
      percentUsed: 0,
      supported: false,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || 0;
    const usage = estimate.usage || 0;
    
    return {
      quota,
      usage,
      available: quota - usage,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
      supported: true,
    };
  } catch (e) {
    return {
      quota: 0,
      usage: 0,
      available: 0,
      percentUsed: 0,
      supported: false,
    };
  }
}

/**
 * Get performance metrics (FPS, latency, memory pressure)
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  // Check if Performance Memory API is available
  const perfMemory = (performance as any).memory;
  
  if (!perfMemory) {
    return {
      fps: 0,
      latency: 0,
      memoryPressure: 'nominal',
      supported: false,
    };
  }

  const used = perfMemory.usedJSHeapSize;
  const total = perfMemory.totalJSHeapSize;
  const limit = perfMemory.jsHeapSizeLimit;
  
  // Determine memory pressure
  let memoryPressure: 'nominal' | 'fair' | 'serious' | 'critical' = 'nominal';
  const usageRatio = used / limit;
  
  if (usageRatio > 0.9) memoryPressure = 'critical';
  else if (usageRatio > 0.7) memoryPressure = 'serious';
  else if (usageRatio > 0.5) memoryPressure = 'fair';

  return {
    fps: getEstimatedFPS(),
    latency: performance.now(),
    memoryPressure,
    supported: true,
  };
}

/**
 * Calculate memory pressure level
 */
function calculateMemoryPressure(used: number, total: number): 'nominal' | 'fair' | 'serious' | 'critical' {
  const ratio = used / total;
  if (ratio > 0.9) return 'critical';
  if (ratio > 0.7) return 'serious';
  if (ratio > 0.5) return 'fair';
  return 'nominal';
}

/**
 * Estimate current FPS (rough approximation)
 */
function getEstimatedFPS(): number {
  // This is a simplified estimation
  // In a real implementation, you'd measure frame times
  return 60; // Assume 60fps for now
}

/**
 * Get CPU usage percentage (Node.js only)
 */
function getCPUUsage(): number {
  if (process.platform === 'win32') {
    return 0; // Windows requires different approach
  }
  
  try {
    const os = require('os');
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return 100 - Math.floor(100 * totalIdle / totalTick);
  } catch {
    return 0;
  }
}

// ============================================================================
// PREDICTIVE ANALYTICS (v1.2.0)
// ============================================================================

// Store historical data for trend analysis
const metricsHistory: Array<{ timestamp: number; memory: number; battery?: number }> = [];
const MAX_HISTORY = 100;

/**
 * Record metrics for trend analysis
 */
export function recordMetrics(): void {
  const metrics = getSystemMetrics();
  
  metricsHistory.push({
    timestamp: Date.now(),
    memory: metrics.memory.heapUsed,
  });
  
  // Keep only recent history
  if (metricsHistory.length > MAX_HISTORY) {
    metricsHistory.shift();
  }
}

/**
 * Get predictive analysis based on historical data
 */
export async function getPredictiveAnalysis(): Promise<PredictiveAnalysis> {
  const battery = await getBatteryInfo();
  const metrics = getSystemMetrics();
  
  // Calculate battery time remaining
  let batteryTimeRemaining: number | null = null;
  if (battery.supported && !battery.charging && battery.dischargingTime !== Infinity) {
    batteryTimeRemaining = battery.dischargingTime;
  }
  
  // Calculate memory trend
  const memoryTrend = calculateMemoryTrend();
  
  // Calculate health score (0-100)
  const healthScore = calculateHealthScore(metrics, battery);
  
  // Generate recommended action
  const recommendedAction = generateRecommendation(metrics, battery, healthScore);
  
  return {
    batteryTimeRemaining,
    memoryTrend,
    recommendedAction,
    healthScore,
  };
}

/**
 * Calculate memory usage trend
 */
function calculateMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
  if (metricsHistory.length < 10) return 'stable';
  
  const recent = metricsHistory.slice(-10);
  const first = recent[0].memory;
  const last = recent[recent.length - 1].memory;
  const change = (last - first) / first;
  
  if (change > 0.1) return 'increasing';
  if (change < -0.1) return 'decreasing';
  return 'stable';
}

/**
 * Calculate overall system health score
 */
function calculateHealthScore(metrics: SystemMetrics, battery: BatteryInfo): number {
  let score = 100;
  
  // Memory penalty (0-40 points)
  const memoryRatio = metrics.memory.heapUsed / metrics.memory.heapTotal;
  score -= Math.min(40, memoryRatio * 40);
  
  // Battery penalty (0-30 points)
  if (battery.supported && battery.level < 20) {
    score -= (20 - battery.level) * 1.5;
  }
  
  // Uptime penalty (0-20 points) - systems running long may need restart
  const uptimeHours = metrics.uptime / 3600;
  if (uptimeHours > 168) { // > 1 week
    score -= Math.min(20, (uptimeHours - 168) / 10);
  }
  
  return Math.max(0, Math.round(score));
}

/**
 * Generate system recommendations
 */
function generateRecommendation(
  metrics: SystemMetrics, 
  battery: BatteryInfo, 
  healthScore: number
): string | null {
  const recommendations: string[] = [];
  
  // Memory recommendations
  const memoryRatio = metrics.memory.heapUsed / metrics.memory.heapTotal;
  if (memoryRatio > 0.85) {
    recommendations.push('High memory usage detected. Consider restarting memory-intensive plugins.');
  }
  
  // Battery recommendations
  if (battery.supported && battery.level < 15 && !battery.charging) {
    recommendations.push('Critical battery level. Connect to power source immediately.');
  }
  
  // Health recommendations
  if (healthScore < 50) {
    recommendations.push('System health degraded. Recommended action: Restart JARVIS.');
  }
  
  return recommendations.length > 0 ? recommendations.join(' ') : null;
}

// ============================================================================
// ALERT SYSTEM (v1.2.0)
// ============================================================================

const activeAlerts: SystemAlert[] = [];
let alertIdCounter = 0;

/**
 * Check system conditions and generate alerts
 */
export async function checkSystemAlerts(): Promise<SystemAlert[]> {
  const metrics = getSystemMetrics();
  const battery = await getBatteryInfo();
  const storage = await getStorageInfo();
  
  // Check memory
  const memoryRatio = metrics.memory.heapUsed / metrics.memory.heapTotal;
  if (memoryRatio > 0.9) {
    createAlert('critical', `Critical memory usage: ${(memoryRatio * 100).toFixed(1)}%`);
  } else if (memoryRatio > 0.75) {
    createAlert('warning', `High memory usage: ${(memoryRatio * 100).toFixed(1)}%`);
  }
  
  // Check battery
  if (battery.supported && battery.level < 10 && !battery.charging) {
    createAlert('critical', `Critical battery level: ${battery.level.toFixed(0)}%`);
  }
  
  // Check storage
  if (storage.supported && storage.percentUsed > 90) {
    createAlert('warning', `Storage almost full: ${storage.percentUsed.toFixed(1)}% used`);
  }
  
  // Return unacknowledged alerts
  return activeAlerts.filter(a => !a.acknowledged);
}

/**
 * Create a new system alert
 */
function createAlert(type: 'warning' | 'critical' | 'info', message: string): void {
  // Check for duplicate unacknowledged alerts
  const exists = activeAlerts.some(a => !a.acknowledged && a.message === message);
  if (exists) return;
  
  activeAlerts.push({
    id: `alert-${++alertIdCounter}`,
    type,
    message,
    timestamp: Date.now(),
    acknowledged: false,
  });
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId: string): void {
  const alert = activeAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
  }
}

/**
 * Get all active (unacknowledged) alerts
 */
export function getActiveAlerts(): SystemAlert[] {
  return activeAlerts.filter(a => !a.acknowledged);
}

/**
 * Clear all acknowledged alerts
 */
export function clearAcknowledgedAlerts(): void {
  const index = activeAlerts.findIndex(a => a.acknowledged);
  if (index !== -1) {
    activeAlerts.splice(index, 1);
  }
}

// ============================================================================
// PROCESS MANAGEMENT (v1.2.1)
// ============================================================================

// Track "virtual" processes (browser operations, intervals, etc.)
interface VirtualProcess {
  pid: number;
  name: string;
  status: ProcessInfo['status'];
  startTime: number;
  memory: number;
  cpu: number;
  command?: string;
  cleanup?: () => void;
}

const virtualProcesses = new Map<number, VirtualProcess>();
let nextVirtualPid = 10000;

/**
 * Register a virtual process for tracking
 */
export function registerVirtualProcess(
  name: string,
  command?: string,
  cleanup?: () => void
): number {
  const pid = nextVirtualPid++;
  virtualProcesses.set(pid, {
    pid,
    name,
    status: 'running',
    startTime: Date.now(),
    memory: 0,
    cpu: 0,
    command,
    cleanup,
  });
  return pid;
}

/**
 * Unregister a virtual process
 */
export function unregisterVirtualProcess(pid: number): boolean {
  const proc = virtualProcesses.get(pid);
  if (proc) {
    if (proc.cleanup) {
      try {
        proc.cleanup();
      } catch (e) {
        console.error(`[core.os] Cleanup error for process ${pid}:`, e);
      }
    }
    virtualProcesses.delete(pid);
    return true;
  }
  return false;
}

/**
 * Update virtual process metrics
 */
export function updateVirtualProcessMetrics(pid: number, memory: number, cpu: number): boolean {
  const proc = virtualProcesses.get(pid);
  if (proc) {
    proc.memory = memory;
    proc.cpu = cpu;
    return true;
  }
  return false;
}

/**
 * Set virtual process status
 */
export function setVirtualProcessStatus(pid: number, status: ProcessInfo['status']): boolean {
  const proc = virtualProcesses.get(pid);
  if (proc) {
    proc.status = status;
    return true;
  }
  return false;
}

/**
 * Get list of running processes
 * Combines Node.js processes (if available) with virtual processes
 */
export async function getProcessList(filter?: ProcessFilter): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];
  
  // Add Node.js process info
  processes.push({
    pid: process.pid || 0,
    name: 'jarvis-kernel',
    status: 'running',
    cpu: getCPUUsage(),
    memory: process.memoryUsage().rss,
    uptime: process.uptime(),
    timestamp: Date.now(),
    command: 'node jarvis-kernel',
  });
  
  // Add virtual processes
  virtualProcesses.forEach(proc => {
    processes.push({
      pid: proc.pid,
      name: proc.name,
      status: proc.status,
      cpu: proc.cpu,
      memory: proc.memory,
      uptime: (Date.now() - proc.startTime) / 1000,
      timestamp: Date.now(),
      command: proc.command,
    });
  });
  
  // Apply filters
  let filtered = processes;
  if (filter) {
    if (filter.status) {
      filtered = filtered.filter(p => p.status === filter.status);
    }
    if (filter.minCpu !== undefined) {
      filtered = filtered.filter(p => p.cpu >= filter.minCpu!);
    }
    if (filter.minMemory !== undefined) {
      filtered = filtered.filter(p => p.memory >= filter.minMemory!);
    }
    if (filter.namePattern) {
      const pattern = new RegExp(filter.namePattern, 'i');
      filtered = filtered.filter(p => pattern.test(p.name));
    }
  }
  
  return filtered.sort((a, b) => b.cpu - a.cpu); // Sort by CPU usage descending
}

/**
 * Get process statistics
 */
export async function getProcessStats(): Promise<ProcessStats> {
  const processes = await getProcessList();
  return {
    total: processes.length,
    running: processes.filter(p => p.status === 'running').length,
    sleeping: processes.filter(p => p.status === 'sleeping').length,
    stopped: processes.filter(p => p.status === 'stopped').length,
    totalCpu: processes.reduce((sum, p) => sum + p.cpu, 0),
    totalMemory: processes.reduce((sum, p) => sum + p.memory, 0),
  };
}

/**
 * Kill a process by PID
 * Note: Can only kill virtual processes in browser environment
 */
export async function killProcess(pid: number, force: boolean = false): Promise<ProcessKillResult> {
  // Cannot kill main Node.js process
  if (pid === (process.pid || 0)) {
    return {
      success: false,
      pid,
      message: 'Cannot kill the main JARVIS kernel process',
    };
  }
  
  // Try to kill virtual process
  if (virtualProcesses.has(pid)) {
    const proc = virtualProcesses.get(pid)!;
    const success = unregisterVirtualProcess(pid);
    return {
      success,
      pid,
      message: success ? `Process "${proc.name}" (PID: ${pid}) terminated` : `Failed to terminate process ${pid}`,
    };
  }
  
  return {
    success: false,
    pid,
    message: `Process ${pid} not found or cannot be terminated from browser environment`,
  };
}

/**
 * Find processes by name pattern
 */
export async function findProcesses(namePattern: string): Promise<ProcessInfo[]> {
  return getProcessList({ namePattern });
}

/**
 * Get top N processes by CPU usage
 */
export async function getTopCpuProcesses(n: number = 5): Promise<ProcessInfo[]> {
  const processes = await getProcessList();
  return processes.slice(0, n);
}

/**
 * Get top N processes by memory usage
 */
export async function getTopMemoryProcesses(n: number = 5): Promise<ProcessInfo[]> {
  const processes = await getProcessList();
  return processes.sort((a, b) => b.memory - a.memory).slice(0, n);
}

/**
 * Format process list for display
 */
export function formatProcessList(processes: ProcessInfo[]): string {
  if (processes.length === 0) {
    return 'No processes found.';
  }
  
  const lines = [
    '╔══════╦════════════════════════════╦════════╦══════════╦══════════════════╗',
    '║ PID  ║ Name                       ║ Status ║ CPU %    ║ Memory           ║',
    '╠══════╬════════════════════════════╬════════╬══════════╬══════════════════╣',
  ];
  
  processes.forEach(proc => {
    const pid = proc.pid.toString().padStart(4);
    const name = proc.name.substring(0, 26).padEnd(26);
    const status = proc.status.padEnd(6);
    const cpu = proc.cpu.toFixed(1).padStart(6);
    const memory = formatBytes(proc.memory).padStart(14);
    lines.push(`║ ${pid} ║ ${name} ║ ${status} ║ ${cpu} ║ ${memory} ║`);
  });
  
  lines.push('╚══════╩════════════════════════════╩════════╩══════════╩══════════════════╝');
  return lines.join('\n');
}

/**
 * Format process statistics for display
 */
export function formatProcessStats(stats: ProcessStats): string {
  return [
    '╔════════════════════════════════════════════════════════════════╗',
    '║                  PROCESS STATISTICS                            ║',
    '╠════════════════════════════════════════════════════════════════╣',
    `║  Total Processes: ${stats.total.toString().padStart(45)} ║`,
    `║  Running:         ${stats.running.toString().padStart(45)} ║`,
    `║  Sleeping:        ${stats.sleeping.toString().padStart(45)} ║`,
    `║  Stopped:         ${stats.stopped.toString().padStart(45)} ║`,
    '╠════════════════════════════════════════════════════════════════╣',
    `║  Total CPU Usage: ${(stats.totalCpu.toFixed(1) + '%').padStart(45)} ║`,
    `║  Total Memory:    ${formatBytes(stats.totalMemory).padStart(45)} ║`,
    '╚════════════════════════════════════════════════════════════════╝',
  ].join('\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format seconds to human-readable uptime
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// ============================================================================
// DIAGNOSTICS (Enhanced for v1.2.0)
// ============================================================================

/**
 * Run full system diagnostic (v1.2.0: Enhanced with storage, performance, alerts)
 */
export async function runDiagnostics(): Promise<string> {
  const metrics = getSystemMetrics();
  const battery = await getBatteryInfo();
  const network = getNetworkInfo();
  const storage = await getStorageInfo();
  const performance = getPerformanceMetrics();
  const health = getPluginHealth();
  const analysis = await getPredictiveAnalysis();
  const alerts = getActiveAlerts();

  // Box width: 66 chars total (including borders)
  const LABEL_WIDTH = 12;
  const VALUE_WIDTH = 50;
  const TOTAL_INNER = LABEL_WIDTH + VALUE_WIDTH + 2;
  const padValue = (s: string) => s.padEnd(VALUE_WIDTH);
  const padCenter = (s: string) => {
    const padding = TOTAL_INNER - s.length;
    const left = Math.floor(padding / 2);
    return ' '.repeat(left) + s + ' '.repeat(padding - left);
  };

  const lines = [
    '╔══════════════════════════════════════════════════════════════════╗',
    `║${padCenter('JARVIS SYSTEM DIAGNOSTIC REPORT v1.2.1')}║`,
    '╠══════════════════════════════════════════════════════════════════╣',
    `║  MEMORY${' '.repeat(TOTAL_INNER - 8)}║`,
    `║  Heap Used:  ${padValue(formatBytes(metrics.memory.heapUsed))} ║`,
    `║  Heap Total: ${padValue(formatBytes(metrics.memory.heapTotal))} ║`,
    `║  RSS:        ${padValue(formatBytes(metrics.memory.rss))} ║`,
    `║  External:   ${padValue(formatBytes(metrics.memory.external))} ║`,
    `║  Pressure:   ${padValue(calculateMemoryPressure(metrics.memory.heapUsed, metrics.memory.heapTotal))} ║`,
  ];

  if (metrics.cpu.supported) {
    lines.push(
      '╠══════════════════════════════════════════════════════════════════╣',
      `║  CPU${' '.repeat(TOTAL_INNER - 5)}║`,
      `║  Usage:      ${padValue(`${metrics.cpu.usagePercent}%`)} ║`,
      `║  Load Avg:   ${padValue(metrics.cpu.loadAvg.map(v => v.toFixed(2)).join(', '))} ║`
    );
  }

  lines.push(
    '╠══════════════════════════════════════════════════════════════════╣',
    `║  SYSTEM${' '.repeat(TOTAL_INNER - 8)}║`,
    `║  Uptime:     ${padValue(formatUptime(metrics.uptime))} ║`,
    `║  Health:     ${padValue(`${analysis.healthScore}/100 ${getHealthEmoji(analysis.healthScore)}`)} ║`,
    `║  Timestamp:  ${padValue(new Date(metrics.timestamp).toISOString())} ║`
  );

  if (battery.supported) {
    lines.push(
      '╠══════════════════════════════════════════════════════════════════╣',
      `║  BATTERY${' '.repeat(TOTAL_INNER - 9)}║`,
      `║  Level:      ${padValue(`${battery.level.toFixed(0)}%`)} ║`,
      `║  Status:     ${padValue(battery.charging ? 'Charging ⚡' : 'Discharging 🔋')} ║`,
      `║  Time Rem:   ${padValue(battery.dischargingTime !== Infinity ? formatUptime(battery.dischargingTime) : 'Calculating...')} ║`
    );
  }

  if (network.supported) {
    lines.push(
      '╠══════════════════════════════════════════════════════════════════╣',
      `║  NETWORK${' '.repeat(TOTAL_INNER - 9)}║`,
      `║  Type:       ${padValue(network.effectiveType)} ║`,
      `║  Downlink:   ${padValue(`${network.downlink} Mbps`)} ║`,
      `║  Latency:    ${padValue(`${network.rtt} ms`)} ║`,
      `║  Online:     ${padValue(network.online ? 'Yes 🟢' : 'No 🔴')} ║`
    );
  }

  if (storage.supported) {
    lines.push(
      '╠══════════════════════════════════════════════════════════════════╣',
      `║  STORAGE${' '.repeat(TOTAL_INNER - 9)}║`,
      `║  Used:       ${padValue(formatBytes(storage.usage))} ║`,
      `║  Available:  ${padValue(formatBytes(storage.available))} ║`,
      `║  Percent:    ${padValue(`${storage.percentUsed.toFixed(1)}%`)} ║`
    );
  }

  if (performance.supported) {
    lines.push(
      '╠══════════════════════════════════════════════════════════════════╣',
      `║  PERFORMANCE${' '.repeat(TOTAL_INNER - 13)}║`,
      `║  Memory Pres:${padValue(performance.memoryPressure)} ║`,
      `║  Latency:    ${padValue(formatDuration(performance.latency))} ║`
    );
  }

  lines.push(
    '╠══════════════════════════════════════════════════════════════════╣',
    `║  PLUGINS${' '.repeat(TOTAL_INNER - 9)}║`,
    `║  Active:     ${padValue(`${health.active}/${health.total} ✅`)} ║`,
    `║  Disabled:   ${padValue(`${health.disabled} ⚠️`)} ║`,
    `║  Paused:     ${padValue(`${health.paused} ⏸️`)} ║`,
    `║  Errors:     ${padValue(`${health.error} ❌`)} ║`
  );

  if (analysis.recommendedAction) {
    lines.push(
      '╠══════════════════════════════════════════════════════════════════╣',
      `║  RECOMMENDATION${' '.repeat(TOTAL_INNER - 16)}║`,
      `║  ${padValue(analysis.recommendedAction.substring(0, 50))} ║`
    );
  }

  if (alerts.length > 0) {
    lines.push(
      '╠══════════════════════════════════════════════════════════════════╣',
      `║  ALERTS (${alerts.length})${' '.repeat(TOTAL_INNER - 12)}║`
    );
    alerts.slice(0, 3).forEach(alert => {
      const icon = alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵';
      lines.push(`║  ${padValue(`${icon} ${alert.message.substring(0, 47)}`)} ║`);
    });
  }

  lines.push('╚══════════════════════════════════════════════════════════════════╝');

  return lines.join('\n');
}

/**
 * Get health emoji based on score
 */
function getHealthEmoji(score: number): string {
  if (score >= 90) return '💚';
  if (score >= 70) return '💛';
  if (score >= 50) return '🧡';
  return '❤️';
}

// ============================================================================
// AUTO-MONITORING (v1.2.0)
// ============================================================================

let monitoringInterval: NodeJS.Timeout | null = null;

/**
 * Start automatic system monitoring
 */
export function startMonitoring(intervalMs: number = 5000): void {
  if (monitoringInterval) return;
  
  monitoringInterval = setInterval(() => {
    recordMetrics();
    checkSystemAlerts();
  }, intervalMs);
  
  console.log(`[core.os v1.2.0] System monitoring started (${intervalMs}ms interval)`);
}

/**
 * Stop automatic system monitoring
 */
export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[core.os v1.2.0] System monitoring stopped');
  }
}

/**
 * Check if monitoring is active
 */
export function isMonitoring(): boolean {
  return monitoringInterval !== null;
}

// ============================================================================
// EXPORT
// ============================================================================

// Export core.os v1.2.1 API
export const coreOs = {
  version: '1.2.1',
  // v1.1.0 functions
  getSystemMetrics,
  getBatteryInfo,
  getNetworkInfo,
  getPluginHealth,
  runDiagnostics,
  formatBytes,
  formatUptime,
  // v1.2.0 new functions
  getStorageInfo,
  getPerformanceMetrics,
  getPredictiveAnalysis,
  checkSystemAlerts,
  getActiveAlerts,
  acknowledgeAlert,
  clearAcknowledgedAlerts,
  recordMetrics,
  startMonitoring,
  stopMonitoring,
  isMonitoring,
  formatDuration,
  // v1.2.1 process management
  registerVirtualProcess,
  unregisterVirtualProcess,
  updateVirtualProcessMetrics,
  setVirtualProcessStatus,
  getProcessList,
  getProcessStats,
  killProcess,
  findProcesses,
  getTopCpuProcesses,
  getTopMemoryProcesses,
  formatProcessList,
  formatProcessStats,
};

export default coreOs;
