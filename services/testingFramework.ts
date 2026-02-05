/**
 * Enhanced Testing Framework for JARVIS Kernel v1.3
 * 
 * Implements comprehensive testing features:
 * - Unit tests for new services
 * - Integration tests
 * - Edge case testing
 * - Performance benchmarks
 */

import { logger } from './logger';
import { cacheService } from './cacheService';
import { securityService } from './securityService';
import { resilienceService } from './resilienceService';
import { advancedMemoryService } from './advancedMemoryService';
import { predictiveService } from './predictiveService';
import { performanceMonitoringService } from './performanceMonitoringService';
import { webSocketService } from './webSocketService';
import { pluginHotReloader } from './pluginHotReloader';
import { kernelProcessor } from './kernelProcessor';
import { MemoryNode, MemoryType } from '../types';

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  timestamp: number;
}

interface TestSuite {
  name: string;
  tests: Array<() => Promise<TestResult>>;
}

export class TestingFramework {
  private static instance: TestingFramework;
  private testResults: TestResult[] = [];
  private testSuites: TestSuite[] = [];

  private constructor() {
    this.initializeTestSuites();
  }

  public static getInstance(): TestingFramework {
    if (!TestingFramework.instance) {
      TestingFramework.instance = new TestingFramework();
    }
    return TestingFramework.instance;
  }

  /**
   * Initialize all test suites
   */
  private initializeTestSuites(): void {
    this.testSuites.push(this.createCacheServiceTests());
    this.testSuites.push(this.createSecurityServiceTests());
    this.testSuites.push(this.createResilienceServiceTests());
    this.testSuites.push(this.createAdvancedMemoryServiceTests());
    this.testSuites.push(this.createPredictiveServiceTests());
    this.testSuites.push(this.createPerformanceMonitoringServiceTests());
    this.testSuites.push(this.createKernelProcessorTests());
    
    logger.log('SYSTEM', `Initialized ${this.testSuites.length} test suites`, 'info');
  }

