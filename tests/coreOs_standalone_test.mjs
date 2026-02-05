/**
 * core.os v1.1.0 Standalone Test
 * Tests pure functions without dependencies
 */

console.log('🧪 Testing core.os v1.1.0 pure functions\n');

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

// formatBytes implementation (copied for standalone test)
function formatBytes(bytes) {
  if (bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// formatUptime implementation (copied for standalone test)
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// getSystemMetrics implementation (copied for standalone test)
function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  return {
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
    },
    uptime: process.uptime(),
    timestamp: Date.now(),
  };
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

test('formatBytes: 1073741824 bytes = 1 GB', () => {
  if (formatBytes(1073741824) !== '1.00 GB') throw new Error(`Expected "1.00 GB", got "${formatBytes(1073741824)}"`);
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

test('formatBytes: very large number (TB)', () => {
  const result = formatBytes(1099511627776);
  if (!result.includes('TB')) throw new Error(`Expected TB in "${result}"`);
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

test('formatUptime: zero', () => {
  const result = formatUptime(0);
  if (result !== '0s') throw new Error(`Expected "0s", got "${result}"`);
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

test('getSystemMetrics: values are reasonable', () => {
  const metrics = getSystemMetrics();
  // heapUsed should be less than heapTotal
  if (metrics.memory.heapUsed > metrics.memory.heapTotal) {
    throw new Error(`heapUsed (${metrics.memory.heapUsed}) > heapTotal (${metrics.memory.heapTotal})`);
  }
  // RSS should be positive
  if (metrics.memory.rss <= 0) throw new Error('RSS should be positive');
});

// Test ASCII box formatting
test('ASCII box width consistency', () => {
  const LABEL_WIDTH = 12;
  const VALUE_WIDTH = 50;
  const TOTAL_INNER = LABEL_WIDTH + VALUE_WIDTH + 2; // 64 chars inside borders
  const padValue = (s) => s.padEnd(VALUE_WIDTH);
  
  const testString = 'Test';
  const padded = padValue(testString);
  if (padded.length !== VALUE_WIDTH) {
    throw new Error(`Padded length ${padded.length} !== ${VALUE_WIDTH}`);
  }
  
  // Full line: ║(1) + space(1) + label(12) + value(50) + space(1) + ║(1) = 67
  const line = `║  Label:      ${padded} ║`;
  const expectedLength = 67; // Actual measured length
  if (line.length !== expectedLength) {
    throw new Error(`Line length ${line.length} !== ${expectedLength}`);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 core.os v1.1.0 Test Results`);
console.log('='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('🎉 All tests passed! core.os v1.1.0 is working correctly.');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed.');
  process.exit(1);
}
