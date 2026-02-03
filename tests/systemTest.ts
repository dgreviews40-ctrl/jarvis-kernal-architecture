/**
 * JARVIS System Test Suite
 * 
 * Run these tests in the browser console to verify functionality
 */

import { voice } from '../services/voice';
import { memory } from '../services/memory';
import { registry } from '../services/registry';
import { engine } from '../services/execution';
import { haService } from '../services/home_assistant';
import { useKernelStore, useMemoryStore, checkStorageVersion, getStorageStats, clearAllStores } from '../stores';
import { performanceMonitor } from '../services/performanceMonitor';
import { searchPlugins, getFeaturedPlugins, getMarketplaceStats } from '../plugins/marketplace';
import { settingsManager } from '../services/settingsManager';
import { notificationService } from '../services/notificationService';
import { VoiceState, ProcessorState } from '../types';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

export class SystemTestSuite {
  private results: TestResult[] = [];

  async runAll(): Promise<TestResult[]> {
    this.results = [];
    
    console.log('🧪 Starting JARVIS System Tests...\n');
    
    // Voice System Tests
    await this.testVoiceStateTransitions();
    await this.testVoiceRecognition();
    
    // Memory System Tests
    await this.testMemoryStorage();
    await this.testMemoryRetrieval();
    await this.testMemoryStats();
    
    // Plugin System Tests
    await this.testPluginRegistry();
    await this.testCircuitBreaker();
    
    // Integration Tests
    await this.testHomeAssistantConnection();
    
    // Store Tests
    await this.testStoreSync();
    
    // Persistence Tests
    await this.testPersistence();
    
    // Performance Tests
    await this.testPerformance();
    
    // Marketplace Tests
    await this.testMarketplace();
    
    // Settings Backup Tests
    await this.testSettingsBackup();
    
    // Notification Tests
    await this.testNotifications();
    
    this.printSummary();
    return this.results;
  }