  /**
   * Create cache service tests
   */
  private createCacheServiceTests(): TestSuite {
    return {
      name: 'Cache Service Tests',
      tests: [
        async () => {
          const start = Date.now();
          try {
            // Test basic set/get
            const key = 'test-key';
            const value = 'test-value';
            
            cacheService.set(key, value, 10000); // 10 second TTL
            const retrieved = cacheService.get(key);
            
            if (retrieved !== value) {
              throw new Error(`Expected ${value}, got ${retrieved}`);
            }
            
            // Test expiration
            cacheService.set('expiring-key', 'expiring-value', 10); // 10ms TTL
            await new Promise(resolve => setTimeout(resolve, 20)); // Wait for expiration
            
            const expired = cacheService.get('expiring-key');
            if (expired !== null) {
              throw new Error(`Expected null after expiration, got ${expired}`);
            }
            
            return {
              testName: 'Cache Service - Basic Operations',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Cache Service - Basic Operations',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        },
        async () => {
          const start = Date.now();
          try {
            // Test tagging functionality
            cacheService.set('tagged-item-1', 'value1', 10000, ['test-tag', 'important']);
            cacheService.set('tagged-item-2', 'value2', 10000, ['test-tag', 'normal']);
            
            const keysWithTag = cacheService.getKeysByTag('test-tag');
            if (keysWithTag.length !== 2) {
              throw new Error(`Expected 2 keys with test-tag, got ${keysWithTag.length}`);
            }
            
            // Test deletion by tag
            const deletedCount = cacheService.deleteByTag('important');
            if (deletedCount !== 1) {
              throw new Error(`Expected 1 deletion, got ${deletedCount}`);
            }
            
            return {
              testName: 'Cache Service - Tagging Operations',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Cache Service - Tagging Operations',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      ]
    };
  }

  /**
   * Create security service tests
   */
  private createSecurityServiceTests(): TestSuite {
    return {
      name: 'Security Service Tests',
      tests: [
        async () => {
          const start = Date.now();
          try {
            // Test JWT generation and verification
            const token = securityService.generateToken('test-user', ['user'], ['read', 'write'], 1);
            const decoded = securityService.verifyToken(token);
            
            if (!decoded || decoded.userId !== 'test-user') {
              throw new Error(`Token verification failed: ${JSON.stringify(decoded)}`);
            }
            
            // Test expiration
            await new Promise(resolve => setTimeout(resolve, 70000)); // Wait for expiration
            const expired = securityService.verifyToken(token);
            if (expired !== null) {
              throw new Error(`Expected null for expired token, got ${JSON.stringify(expired)}`);
            }
            
            return {
              testName: 'Security Service - JWT Operations',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Security Service - JWT Operations',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        },
        async () => {
          const start = Date.now();
          try {
            // Test permission checking
            const context = {
              userId: 'test-user',
              roles: ['user'],
              permissions: ['read'],
              resource: 'memory:read',
              action: 'read',
              timestamp: Date.now()
            };
            
            const hasPermission = await securityService.checkPermission(context);
            if (!hasPermission) {
              throw new Error(`Expected permission to be granted`);
            }
            
            return {
              testName: 'Security Service - Permission Checking',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Security Service - Permission Checking',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      ]
    };
  }

  /**
   * Create resilience service tests
   */
  private createResilienceServiceTests(): TestSuite {
    return {
      name: 'Resilience Service Tests',
      tests: [
        async () => {
          const start = Date.now();
          try {
            // Test circuit breaker
            let callCount = 0;
            const failingOperation = async () => {
              callCount++;
              if (callCount <= 3) {
                throw new Error('Simulated failure');
              }
              return 'success';
            };
            
            const config = {
              failureThreshold: 3,
              resetTimeout: 1000,
              timeout: 5000,
              fallback: () => 'fallback-result'
            };
            
            // First 3 calls should fail and trip the circuit
            for (let i = 0; i < 3; i++) {
              try {
                await resilienceService.withCircuitBreaker('test-op', failingOperation, config);
              } catch (e) {
                // Expected to fail
              }
            }
            
            // Check that circuit is now open
            const status = resilienceService.getCircuitStatus('test-op');
            if (status.state !== 'OPEN') {
              throw new Error(`Expected circuit to be OPEN, got ${status.state}`);
            }
            
            // Wait for reset timeout and try again
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            // Next call should go to half-open state
            try {
              await resilienceService.withCircuitBreaker('test-op', async () => 'success', config);
            } catch (e) {
              // This is expected if the circuit is still open
            }
            
            return {
              testName: 'Resilience Service - Circuit Breaker',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Resilience Service - Circuit Breaker',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        },
        async () => {
          const start = Date.now();
          try {
            // Test retry mechanism
            let attemptCount = 0;
            const flakyOperation = async () => {
              attemptCount++;
              if (attemptCount < 3) {
                throw new Error('Simulated intermittent failure');
              }
              return 'success-after-retries';
            };
            
            const result = await resilienceService.withRetry(flakyOperation, 5, 100, 1000);
            if (result !== 'success-after-retries') {
              throw new Error(`Expected 'success-after-retries', got ${result}`);
            }
            
            if (attemptCount !== 3) {
              throw new Error(`Expected 3 attempts, got ${attemptCount}`);
            }
            
            return {
              testName: 'Resilience Service - Retry Mechanism',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Resilience Service - Retry Mechanism',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      ]
    };
  }

  /**
   * Create advanced memory service tests
   */
  private createAdvancedMemoryServiceTests(): TestSuite {
    return {
      name: 'Advanced Memory Service Tests',
      tests: [
        async () => {
          const start = Date.now();
          try {
            // Test memory storage and retrieval
            const testNode: MemoryNode = {
              id: 'test-memory-node',
              content: 'This is a test memory entry',
              type: 'FACT',
              tags: ['test', 'fact'],
              created: Date.now()
            };
            
            await advancedMemoryService.store(testNode);
            const retrieved = await advancedMemoryService.getById('test-memory-node');
            
            if (!retrieved || retrieved.content !== testNode.content) {
              throw new Error(`Memory retrieval failed`);
            }
            
            // Test recall functionality
            const searchResults = await advancedMemoryService.recall('test memory');
            if (searchResults.length === 0) {
              throw new Error(`Memory recall failed`);
            }
            
            return {
              testName: 'Advanced Memory Service - Storage and Retrieval',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Advanced Memory Service - Storage and Retrieval',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        },
        async () => {
          const start = Date.now();
          try {
            // Test identity storage
            await advancedMemoryService.storeIdentity('John Doe is the user');
            const identity = await advancedMemoryService.getUserIdentity();
            
            if (!identity || !identity.content.includes('John Doe')) {
              throw new Error(`Identity storage/retrieval failed`);
            }
            
            return {
              testName: 'Advanced Memory Service - Identity Operations',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Advanced Memory Service - Identity Operations',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      ]
    };
  }

  /**
   * Create predictive service tests
   */
  private createPredictiveServiceTests(): TestSuite {
    return {
      name: 'Predictive Service Tests',
      tests: [
        async () => {
          const start = Date.now();
          try {
            // Test interaction recording
            predictiveService.recordInteraction('test-user', 'ask_weather', 'weather query', 'success');
            predictiveService.recordInteraction('test-user', 'turn_lights', 'light control', 'success');
            
            const interactions = predictiveService.getUserInteractions('test-user');
            if (interactions.length < 2) {
              throw new Error(`Expected at least 2 interactions, got ${interactions.length}`);
            }
            
            // Test prediction
            const prediction = predictiveService.predictNextAction('test-user', {
              topics: ['weather', 'query'],
              sentiment: 'neutral',
              timeOfDay: 12
            });
            
            if (!prediction) {
              throw new Error(`Prediction should not be null`);
            }
            
            return {
              testName: 'Predictive Service - Recording and Prediction',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Predictive Service - Recording and Prediction',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        },
        async () => {
          const start = Date.now();
          try {
            // Test suggestion generation
            predictiveService.generateSuggestion('test-user', 'suggest_umbrella', 0.8, 'weather context');
            predictiveService.generateSuggestion('test-user', 'suggest_jacket', 0.6, 'weather context');
            
            const suggestions = predictiveService.getSuggestions({
              currentTopic: 'weather',
              sentiment: 'neutral',
              timeOfDay: 12
            });
            
            if (suggestions.length === 0) {
              throw new Error(`Expected suggestions to be generated`);
            }
            
            return {
              testName: 'Predictive Service - Suggestions',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Predictive Service - Suggestions',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      ]
    };
  }

  /**
   * Create performance monitoring service tests
   */
  private createPerformanceMonitoringServiceTests(): TestSuite {
    return {
      name: 'Performance Monitoring Service Tests',
      tests: [
        async () => {
          const start = Date.now();
          try {
            // Test metric recording
            performanceMonitoringService.recordMetric('test_metric', 100, 'count', { category: 'test' });
            performanceMonitoringService.recordMetric('test_metric', 200, 'count', { category: 'test' });
            
            const recentMetrics = performanceMonitoringService.getRecentMetrics('test_metric', 5);
            if (recentMetrics.length === 0) {
              throw new Error(`Expected metrics to be recorded`);
            }
            
            // Test aggregation
            const aggregated = performanceMonitoringService.getAggregatedMetrics('test_metric', 60000, 'avg');
            if (!aggregated || aggregated.value !== 150) { // Average of 100 and 200
              throw new Error(`Expected aggregated value of 150, got ${aggregated?.value}`);
            }
            
            return {
              testName: 'Performance Monitoring Service - Metrics',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Performance Monitoring Service - Metrics',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        },
        async () => {
          const start = Date.now();
          try {
            // Test tracing
            const spanId = performanceMonitoringService.startTrace('test_operation', undefined, { test: 'true' });
            await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
            performanceMonitoringService.endTrace(spanId);
            
            const span = performanceMonitoringService.getTraceSpanById(spanId);
            if (!span || !span.duration || span.duration < 10) {
              throw new Error(`Trace span not properly recorded or duration incorrect`);
            }
            
            return {
              testName: 'Performance Monitoring Service - Tracing',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Performance Monitoring Service - Tracing',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      ]
    };
  }

  /**
   * Create kernel processor tests
   */
  private createKernelProcessorTests(): TestSuite {
    return {
      name: 'Kernel Processor Tests',
      tests: [
        async () => {
          const start = Date.now();
          try {
            // Test that kernel processor exists and has required methods
            if (!kernelProcessor || typeof kernelProcessor.processRequest !== 'function') {
              throw new Error(`Kernel processor missing required methods`);
            }
            
            // This is a basic existence test; actual functionality would require more complex mocking
            return {
              testName: 'Kernel Processor - Existence',
              passed: true,
              duration: Date.now() - start,
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              testName: 'Kernel Processor - Existence',
              passed: false,
              duration: Date.now() - start,
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      ]
    };
  }

  /**
   * Run all tests
   */
  public async runAllTests(): Promise<TestResult[]> {
    this.testResults = []; // Reset results
    logger.log('SYSTEM', 'Starting all tests...', 'info');

    for (const suite of this.testSuites) {
      logger.log('SYSTEM', `Running test suite: ${suite.name}`, 'info');
      
      for (const test of suite.tests) {
        const result = await test();
        this.testResults.push(result);
        
        if (result.passed) {
          logger.log('SYSTEM', `✓ ${result.testName}`, 'success');
        } else {
          logger.log('SYSTEM', `✗ ${result.testName} - ${result.error}`, 'error');
        }
      }
    }

    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    logger.log('SYSTEM', `Tests completed: ${passed}/${total} passed`, passed === total ? 'success' : 'warning');

    return [...this.testResults];
  }

  /**
   * Run tests for a specific suite
   */
  public async runSuite(suiteName: string): Promise<TestResult[]> {
    const suite = this.testSuites.find(s => s.name === suiteName);
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteName}`);
    }

    logger.log('SYSTEM', `Running test suite: ${suite.name}`, 'info');
    const results: TestResult[] = [];

    for (const test of suite.tests) {
      const result = await test();
      results.push(result);
      this.testResults.push(result);

      if (result.passed) {
        logger.log('SYSTEM', `✓ ${result.testName}`, 'success');
      } else {
        logger.log('SYSTEM', `✗ ${result.testName} - ${result.error}`, 'error');
      }
    }

    return results;
  }

  /**
   * Get test results
   */
  public getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * Get test statistics
   */
  public getStats(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    totalDuration: number;
    testSuites: number;
  } {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;
    const successRate = total > 0 ? (passed / total) * 100 : 0;
    const totalDuration = this.testResults.reduce((sum, result) => sum + result.duration, 0);

    return {
      totalTests: total,
      passedTests: passed,
      failedTests: failed,
      successRate,
      totalDuration,
      testSuites: this.testSuites.length
    };
  }

  /**
   * Run performance benchmarks
   */
  public async runPerformanceBenchmarks(): Promise<void> {
    logger.log('SYSTEM', 'Running performance benchmarks...', 'info');

    // Benchmark cache operations
    const cacheStart = Date.now();
    for (let i = 0; i < 1000; i++) {
      cacheService.set(`benchmark-key-${i}`, `value-${i}`, 60000);
      cacheService.get(`benchmark-key-${i}`);
    }
    const cacheDuration = Date.now() - cacheStart;
    logger.log('SYSTEM', `Cache benchmark (1000 ops): ${cacheDuration}ms`, 'info');

    // Benchmark memory operations
    const memoryStart = Date.now();
    for (let i = 0; i < 100; i++) {
      const node: MemoryNode = {
        id: `benchmark-node-${i}`,
        content: `Benchmark content ${i}`,
        type: 'FACT',
        tags: ['benchmark'],
        created: Date.now()
      };
      await advancedMemoryService.store(node);
      await advancedMemoryService.getById(node.id);
    }
    const memoryDuration = Date.now() - memoryStart;
    logger.log('SYSTEM', `Memory benchmark (100 ops): ${memoryDuration}ms`, 'info');

    // Benchmark predictive operations
    const predictiveStart = Date.now();
    for (let i = 0; i < 50; i++) {
      predictiveService.recordInteraction('benchmark-user', `action-${i}`, `context-${i}`, 'success');
      predictiveService.predictNextAction('benchmark-user', { topics: [`topic-${i}`] });
    }
    const predictiveDuration = Date.now() - predictiveStart;
    logger.log('SYSTEM', `Predictive benchmark (50 ops): ${predictiveDuration}ms`, 'info');

    logger.log('SYSTEM', 'Performance benchmarks completed', 'info');
  }

  /**
   * Generate test report
   */
  public generateReport(): string {
    const stats = this.getStats();
    const report = `
JARVIS Kernel v1.4.0 - Test Report
=================================

Execution Summary:
- Total Tests: ${stats.totalTests}
- Passed: ${stats.passedTests}
- Failed: ${stats.failedTests}
- Success Rate: ${stats.successRate.toFixed(2)}%
- Total Duration: ${stats.totalDuration}ms
- Test Suites: ${stats.testSuites}

Detailed Results:
`;

    const groupedResults = this.testResults.reduce((acc, result) => {
      const suiteName = this.testSuites.find(suite => 
        suite.tests.some(test => 
          test.toString().includes(result.testName.replace(' -', ''))
        )
      )?.name || 'Unknown Suite';
      
      if (!acc[suiteName]) {
        acc[suiteName] = [];
      }
      acc[suiteName].push(result);
      return acc;
    }, {} as Record<string, TestResult[]>);

    for (const [suiteName, results] of Object.entries(groupedResults)) {
      const passed = results.filter(r => r.passed).length;
      const total = results.length;
      report += `\n${suiteName} (${passed}/${total} passed):\n`;
      
      for (const result of results) {
        const status = result.passed ? 'PASS' : 'FAIL';
        report += `  ${status}: ${result.testName} (${result.duration}ms)\n`;
        if (!result.passed) {
          report += `      Error: ${result.error}\n`;
        }
      }
    }

    return report;
  }
}

// Export singleton instance
export const testingFramework = TestingFramework.getInstance();

// Initialize testing framework when module loads
logger.log('SYSTEM', 'Testing framework initialized', 'info');