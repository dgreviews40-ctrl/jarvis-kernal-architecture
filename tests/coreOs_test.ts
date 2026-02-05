/**
 * core.os v1.1.0 Test Suite
 * 
 * Run in browser console:
 *   import { runCoreOsTests } from './tests/coreOs_test.ts'
 *   await runCoreOsTests()
 */

import {
  getSystemMetrics,
  getBatteryInfo,
  getNetworkInfo,
  getPluginHealth,
  runDiagnostics,
  formatBytes,
  formatUptime,
  coreOs,
} from '../services/coreOs';
import { registry } from '../services/registry';
import { engine } from '../services/execution';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

class CoreOsTestSuite {
  private results: TestResult[] = [];

  async runAll(): Promise<TestResult[]> {
    this.results = [];
    console.log('🧪 Starting core.os v1.1.0 Tests...\n');

    // Version check
    await this.test('Version is 1.1.0', () => {
      if (coreOs.version !== '1.1.0') {
        throw new Error(`Expected version 1.1.0, got ${coreOs.version}`);
      }
    });

    // Format utilities
    await this.test('formatBytes: 0 bytes', () => {
      if (formatBytes(0) !== '0 B') throw new Error(`Expected "0 B", got "${formatBytes(0)}"`);
    });

    await this.test('formatBytes: 1024 bytes = 1 KB', () => {
      if (formatBytes(1024) !== '1.00 KB') throw new Error(`Expected "1.00 KB", got "${formatBytes(1024)}"`);
    });

    await this.test('formatBytes: negative number', () => {
      if (formatBytes(-100) !== '0 B') throw new Error(`Expected "0 B", got "${formatBytes(-100)}"`);
    });

    await this.test('formatBytes: NaN', () => {
      if (formatBytes(NaN) !== '0 B') throw new Error(`Expected "0 B", got "${formatBytes(NaN)}"`);
    });

    await this.test('formatUptime: hours', () => {
      const result = formatUptime(3661);
      if (!result.includes('1h')) throw new Error(`Expected "1h" in "${result}"`);
    });

    await this.test('formatUptime: minutes only', () => {
      const result = formatUptime(61);
      if (!result.includes('1m')) throw new Error(`Expected "1m" in "${result}"`);
    });

    // System metrics
    await this.test('getSystemMetrics returns valid data', () => {
      const metrics = getSystemMetrics();
      if (!metrics.memory) throw new Error('Missing memory data');
      if (typeof metrics.memory.heapUsed !== 'number') throw new Error('Invalid heapUsed');
      if (typeof metrics.memory.heapTotal !== 'number') throw new Error('Invalid heapTotal');
      if (typeof metrics.uptime !== 'number') throw new Error('Invalid uptime');
      if (typeof metrics.timestamp !== 'number') throw new Error('Invalid timestamp');
    });

    // Battery API
    await this.test('getBatteryInfo returns valid structure', async () => {
      const battery = await getBatteryInfo();
      if (typeof battery.supported !== 'boolean') throw new Error('Invalid supported flag');
      if (typeof battery.level !== 'number') throw new Error('Invalid level');
      if (typeof battery.charging !== 'boolean') throw new Error('Invalid charging');
    });

    // Network API
    await this.test('getNetworkInfo returns valid structure', () => {
      const network = getNetworkInfo();
      if (typeof network.supported !== 'boolean') throw new Error('Invalid supported flag');
      if (typeof network.effectiveType !== 'string') throw new Error('Invalid effectiveType');
      if (typeof network.downlink !== 'number') throw new Error('Invalid downlink');
      if (typeof network.rtt !== 'number') throw new Error('Invalid rtt');
    });

    // Plugin health
    await this.test('getPluginHealth returns valid data', () => {
      const health = getPluginHealth();
      if (typeof health.total !== 'number') throw new Error('Invalid total');
      if (typeof health.active !== 'number') throw new Error('Invalid active');
      if (typeof health.disabled !== 'number') throw new Error('Invalid disabled');
      if (typeof health.error !== 'number') throw new Error('Invalid error');
      if (typeof health.paused !== 'number') throw new Error('Invalid paused');
      if (!Array.isArray(health.details)) throw new Error('Invalid details array');
      
      // Verify counts match
      const sum = health.active + health.disabled + health.error + health.paused;
      if (sum !== health.total) throw new Error(`Count mismatch: ${sum} !== ${health.total}`);
    });

    // Full diagnostics
    await this.test('runDiagnostics returns formatted report', async () => {
      const report = await runDiagnostics();
      if (typeof report !== 'string') throw new Error('Report is not a string');
      if (!report.includes('v1.1.0')) throw new Error('Missing version in report');
      if (!report.includes('MEMORY')) throw new Error('Missing MEMORY section');
      if (!report.includes('SYSTEM')) throw new Error('Missing SYSTEM section');
      if (!report.includes('PLUGINS')) throw new Error('Missing PLUGINS section');
    });

    // Integration: Execute via engine
    await this.test('Execute: diagnostic command', async () => {
      const result = await engine.executeAction({
        pluginId: 'core.os',
        method: 'EXECUTE',
        params: { entities: ['diagnostic'] }
      });
      if (typeof result !== 'string') throw new Error('Result is not a string');
      if (!result.includes('DIAGNOSTIC')) throw new Error('Missing DIAGNOSTIC in result');
    });

    await this.test('Execute: metrics command', async () => {
      const result = await engine.executeAction({
        pluginId: 'core.os',
        method: 'EXECUTE',
        params: { entities: ['metrics'] }
      });
      if (typeof result !== 'string') throw new Error('Result is not a string');
      if (!result.includes('METRICS')) throw new Error('Missing METRICS in result');
      if (!result.includes('v1.1.0')) throw new Error('Missing version in result');
    });

    await this.test('Execute: health command', async () => {
      const result = await engine.executeAction({
        pluginId: 'core.os',
        method: 'EXECUTE',
        params: { entities: ['health'] }
      });
      if (typeof result !== 'string') throw new Error('Result is not a string');
      if (!result.includes('HEALTH')) throw new Error('Missing HEALTH in result');
    });

    await this.test('Execute: battery command', async () => {
      const result = await engine.executeAction({
        pluginId: 'core.os',
        method: 'EXECUTE',
        params: { entities: ['battery'] }
      });
      if (typeof result !== 'string') throw new Error('Result is not a string');
      if (!result.includes('BATTERY')) throw new Error('Missing BATTERY in result');
    });

    await this.test('Execute: network command', async () => {
      const result = await engine.executeAction({
        pluginId: 'core.os',
        method: 'EXECUTE',
        params: { entities: ['network'] }
      });
      if (typeof result !== 'string') throw new Error('Result is not a string');
      if (!result.includes('NETWORK') && !result.includes('not available')) {
        throw new Error('Missing NETWORK in result');
      }
    });

    await this.test('Execute: fallback/unknown command', async () => {
      const result = await engine.executeAction({
        pluginId: 'core.os',
        method: 'EXECUTE',
        params: { entities: ['unknown'] }
      });
      if (typeof result !== 'string') throw new Error('Result is not a string');
      if (!result.includes('v1.1.0')) throw new Error('Missing version in fallback');
    });

    // Registry verification
    await this.test('Registry: core.os has correct capabilities', () => {
      const plugin = registry.get('core.os');
      if (!plugin) throw new Error('core.os not found in registry');
      if (plugin.manifest.version !== '1.1.0') throw new Error(`Wrong version: ${plugin.manifest.version}`);
      
      const requiredCapabilities = [
        'system_diagnostics',
        'process_management',
        'metrics_collection',
        'health_monitoring',
        'battery_monitoring',
        'network_monitoring'
      ];
      
      for (const cap of requiredCapabilities) {
        if (!plugin.manifest.capabilities.includes(cap)) {
          throw new Error(`Missing capability: ${cap}`);
        }
      }
    });

    await this.test('Registry: core.os provides correct services', () => {
      const plugin = registry.get('core.os');
      if (!plugin) throw new Error('core.os not found in registry');
      
      const requiredProvides = [
        'os_level_control',
        'filesystem',
        'system_diagnostics',
        'system_metrics',
        'battery_status',
        'network_info'
      ];
      
      for (const service of requiredProvides) {
        if (!plugin.manifest.provides.includes(service)) {
          throw new Error(`Missing service: ${service}`);
        }
      }
    });

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

  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const duration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n' + '='.repeat(50));
    console.log(`📊 core.os v1.1.0 Test Results`);
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⏱️  Total Duration: ${duration.toFixed(2)}ms`);
    console.log('='.repeat(50));

    if (failed === 0) {
      console.log('🎉 All tests passed! core.os v1.1.0 is ready.');
    } else {
      console.log('⚠️  Some tests failed. Review the errors above.');
    }
  }
}

// Export singleton instance
export const coreOsTests = new CoreOsTestSuite();

// Convenience function
export async function runCoreOsTests(): Promise<TestResult[]> {
  return coreOsTests.runAll();
}

// Default export
export default coreOsTests;