  private async test(name: string, fn: () => Promise<void> | void): Promise<void> {
    const start = performance.now();
    try {
      await fn();
      const duration = performance.now() - start;
      this.results.push({ name, passed: true, message: 'OK', duration });
      console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const duration = performance.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, message, duration });
      console.error(`❌ ${name}: ${message}`);
    }
  }

  // ==================== VOICE TESTS ====================

  private async testVoiceStateTransitions(): Promise<void> {
    await this.test('Voice: State transitions', () => {
      const initialState = voice.getState();
      
      // Test toggle
      voice.toggleMute();
      const listeningState = voice.getState();
      if (listeningState !== VoiceState.LISTENING && listeningState !== VoiceState.IDLE) {
        throw new Error(`Expected LISTENING or IDLE, got ${listeningState}`);
      }
      
      // Reset
      voice.setPower(false);
      if (voice.getState() !== VoiceState.MUTED) {
        throw new Error('Failed to mute');
      }
    });
  }

  private async testVoiceRecognition(): Promise<void> {
    await this.test('Voice: Recognition API available', () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('SpeechRecognition API not available in this browser');
      }
    });
  }

  // ==================== MEMORY TESTS ====================

  private async testMemoryStorage(): Promise<void> {
    await this.test('Memory: Store and retrieve', async () => {
      const testContent = `Test memory ${Date.now()}`;
      const node = await memory.store(testContent, 'FACT', ['test']);
      
      if (!node || !node.id) {
        throw new Error('Failed to store memory');
      }
      
      // Cleanup
      await memory.forget(node.id);
    });
  }

  private async testMemoryRetrieval(): Promise<void> {
    await this.test('Memory: Search functionality', async () => {
      const results = await memory.recall('test');
      if (!Array.isArray(results)) {
        throw new Error('Search did not return array');
      }
    });
  }

  private async testMemoryStats(): Promise<void> {
    await this.test('Memory: Stats calculation', async () => {
      const stats = await memory.getStats();
      
      if (typeof stats.totalNodes !== 'number') {
        throw new Error('totalNodes not a number');
      }
      
      if (!stats.byType || typeof stats.byType.FACT !== 'number') {
        throw new Error('byType stats missing or invalid');
      }
    });
  }

  // ==================== PLUGIN TESTS ====================

  private async testPluginRegistry(): Promise<void> {
    await this.test('Plugin: Registry accessible', () => {
      const plugins = registry.getAll();
      if (!Array.isArray(plugins)) {
        throw new Error('Registry getAll did not return array');
      }
    });
  }

  private async testCircuitBreaker(): Promise<void> {
    await this.test('Plugin: Circuit breaker status', () => {
      const statuses = engine.getAllStatus();
      if (!Array.isArray(statuses)) {
        throw new Error('getAllStatus did not return array');
      }
    });
  }

  // ==================== INTEGRATION TESTS ====================

  private async testHomeAssistantConnection(): Promise<void> {
    await this.test('HA: Service initialized', async () => {
      const status = await haService.getStatus();
      if (!status || typeof status.connected !== 'boolean') {
        throw new Error('HA service status not available');
      }
    });
  }

  // ==================== STORE TESTS ====================

  private async testStoreSync(): Promise<void> {
    await this.test('Store: Kernel store accessible', () => {
      const state = useKernelStore.getState();
      if (!state || typeof state.processorState === 'undefined') {
        throw new Error('Kernel store not properly initialized');
      }
    });

    await this.test('Store: Memory store accessible', () => {
      const state = useMemoryStore.getState();
      if (!state || !Array.isArray(state.nodes)) {
        throw new Error('Memory store not properly initialized');
      }
    });
  }

  // ==================== PERSISTENCE TESTS ====================

  private async testPersistence(): Promise<void> {
    await this.test('Persistence: Storage version check', () => {
      // Clear and check version
      localStorage.removeItem('jarvis-store-version');
      checkStorageVersion();
      
      const version = localStorage.getItem('jarvis-store-version');
      if (!version) {
        throw new Error('Storage version not set');
      }
    });

    await this.test('Persistence: Store data can be saved', () => {
      // Simulate saving store data
      const testData = { state: { forcedMode: 'GEMINI' }, version: 0 };
      localStorage.setItem('jarvis-kernel-store', JSON.stringify(testData));
      
      const stored = localStorage.getItem('jarvis-kernel-store');
      if (!stored) {
        throw new Error('Failed to save store data');
      }
      
      const parsed = JSON.parse(stored);
      if (parsed.state.forcedMode !== 'GEMINI') {
        throw new Error('Stored data mismatch');
      }
    });

    await this.test('Persistence: Storage stats work', () => {
      const stats = getStorageStats();
      if (!Array.isArray(stats)) {
        throw new Error('getStorageStats did not return array');
      }
    });

    await this.test('Persistence: Clear all stores works', () => {
      // Set up test data
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ state: {} }));
      localStorage.setItem('jarvis-kernel-store', JSON.stringify({ state: {} }));
      
      clearAllStores();
      
      if (localStorage.getItem('jarvis-ui-store')) {
        throw new Error('UI store not cleared');
      }
      if (localStorage.getItem('jarvis-kernel-store')) {
        throw new Error('Kernel store not cleared');
      }
    });
  }

  // ==================== PERFORMANCE TESTS ====================

  private async testPerformance(): Promise<void> {
    await this.test('Performance: Monitor initializes', () => {
      performanceMonitor.init();
      // Should not throw
    });

    await this.test('Performance: Record bundle size', () => {
      performanceMonitor.recordBundleSize('test-chunk.js', 1000, 500);
      const stats = performanceMonitor.getStats();
      if (stats.bundleSizes.length === 0) {
        throw new Error('Bundle size not recorded');
      }
    });

    await this.test('Performance: Measure timing', () => {
      const result = performanceMonitor.measureTiming('test-operation', () => {
        return 'test-result';
      });
      if (result !== 'test-result') {
        throw new Error('Timing measurement returned wrong result');
      }
    });

    await this.test('Performance: Generate report', () => {
      const report = performanceMonitor.generateReport();
      if (!report.includes('JARVIS Performance Report')) {
        throw new Error('Report generation failed');
      }
    });

    // Cleanup
    performanceMonitor.clearData();
  }

  // ==================== MARKETPLACE TESTS ====================

  private async testMarketplace(): Promise<void> {
    await this.test('Marketplace: Search plugins', async () => {
      const result = await searchPlugins('weather');
      if (result.error) throw new Error(result.error);
      if (result.plugins.length === 0) throw new Error('No plugins found');
    });

    await this.test('Marketplace: Get featured plugins', async () => {
      const result = await getFeaturedPlugins();
      if (result.error) throw new Error(result.error);
      if (!Array.isArray(result.plugins)) throw new Error('Invalid response');
    });

    await this.test('Marketplace: Get stats', () => {
      const stats = getMarketplaceStats();
      if (typeof stats.totalPlugins !== 'number') throw new Error('Invalid stats');
      if (typeof stats.verifiedPlugins !== 'number') throw new Error('Invalid verified count');
    });

    await this.test('Marketplace: Get categories', async () => {
      const { getCategories } = await import('../plugins/marketplace');
      const categories = getCategories();
      if (!Array.isArray(categories)) throw new Error('Invalid categories');
    });
  }

  // ==================== SETTINGS BACKUP TESTS ====================

  private async testSettingsBackup(): Promise<void> {
    await this.test('Settings: Export settings', async () => {
      const result = await settingsManager.exportSettings();
      if (!result.success) throw new Error(result.error || 'Export failed');
      if (!result.data) throw new Error('No export data');
    });

    await this.test('Settings: Import settings', async () => {
      // First export
      const exportResult = await settingsManager.exportSettings();
      if (!exportResult.success) throw new Error('Export failed');
      
      // Then import
      const importResult = await settingsManager.importSettings(exportResult.data!);
      if (!importResult.success) throw new Error(importResult.errors.join(', '));
    });

    await this.test('Settings: Validate export file', async () => {
      const exportResult = await settingsManager.exportSettings();
      const validation = await settingsManager.validateExport(exportResult.data!);
      if (!validation.valid) throw new Error(validation.error || 'Invalid export');
    });

    await this.test('Settings: Get settings summary', () => {
      const summary = settingsManager.getSettingsSummary();
      if (!Array.isArray(summary.settings)) throw new Error('Invalid summary');
      if (typeof summary.totalSize !== 'number') throw new Error('Invalid size');
    });
  }

  // ==================== NOTIFICATION TESTS ====================

  private async testNotifications(): Promise<void> {
    await this.test('Notifications: Show notification', () => {
      const id = notificationService.show({ message: 'Test notification' });
      if (!id) throw new Error('Failed to show notification');
      
      const notifications = notificationService.getNotifications();
      if (notifications.length === 0) throw new Error('Notification not added');
    });

    await this.test('Notifications: Different types', () => {
      notificationService.success('Success message');
      notificationService.error('Error message');
      notificationService.warning('Warning message');
      notificationService.info('Info message');
      
      const notifications = notificationService.getNotifications();
      if (notifications.length < 4) throw new Error('Not all notifications created');
    });

    await this.test('Notifications: Dismiss', () => {
      const id = notificationService.show({ message: 'To be dismissed' });
      notificationService.dismiss(id);
      
      const notifications = notificationService.getNotifications();
      if (notifications.find(n => n.id === id)) {
        throw new Error('Notification not dismissed');
      }
    });

    await this.test('Notifications: History', () => {
      const beforeCount = notificationService.getHistory().length;
      const id = notificationService.show({ message: 'History test' });
      notificationService.dismiss(id);
      
      const history = notificationService.getHistory();
      if (history.length <= beforeCount) {
        throw new Error('History not updated');
      }
    });

    // Cleanup
    notificationService.dismissAll();
    notificationService.clearHistory();
  }

  // ==================== SUMMARY ====================

  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log('\n📊 Test Summary:');
    console.log(`   Total: ${total}`);
    console.log(`   Passed: ${passed} ✅`);
    console.log(`   Failed: ${failed} ❌`);
    console.log(`   Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
    }
  }
}

// Export singleton
export const systemTests = new SystemTestSuite();

// Auto-run in browser console
if (typeof window !== 'undefined') {
  (window as any).runJarvisTests = () => systemTests.runAll();
  console.log('🧪 JARVIS System Tests loaded. Run with: runJarvisTests()');
}
