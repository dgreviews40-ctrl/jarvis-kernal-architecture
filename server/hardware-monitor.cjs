/**
 * JARVIS Hardware Monitor Backend
 * Fetches real Windows system stats matching Task Manager
 */

const http = require('http');
const { exec, execSync } = require('child_process');
const os = require('os');

const PORT = 3100;
const startTime = Date.now();

let currentStats = {
  cpuLoad: 0,
  memoryUsage: 0,
  memoryUsedGB: 0,
  memoryTotalGB: 0,
  gpuLoad: 0,
  gpuMemoryUsage: 0,
  gpuTemperature: 0,
  cpuTemperature: 0,
  uptime: 0,
  cpuName: '',
  gpuName: '',
  lastUpdate: Date.now()
};

// CPU tracking for accurate calculation
let prevCpuTimes = null;
let prevTimestamp = null;


/**
 * Get Memory usage
 */
function getMemoryUsage() {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      usagePercent: Math.round((used / total) * 100),
      usedGB: Math.round((used / 1024 / 1024 / 1024) * 10) / 10,
      totalGB: Math.round((total / 1024 / 1024 / 1024) * 10) / 10
    };
  } catch (e) {
    console.error('Memory error:', e.message);
    return { usagePercent: 0, usedGB: 0, totalGB: 0 };
  }
}

/**
 * Get CPU Temperature via WMI (Windows)
 * Note: This requires compatible hardware sensors and may not work on all systems
 */
function getCPUTemperature() {
  try {
    // Try MSAcpi_ThermalZoneTemperature first (works on some laptops)
    const result = execSync(
      'wmic /namespace:\\\\\root\\\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature /value 2>nul',
      { encoding: 'utf8', timeout: 5000 }
    );
    const match = result.match(/CurrentTemperature=(\d+)/);
    if (match) {
      // Value is in tenths of Kelvin, convert to Celsius
      const tempKelvinTenths = parseInt(match[1]);
      return Math.round((tempKelvinTenths / 10) - 273.15);
    }
  } catch (e) {
    // Silent fail - not all systems support this
  }

  try {
    // Try Win32_TemperatureProbe as fallback
    const result = execSync(
      'wmic PATH Win32_TemperatureProbe get CurrentReading /value 2>nul',
      { encoding: 'utf8', timeout: 5000 }
    );
    const match = result.match(/CurrentReading=(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  } catch (e) {
    // Silent fail
  }

  // CPU temperature monitoring requires hardware sensors that may not be available
  // Common alternatives: OpenHardwareMonitor, LibreHardwareMonitor, or HWiNFO
  return 0;
}

/**
 * Get GPU stats via nvidia-smi
 */
function getGPUUsage() {
  try {
    const result = execSync(
      'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,name --format=csv,noheader,nounits',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    const lines = result.split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) {
      return { load: 0, memoryUsage: 0, temperature: 0, name: 'Unknown GPU' };
    }

    const parts = lines[0].split(',').map(s => s.trim());
    return {
      load: parseInt(parts[0]) || 0,
      memoryUsage: Math.round((parseFloat(parts[1]) / parseFloat(parts[2])) * 100) || 0,
      temperature: parseInt(parts[3]) || 0,
      name: parts[4] || 'NVIDIA GPU'
    };
  } catch (e) {
    // Log the error for debugging but return default values
    console.warn('GPU monitoring error (this is normal if no NVIDIA GPU):', e.message);
    return { load: 0, memoryUsage: 0, temperature: 0, name: 'Unknown GPU' };
  }
}

/**
 * Get CPU Name
 */
function getCPUName() {
  try {
    const cpus = os.cpus();
    return cpus[0]?.model || 'Unknown CPU';
  } catch (e) {
    return 'Unknown CPU';
  }
}

/**
 * Get CPU usage using WMIC (Windows Management Instrumentation Command-line)
 * This is a more reliable method on Windows systems
 */
function getCPUUsage() {
  try {
    const { execSync } = require('child_process');

    // Use WMIC to get CPU load percentage
    const result = execSync('wmic cpu get LoadPercentage /value', { encoding: 'utf8', timeout: 3000 });

    // Parse the output to extract the LoadPercentage value
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('LoadPercentage=')) {
        const value = parseInt(line.split('=')[1].trim());
        if (!isNaN(value) && value >= 0 && value <= 100) {
          return value;
        }
      }
    }

    // If WMIC parsing fails, return 0
    console.warn('WMIC CPU LoadPercentage parsing failed, returning 0');
    return 0;
  } catch (e) {
    console.warn('WMIC command failed, falling back to time-based calculation:', e.message);

    // Fallback to time-based calculation
    try {
      const cpus = os.cpus();
      let totalUser = 0;
      let totalSys = 0;
      let totalIdle = 0;

      for (const cpu of cpus) {
        totalUser += cpu.times.user;
        totalSys += cpu.times.sys;
        totalIdle += cpu.times.idle;
      }

      const totalActive = totalUser + totalSys;
      const totalTime = totalActive + totalIdle;

      const currentTimestamp = Date.now();

      if (prevCpuTimes && prevTimestamp) {
        const activeDiff = (totalUser + totalSys) - (prevCpuTimes.user + prevCpuTimes.sys);
        const idleDiff = totalIdle - prevCpuTimes.idle;
        const totalDiff = activeDiff + idleDiff;

        let usage = 0;
        if (totalDiff > 0) {
          usage = Math.min(100, Math.max(0, (activeDiff / totalDiff) * 100));
        }

        prevCpuTimes = { user: totalUser, sys: totalSys, idle: totalIdle };
        prevTimestamp = currentTimestamp;

        return Math.round(usage);
      } else {
        prevCpuTimes = { user: totalUser, sys: totalSys, idle: totalIdle };
        prevTimestamp = currentTimestamp;
        return 0;
      }
    } catch (err) {
      console.error('Fallback CPU calculation also failed:', err.message);
      return 0;
    }
  }
}

