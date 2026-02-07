#!/usr/bin/env node
// @ts-check
/**
 * JARVIS Launcher v2.0 - Auto-Restart Service Manager
 * Manages all services with automatic restart on crash/hang
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');

const PORTS = [3000, 3100, 3101, 5000];
const SERVICES = {
  hardware: { port: 3100, name: 'Hardware Monitor', maxRestarts: 5, healthUrl: 'http://localhost:3100/health' },
  proxy: { port: 3101, name: 'HA Proxy', maxRestarts: 5, healthUrl: 'http://localhost:3101/health' },
  piper: { port: 5000, name: 'Piper TTS', maxRestarts: 3, healthUrl: null }, // No HTTP endpoint
  vite: { port: 3000, name: 'Vite', maxRestarts: 3, healthUrl: 'http://localhost:3000' }
};

// Service state tracking
const serviceState = {
  hardware: { process: null, restarts: 0, lastRestart: 0, healthy: false, starting: false, failCount: 0 },
  proxy: { process: null, restarts: 0, lastRestart: 0, healthy: false, starting: false, failCount: 0 },
  piper: { process: null, restarts: 0, lastRestart: 0, healthy: false, starting: false, failCount: 0 },
  vite: { process: null, restarts: 0, lastRestart: 0, healthy: false, starting: false, failCount: 0 }
};

let browserProcess = null;
let healthCheckInterval = null;
let shuttingDown = false;

// Check if port is in use (service is listening)
function isPortListening(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(1000);
    client.once('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.once('error', () => resolve(false));
    client.once('timeout', () => {
      client.destroy();
      resolve(false);
    });
    client.connect(port, '127.0.0.1');
  });
}

// Kill process by port
async function killPort(port) {
  return new Promise((resolve) => {
    const cmd = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`;
    const check = spawn('cmd', ['/c', cmd], { windowsHide: true });
    check.on('close', () => resolve());
    check.on('error', () => resolve());
  });
}

// Health check - test if service is responding
async function healthCheck(serviceName) {
  const config = SERVICES[serviceName];

  // For services without HTTP endpoints, just check if port is listening
  if (!config.healthUrl) {
    return await isPortListening(config.port);
  }

  // For HTTP services, do a proper HTTP check
  return new Promise((resolve) => {
    const req = http.get(config.healthUrl, { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Check all services health
async function checkAllServicesHealth() {
  for (const serviceName of Object.keys(SERVICES)) {
    const state = serviceState[serviceName];

    // Skip if currently starting up (give 15 seconds grace period)
    if (state.starting && (Date.now() - state.lastRestart < 15000)) {
      continue;
    }

    const isHealthy = await healthCheck(serviceName);
    const wasHealthy = state.healthy;

    // Require 3 consecutive failures before marking unhealthy (except for startup)
    if (!isHealthy) {
      state.failCount++;
      if (state.failCount >= 3 && wasHealthy) {
        state.healthy = false;
        console.log(`[HEALTH] ${SERVICES[serviceName].name} became unhealthy (${state.failCount} consecutive failures)`);
      }
    } else {
      state.failCount = 0;
      if (!wasHealthy) {
        state.healthy = true;
        state.starting = false;
        console.log(`[HEALTH] ${SERVICES[serviceName].name} is now healthy`);
      }
    }
  }
}

// Restart a service
async function restartService(serviceName) {
  const state = serviceState[serviceName];
  const config = SERVICES[serviceName];

  if (shuttingDown) return;

  // Check restart limit
  if (state.restarts >= config.maxRestarts) {
    if (state.restarts === config.maxRestarts) {
      console.error(`[RESTART] ${config.name} exceeded max restarts (${config.maxRestarts}). Giving up.`);
      state.restarts++; // Increment so we only log this once
    }
    return;
  }

  // Prevent restart spam (min 5 seconds between restarts)
  const now = Date.now();
  if (now - state.lastRestart < 5000) {
    await new Promise(r => setTimeout(r, 5000));
  }

  state.restarts++;
  state.lastRestart = now;
  state.starting = true;
  console.log(`[RESTART] Starting ${config.name} (attempt ${state.restarts}/${config.maxRestarts})...`);

  // Kill existing process on port
  await killPort(config.port);
  await new Promise(r => setTimeout(r, 1000));

  // Start new process
  startService(serviceName);
}

// Start individual service
function startService(serviceName) {
  const config = SERVICES[serviceName];
  let proc;

  switch (serviceName) {
    case 'hardware':
      proc = spawn('cmd', ['/c', 'node server/hardware-monitor.cjs'], {
        cwd: __dirname,
        windowsHide: false
      });
      break;
    case 'proxy':
      proc = spawn('cmd', ['/c', 'node server/proxy.js'], {
        cwd: __dirname,
        windowsHide: false
      });
      break;
    case 'piper':
      proc = spawn('cmd', ['/c', 'python piper_server.py'], {
        cwd: path.join(__dirname, 'Piper'),
        windowsHide: false
      });
      break;
    case 'vite':
      proc = spawn('cmd', ['/c', 'npx vite --config vite.config.fast.ts'], {
        cwd: __dirname,
        windowsHide: false,
        env: { ...process.env, FORCE_COLOR: '1' }
      });
      // Log Vite output
      proc.stdout.on('data', (data) => {
        const str = data.toString();
        if (str.includes('error') || str.includes('Error')) {
          console.error('[Vite]', str.trim());
        }
      });
      proc.stderr.on('data', (data) => {
        console.error('[Vite]', data.toString().trim());
      });
      break;
  }

  if (proc) {
    serviceState[serviceName].process = proc;

    proc.on('error', (err) => {
      console.error(`[${config.name} Error]`, err.message);
      if (!shuttingDown) {
        restartService(serviceName);
      }
    });

    proc.on('exit', (code, signal) => {
      if (shuttingDown) return;

      // Only restart if process actually exited abnormally
      if (code !== 0 && code !== null) {
        console.error(`[${config.name} Exit] Code ${code}, Signal ${signal}`);
        restartService(serviceName);
      }
    });

    console.log(`[START] ${config.name} started on port ${config.port}`);
  }

  return proc;
}

// Kill all JARVIS processes
async function shutdown() {
  shuttingDown = true;
  console.log('\n[SHUTDOWN] Stopping JARVIS services...');

  // Stop health checks
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Kill by port
  for (const port of PORTS) {
    await killPort(port);
  }

  // Kill browser
  if (browserProcess) {
    try { browserProcess.kill(); } catch(e) {}
  }

  // Kill tracked processes
  for (const [name, state] of Object.entries(serviceState)) {
    if (state.process) {
      try { state.process.kill(); } catch(e) {}
    }
  }

  // Kill window titles
  spawn('cmd', ['/c', 'taskkill /F /FI "WINDOWTITLE eq JARVIS-*" >nul 2>&1'], { windowsHide: true });

  console.log('[SHUTDOWN] Complete');
  process.exit(0);
}

// Cleanup on exit
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  console.log('[EXIT] Cleaning up...');
});

// Start all services
async function startServices() {
  console.log('[START] Starting JARVIS services...\n');

  // Cleanup first
  console.log('[INIT] Cleaning up existing processes...');
  for (const port of PORTS) {
    await killPort(port);
  }
  await new Promise(r => setTimeout(r, 3000));

  // Start all services
  for (const serviceName of Object.keys(SERVICES)) {
    serviceState[serviceName].starting = true;
    serviceState[serviceName].lastRestart = Date.now();
    startService(serviceName);
    await new Promise(r => setTimeout(r, 500)); // Stagger starts
  }

  // Wait for Vite
  console.log('\n[WAIT] Waiting for Vite to be ready...');
  let ready = false;
  let attempts = 0;

  while (!ready && attempts < 90) {
    await new Promise(r => setTimeout(r, 1000));
    attempts++;

    // Check if Vite crashed
    const viteProc = serviceState.vite.process;
    if (viteProc && viteProc.exitCode !== null) {
      console.error(`\n[ERROR] Vite crashed with code ${viteProc.exitCode}`);
      console.log('[INFO] Check the Vite window for error details');
      console.log('[INFO] Press Ctrl+C to exit\n');
      break;
    }

    // Check if Vite is responding
    if (await isPortListening(3000)) {
      ready = true;
      serviceState.vite.healthy = true;
      serviceState.vite.starting = false;
    }
  }

  if (ready) {
    console.log(`[OK] Vite ready in ${attempts} seconds\n`);
  } else {
    console.log('[WARN] Vite timeout, continuing anyway...\n');
  }

  // Start health check polling (every 15 seconds - less aggressive)
  healthCheckInterval = setInterval(async () => {
    await checkAllServicesHealth();

    // Restart unhealthy services that have exited
    for (const [name, state] of Object.entries(serviceState)) {
      const proc = state.process;
      const hasExited = proc && proc.exitCode !== null;
      const isNotResponding = !state.healthy && !state.starting;

      // Only restart if process has actually exited OR has been unhealthy for a while
      // Vite gets extra grace period (120s) since it can be busy during HMR
      const gracePeriod = (name === 'vite') ? 120000 : 30000;
      if ((hasExited || (isNotResponding && (Date.now() - state.lastRestart > gracePeriod)))) {
        console.log(`[HEALTH] ${SERVICES[name].name} needs restart`);
        if (proc && !proc.killed) {
          try { proc.kill(); } catch(e) {}
        }
        await restartService(name);
      }
    }
  }, 15000);

  // Launch browser with loading page first
  console.log('[LAUNCH] Opening browser with boot sequence...');
  const loadingPage = path.join(__dirname, 'loading.html');
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ];

  let chromePath = chromePaths.find(p => fs.existsSync(p));

  if (chromePath) {
    browserProcess = spawn(chromePath, [`--app=file:///${loadingPage.replace(/\\/g, '/')}`, '--window-size=1920,1080'], {
      windowsHide: false,
      detached: false
    });
  } else {
    browserProcess = spawn('msedge', [`--app=file:///${loadingPage.replace(/\\/g, '/')}`, '--window-size=1920,1080'], {
      windowsHide: false,
      detached: false
    });
  }

  browserProcess.on('exit', () => {
    console.log('[BROWSER] Browser closed');
  });

  console.log('\n========================================');
  console.log(' JARVIS is Running!');
  console.log('========================================');
  console.log('\nServices (auto-restart enabled):');
  for (const [name, config] of Object.entries(SERVICES)) {
    console.log(`  • ${config.name} :${config.port} (max ${config.maxRestarts} restarts)`);
  }
  console.log('\nUse the Exit button in the UI or press Ctrl+C to stop\n');
}

// Create shutdown HTTP server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/shutdown' && req.method === 'POST') {
    console.log('[API] Shutdown requested from UI');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'shutting_down' }));
    setTimeout(shutdown, 500);
    return;
  }

  if (req.url === '/api/status' && req.method === 'GET') {
    const status = {};
    for (const [name, state] of Object.entries(serviceState)) {
      const proc = state.process;
      status[name] = {
        healthy: state.healthy,
        restarts: state.restarts,
        running: proc ? proc.exitCode === null : false,
        starting: state.starting
      };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(9999, () => {
  console.log('[LAUNCHER v2.0] Shutdown API listening on port 9999\n');
  startServices();
});
