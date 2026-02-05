/**
 * core.os v1.2.0 Integration Module
 * Connects System Core with Voice, Display, and Cortex systems
 */

import { coreOs, getPredictiveAnalysis, getActiveAlerts, SystemAlert } from './coreOs';
import { voice } from './voice';
import { cortex } from './cortex';
import { registry } from './registry';
import { HealthEventType, ImpactLevel } from '../types';

// ============================================================================
// INTEGRATION CONFIGURATION
// ============================================================================

interface IntegrationConfig {
  voiceAnnouncements: boolean;
  displayDashboard: boolean;
  cortexReporting: boolean;
  alertThresholds: {
    memoryWarning: number;  // Percentage (0-1)
    memoryCritical: number; // Percentage (0-1)
    batteryWarning: number; // Percentage (0-100)
    healthScoreWarning: number; // 0-100
  };
  monitoringInterval: number; // ms
}

const DEFAULT_CONFIG: IntegrationConfig = {
  voiceAnnouncements: true,
  displayDashboard: true,
  cortexReporting: true,
  alertThresholds: {
    memoryWarning: 0.75,
    memoryCritical: 0.9,
    batteryWarning: 20,
    healthScoreWarning: 50,
  },
  monitoringInterval: 10000, // 10 seconds
};

// ============================================================================
// CORE.OS INTEGRATION CLASS
// ============================================================================