/**
 * Update all stats
 */
function updateStats() {
  try {
    const cpu = getCPUUsage();
    const memory = getMemoryUsage();
    const gpu = getGPUUsage();
    const cpuTemp = getCPUTemperature();
    const jarvisUptime = Math.floor((Date.now() - startTime) / 1000);

    currentStats = {
      cpuLoad: cpu,
      memoryUsage: memory.usagePercent,
      memoryUsedGB: memory.usedGB,
      memoryTotalGB: memory.totalGB,
      gpuLoad: gpu.load,
      gpuMemoryUsage: gpu.memoryUsage,
      gpuName: gpu.name,
      gpuTemperature: gpu.temperature,
      cpuTemperature: cpuTemp,
      uptime: jarvisUptime,
      cpuName: currentStats.cpuName,
      lastUpdate: Date.now()
    };
  } catch (e) {
    console.error('Stats update error:', e);
  }
}

/**
 * Initialize
 */
function initialize() {
  console.log('[HARDWARE MONITOR] Starting...');
  currentStats.cpuName = getCPUName();
  const gpu = getGPUUsage();
  currentStats.gpuName = gpu.name;
  console.log(`[HARDWARE MONITOR] CPU: ${currentStats.cpuName}`);
  console.log(`[HARDWARE MONITOR] GPU: ${currentStats.gpuName}`);

  // Initial CPU samples - need two samples to calculate usage
  getCPUUsage(); // First sample
  setTimeout(() => {
    getCPUUsage(); // Second sample to enable calculation
    console.log('[HARDWARE MONITOR] CPU usage monitoring initialized');
  }, 100);

  // Start polling every 2 seconds to allow for more accurate CPU usage calculation
  setInterval(() => {
    try {
      updateStats();
    } catch (error) {
      console.error('Error in stats update loop:', error);
    }
  }, 2000);
  console.log('[HARDWARE MONITOR] Polling started (2s interval)');
}

/**
 * HTTP Server
 */
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/stats' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(currentStats));
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Export functions for testing
module.exports = {
  getCPUUsage,
  getMemoryUsage,
  getGPUUsage,
  getCPUTemperature,
  getCPUName,
  updateStats
};

// Only start server if this file is run directly (not required as a module)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[HARDWARE MONITOR] Server running at http://localhost:${PORT}`);
    initialize();
  });
}

process.on('SIGINT', () => {
  console.log('\n[HARDWARE MONITOR] Shutting down...');
  server.close();
  process.exit(0);
});
