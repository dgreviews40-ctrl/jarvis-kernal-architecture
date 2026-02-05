/**
 * core.os v1.1.0 Node.js Test (ES Modules)
 * Tests the parts that work in Node environment
 */

import { 
  getSystemMetrics, 
  formatBytes, 
  formatUptime,
  getPluginHealth 
} from '../services/coreOs.ts';

console.log('🧪 Testing core.os v1.1.0 (Node-compatible features)\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// Test formatBytes
test('formatBytes: 0 bytes', () => {
  if (formatBytes(0) !== '0 B') throw new Error(`Expected "0 B", got "${formatBytes(0)}"`);
});

test('formatBytes: 1024 bytes = 1 KB', () => {
  if (formatBytes(1024) !== '1.00 KB') throw new Error(`Expected "1.00 KB", got "${formatBytes(1024)}"`);
});

test('formatBytes: 1048576 bytes = 1 MB', () => {
  if (formatBytes(1048576) !== '1.00 MB') throw new Error(`Expected "1.00 MB", got "${formatBytes(1048576)}"`);
});

test('formatBytes: negative number', () => {
  if (formatBytes(-100) !== '0 B') throw new Error(`Expected "0 B", got "${formatBytes(-100)}"`);
});

test('formatBytes: NaN', () => {
  if (formatBytes(NaN) !== '0 B') throw new Error(`Expected "0 B", got "${formatBytes(NaN)}"`);
});

test('formatBytes: Infinity', () => {
  if (formatBytes(Infinity) !== '0 B') throw new Error(`Expected "0 B", got "${formatBytes(Infinity)}"`);
});

// Test formatUptime
test('formatUptime: hours', () => {
  const result = formatUptime(3661);
  if (!result.includes('1h')) throw new Error(`Expected "1h" in "${result}"`);
});

test('formatUptime: minutes only', () => {
  const result = formatUptime(61);
  if (!result.includes('1m')) throw new Error(`Expected "1m" in "${result}"`);
  if (result.includes('h')) throw new Error(`Should not include hours in "${result}"`);
});

test('formatUptime: seconds only', () => {
  const result = formatUptime(5);
  if (result !== '5s') throw new Error(`Expected "5s", got "${result}"`);
});

// Test getSystemMetrics
test('getSystemMetrics returns valid data', () => {
  const metrics = getSystemMetrics();
  if (!metrics.memory) throw new Error('Missing memory data');
  if (typeof metrics.memory.heapUsed !== 'number') throw new Error('Invalid heapUsed');
  if (typeof metrics.memory.heapTotal !== 'number') throw new Error('Invalid heapTotal');
  if (typeof metrics.memory.rss !== 'number') throw new Error('Invalid rss');
  if (typeof metrics.memory.external !== 'number') throw new Error('Invalid external');
  if (typeof metrics.uptime !== 'number') throw new Error('Invalid uptime');
  if (typeof metrics.timestamp !== 'number') throw new Error('Invalid timestamp');
  if (metrics.timestamp <= 0) throw new Error('Invalid timestamp value');
});

test('getSystemMetrics: heapUsed is positive', () => {
  const metrics = getSystemMetrics();
  if (metrics.memory.heapUsed <= 0) throw new Error('heapUsed should be positive');
});

test('getSystemMetrics: uptime is positive', () => {
  const metrics = getSystemMetrics();
  if (metrics.uptime <= 0) throw new Error('uptime should be positive');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results`);
console.log('='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('🎉 All Node-compatible tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed.');
  process.exit(1);
}