class CoreOsIntegration {
  private config: IntegrationConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastAlertIds: Set<string> = new Set();
  private isInitialized: boolean = false;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize core.os integration with all systems
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[core.os Integration] Already initialized');
      return;
    }

    console.log('[core.os Integration] Initializing v1.2.0...');

    // Start core.os auto-monitoring
    coreOs.startMonitoring(this.config.monitoringInterval);

    // Start integration monitoring
    this.startIntegrationMonitoring();

    // Subscribe to registry changes for plugin health
    this.subscribeToRegistry();

    this.isInitialized = true;
    console.log('[core.os Integration] Initialized successfully');

    // Announce if voice is enabled
    if (this.config.voiceAnnouncements) {
      this.announce('System monitoring initialized. All core functions active.');
    }
  }

  /**
   * Shutdown integration
   */
  public shutdown(): void {
    if (!this.isInitialized) return;

    console.log('[core.os Integration] Shutting down...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    coreOs.stopMonitoring();
    this.isInitialized = false;

    console.log('[core.os Integration] Shutdown complete');
  }

  // ============================================================================
  // MONITORING & ALERTS
  // ============================================================================

  /**
   * Start integration-level monitoring
   */
  private startIntegrationMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.checkSystemStatus();
    }, this.config.monitoringInterval);
  }

  /**
   * Check system status and trigger integrations
   */
  private async checkSystemStatus(): Promise<void> {
    try {
      // Get predictive analysis
      const analysis = await getPredictiveAnalysis();

      // Check for new alerts
      const alerts = getActiveAlerts();
      const newAlerts = alerts.filter(a => !this.lastAlertIds.has(a.id));

      // Process new alerts
      for (const alert of newAlerts) {
        await this.processAlert(alert);
        this.lastAlertIds.add(alert.id);
      }

      // Report to cortex
      if (this.config.cortexReporting) {
        this.reportToCortex(analysis);
      }

      // Check thresholds
      await this.checkThresholds(analysis);

    } catch (error) {
      console.error('[core.os Integration] Error in status check:', error);
    }
  }

  /**
   * Process a system alert through all integrated systems
   */
  private async processAlert(alert: SystemAlert): Promise<void> {
    console.log(`[core.os Integration] Processing alert: ${alert.type} - ${alert.message}`);

    // Voice announcement for critical alerts
    if (this.config.voiceAnnouncements && alert.type === 'critical') {
      this.announce(`Warning: ${alert.message}`);
    }

    // Report to cortex
    if (this.config.cortexReporting) {
      cortex.reportEvent({
        sourceId: 'core.os',
        type: alert.type === 'critical' ? HealthEventType.CRASH : 
              alert.type === 'warning' ? HealthEventType.HIGH_LATENCY : HealthEventType.SUCCESS,
        impact: alert.type === 'critical' ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
        latencyMs: 0,
        context: { alertType: alert.type, message: alert.message }
      });
    }

    // Dispatch display event
    if (this.config.displayDashboard && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('coreos-alert', { 
        detail: alert 
      }));
    }
  }

  /**
   * Check system thresholds and trigger alerts
   */
  private async checkThresholds(analysis: Awaited<ReturnType<typeof getPredictiveAnalysis>>): Promise<void> {
    const metrics = coreOs.getSystemMetrics();
    const battery = await coreOs.getBatteryInfo();

    // Memory threshold check
    const memoryRatio = metrics.memory.heapUsed / metrics.memory.heapTotal;
    if (memoryRatio > this.config.alertThresholds.memoryCritical) {
      // Critical memory - already handled by core.os alerts
    } else if (memoryRatio > this.config.alertThresholds.memoryWarning) {
      // Voice warning for high memory
      if (this.config.voiceAnnouncements) {
        const spokenRecently = Date.now() - (this as any).lastMemoryWarning < 60000;
        if (!spokenRecently) {
          this.announce('Memory usage is high. Consider optimizing or restarting.');
          (this as any).lastMemoryWarning = Date.now();
        }
      }
    }

    // Battery threshold check
    if (battery.supported && battery.level < this.config.alertThresholds.batteryWarning && !battery.charging) {
      if (this.config.voiceAnnouncements) {
        const spokenRecently = Date.now() - (this as any).lastBatteryWarning < 120000;
        if (!spokenRecently) {
          this.announce(`Battery at ${battery.level.toFixed(0)} percent. Please connect charger.`);
          (this as any).lastBatteryWarning = Date.now();
        }
      }
    }

    // Health score check
    if (analysis.healthScore < this.config.alertThresholds.healthScoreWarning) {
      if (this.config.voiceAnnouncements) {
        const spokenRecently = Date.now() - (this as any).lastHealthWarning < 300000;
        if (!spokenRecently) {
          this.announce('System health is degraded. Recommend restart.');
          (this as any).lastHealthWarning = Date.now();
        }
      }
    }
  }

  // ============================================================================
  // VOICE INTEGRATION
  // ============================================================================

  /**
   * Announce a message through voice
   */
  private announce(message: string): void {
    try {
      // Use voice service if available
      if (voice && typeof voice.speak === 'function') {
        voice.speak(message, true); // true = interruptible
      } else {
        // Fallback to system TTS
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('[core.os Integration] Voice announcement failed:', error);
    }
  }

  /**
   * Speak system status report
   */
  public async speakStatus(): Promise<void> {
    const analysis = await getPredictiveAnalysis();
    const metrics = coreOs.getSystemMetrics();
    const battery = await coreOs.getBatteryInfo();

    let message = `System status. Health score ${analysis.healthScore} percent. `;
    message += `Memory using ${coreOs.formatBytes(metrics.memory.heapUsed)}. `;

    if (battery.supported) {
      message += `Battery at ${battery.level.toFixed(0)} percent. `;
      if (!battery.charging && analysis.batteryTimeRemaining) {
        message += `Approximately ${coreOs.formatUptime(analysis.batteryTimeRemaining)} remaining. `;
      }
    }

    if (analysis.recommendedAction) {
      message += `Recommendation: ${analysis.recommendedAction}`;
    } else {
      message += 'All systems nominal.';
    }

    this.announce(message);
  }

  /**
   * Speak diagnostic report
   */
  public async speakDiagnostics(): Promise<void> {
    const health = coreOs.getPluginHealth();
    const alerts = getActiveAlerts();

    let message = `Diagnostics. ${health.active} of ${health.total} plugins active. `;

    if (alerts.length > 0) {
      const criticalCount = alerts.filter(a => a.type === 'critical').length;
      const warningCount = alerts.filter(a => a.type === 'warning').length;
      message += `There are ${alerts.length} active alerts. `;
      if (criticalCount > 0) message += `${criticalCount} critical. `;
      if (warningCount > 0) message += `${warningCount} warnings. `;
    } else {
      message += 'No active alerts.';
    }

    this.announce(message);
  }

  // ============================================================================
  // CORTEX INTEGRATION
  // ============================================================================

  /**
   * Report system status to Cortex
   */
  private reportToCortex(analysis: Awaited<ReturnType<typeof getPredictiveAnalysis>>): void {
    // Report health score as reliability metric
    cortex.reportEvent({
      sourceId: 'core.os',
      type: analysis.healthScore > 80 ? HealthEventType.SUCCESS :
            analysis.healthScore > 50 ? HealthEventType.HIGH_LATENCY : HealthEventType.CRASH,
      impact: analysis.healthScore < 50 ? ImpactLevel.HIGH : ImpactLevel.LOW,
      latencyMs: 0,
      context: { 
        healthScore: analysis.healthScore,
        memoryTrend: analysis.memoryTrend,
        hasRecommendation: !!analysis.recommendedAction
      }
    });
  }

  /**
   * Get system reliability score from Cortex
   */
  public getReliability(): ReturnType<typeof cortex.getReliability> {
    return cortex.getReliability('core.os');
  }

  // ============================================================================
  // REGISTRY INTEGRATION
  // ============================================================================

  /**
   * Subscribe to registry changes
   */
  private subscribeToRegistry(): void {
    registry.subscribe(() => {
      // Plugin state changed - check health
      const health = coreOs.getPluginHealth();
      
      // Report significant changes to cortex
      if (health.error > 0) {
        cortex.reportEvent({
          sourceId: 'core.os',
          type: HealthEventType.CRASH,
          impact: ImpactLevel.MEDIUM,
          latencyMs: 0,
          context: { 
            pluginErrors: health.error,
            totalPlugins: health.total 
          }
        });
      }
    });
  }

  // ============================================================================
  // DISPLAY INTEGRATION (Event-based for React components)
  // ============================================================================

  /**
   * Get current system status for display
   */
  public async getDisplayData(): Promise<{
    metrics: ReturnType<typeof coreOs.getSystemMetrics>;
    battery: Awaited<ReturnType<typeof coreOs.getBatteryInfo>>;
    network: ReturnType<typeof coreOs.getNetworkInfo>;
    storage: Awaited<ReturnType<typeof coreOs.getStorageInfo>>;
    performance: ReturnType<typeof coreOs.getPerformanceMetrics>;
    analysis: Awaited<ReturnType<typeof getPredictiveAnalysis>>;
    health: ReturnType<typeof coreOs.getPluginHealth>;
    alerts: ReturnType<typeof getActiveAlerts>;
    isMonitoring: boolean;
  }> {
    const [battery, storage, analysis] = await Promise.all([
      coreOs.getBatteryInfo(),
      coreOs.getStorageInfo(),
      getPredictiveAnalysis()
    ]);

    return {
      metrics: coreOs.getSystemMetrics(),
      battery,
      network: coreOs.getNetworkInfo(),
      storage,
      performance: coreOs.getPerformanceMetrics(),
      analysis,
      health: coreOs.getPluginHealth(),
      alerts: getActiveAlerts(),
      isMonitoring: coreOs.isMonitoring(),
    };
  }

  // ============================================================================
  // VOICE COMMANDS
  // ============================================================================

  /**
   * Handle voice commands related to system status
   */
  public async handleVoiceCommand(command: string): Promise<string> {
    const lower = command.toLowerCase();

    if (lower.includes('status') || lower.includes('how are you')) {
      await this.speakStatus();
      return 'Spoke system status';
    }

    if (lower.includes('diagnostic') || lower.includes('health')) {
      await this.speakDiagnostics();
      return 'Spoke diagnostics';
    }

    if (lower.includes('battery') || lower.includes('power')) {
      const battery = await coreOs.getBatteryInfo();
      if (battery.supported) {
        this.announce(`Battery is at ${battery.level.toFixed(0)} percent.`);
        return `Battery: ${battery.level.toFixed(0)}%`;
      }
      return 'Battery information not available';
    }

    if (lower.includes('memory') || lower.includes('ram')) {
      const metrics = coreOs.getSystemMetrics();
      this.announce(`Memory using ${coreOs.formatBytes(metrics.memory.heapUsed)} of ${coreOs.formatBytes(metrics.memory.heapTotal)}.`);
      return `Memory: ${coreOs.formatBytes(metrics.memory.heapUsed)} / ${coreOs.formatBytes(metrics.memory.heapTotal)}`;
    }

    if (lower.includes('restart') || lower.includes('reboot')) {
      this.announce('Initiating system restart sequence.');
      return 'Restart command received';
    }

    return 'Command not recognized';
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const coreOsIntegration = new CoreOsIntegration();

// Export for use in other modules
export { CoreOsIntegration };
export default coreOsIntegration;
