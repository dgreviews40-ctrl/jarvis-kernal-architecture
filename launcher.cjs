#!/usr/bin/env node
/**
 * JARVIS Master Service Launcher
 * Manages all services and ensures clean shutdown
 */

const { spawn, exec } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
// Find best way to run Vite
function getViteCommand() {
  const viteCmd = path.join(__dirname, 'node_modules', '.bin', 'vite.cmd');
  const viteBin = path.join(__dirname, 'node_modules', '.bin', 'vite');
  const viteJs = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
  
  if (fs.existsSync(viteCmd)) {
    return { cmd: viteCmd, args: ['--config', 'vite.config.fast.ts'] };
  }
  if (fs.existsSync(viteBin)) {
    return { cmd: viteBin, args: ['--config', 'vite.config.fast.ts'] };
  }
  if (fs.existsSync(viteJs)) {
    return { cmd: 'node', args: [viteJs, '--config', 'vite.config.fast.ts'] };
  }
  // Last resort - try npx
  return { cmd: 'npx.cmd', args: ['vite', '--config', 'vite.config.fast.ts'] };
}

const VITE_CFG = getViteCommand();

const CONFIG = {
  vite: {
    port: 3000,
    name: 'Vite Dev Server',
    command: VITE_CFG.cmd,
    args: VITE_CFG.args,
    required: true,
    isMain: true
  },
  hardware: {
    port: 3100,
    name: 'Hardware Monitor',
    command: 'node',
    args: ['server/hardware-monitor.cjs'],
    required: true
  },
  proxy: {
    port: 3101,
    name: 'HA Proxy',
    command: 'node',
    args: ['server/proxy.js'],
    required: true
  },
  piper: {
    port: 5000,
    name: 'Piper TTS',
    command: 'python',
    args: ['Piper/piper_server.py'],
    required: false  // Optional
  },
  whisper: {
    port: 5001,
    name: 'Whisper STT',
    command: 'python',
    args: ['whisper_server.py'],
    required: false  // Optional
  },
  embedding: {
    port: 5002,
    name: 'Embedding Server',
    command: 'python',
    args: ['embedding_server.py'],
    required: false  // Optional
  },
  gpu: {
    port: 5003,
    name: 'GPU Monitor',
    command: 'python',
    args: ['gpu_monitor.py'],
    required: false  // Optional
  },
  vision: {
    port: 5004,
    name: 'Vision Server',
    command: 'python',
    args: ['vision_server.py'],
    required: false  // Optional
  }
};

// ============================================
// STATE
// ============================================
const processes = new Map();
const portsInUse = new Set();
let shuttingDown = false;
let chromeProcess = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function log(msg, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    info: `[${timestamp}] [INFO]`,
    error: `[${timestamp}] [ERROR]`,
    warn: `[${timestamp}] [WARN]`,
    success: `[${timestamp}] [OK]`,
    service: `[${timestamp}] [SERVICE]`
  }[type] || `[${timestamp}] [INFO]`;
  console.log(`${prefix} ${msg}`);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForPort(port, timeout = 30000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkPort(port)) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

function killProcess(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }
    
    // Windows: taskkill /F /T kills process tree
    const killer = spawn('taskkill', ['/F', '/T', '/PID', pid.toString()], {
      windowsHide: true,
      stdio: 'ignore'
    });
    killer.on('close', () => resolve());
    killer.on('error', () => resolve());
    
    // Fallback timeout
    setTimeout(resolve, 2000);
  });
}

async function killPort(port) {
  return new Promise((resolve) => {
    const findCmd = `netstat -ano | findstr ":${port} " | findstr LISTENING`;
    exec(findCmd, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        resolve();
        return;
      }
      
      const pids = [...stdout.matchAll(/\s+(\d+)\s*$/gm)].map(m => m[1]);
      const uniquePids = [...new Set(pids)];
      
      Promise.all(uniquePids.map(pid => killProcess(pid))).then(() => resolve());
    });
  });
}

// ============================================
// SERVICE MANAGEMENT
// ============================================

async function cleanupExisting() {
  log('Cleaning up existing processes...', 'warn');
  
  // Kill by window title
  await new Promise(r => {
    const p = spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq JARVIS-*', '/T'], {
      windowsHide: true, stdio: 'ignore'
    });
    p.on('close', r);
    setTimeout(r, 1000);
  });
  
  // Kill by port
  for (const key in CONFIG) {
    await killPort(CONFIG[key].port);
  }
  
  // Small delay for cleanup
  await new Promise(r => setTimeout(r, 1500));
  log('Cleanup complete', 'success');
}

function startService(key) {
  const config = CONFIG[key];
  
  return new Promise((resolve) => {
    // Check if already running
    checkPort(config.port).then(running => {
      if (running) {
        log(`${config.name} already running on port ${config.port}`, 'warn');
        portsInUse.add(key);
        resolve(true);
        return;
      }
      
      // Start the process
      const isWin = process.platform === 'win32';
      const proc = spawn(config.command, config.args, {
        cwd: __dirname,
        windowsHide: false,  // Show windows so user can see activity
        detached: false,
        shell: isWin && config.command.includes('.cmd')  // Use shell for .cmd files on Windows
      });
      
      processes.set(key, proc);
      
      proc.on('error', (err) => {
        log(`${config.name} failed to start: ${err.message}`, 'error');
        if (!config.required) {
          log(`${config.name} is optional - continuing without it`, 'warn');
        }
      });
      
      proc.on('exit', (code, signal) => {
        if (shuttingDown) return;
        
        if (code !== 0 && code !== null) {
          if (config.required) {
            log(`${config.name} crashed with code ${code}!`, 'error');
          } else {
            log(`${config.name} exited (code ${code}) - optional service`, 'warn');
          }
        }
        processes.delete(key);
      });
      
      // Wait for port to be available
      waitForPort(config.port, config.required ? 30000 : 10000).then(ready => {
        if (ready) {
          log(`${config.name} ready on port ${config.port}`, 'success');
          resolve(true);
        } else {
          if (config.required) {
            log(`${config.name} failed to start on port ${config.port}`, 'error');
            resolve(false);
          } else {
            log(`${config.name} not available (optional)`, 'warn');
            resolve(true);  // Continue without optional service
          }
        }
      });
    });
  });
}

async function startChrome() {
  return new Promise((resolve) => {
    // Check if Chrome is available
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`
    ];
    
    let chromePath = null;
    for (const cp of chromePaths) {
      if (fs.existsSync(cp)) {
        chromePath = cp;
        break;
      }
    }
    
    if (!chromePath) {
      log('Chrome not found, opening default browser...', 'warn');
      const opener = spawn('start', ['http://localhost:3000'], { shell: true, windowsHide: false });
      opener.on('error', () => {});
      resolve();
      return;
    }
    
    log('Starting Chrome...', 'info');
    chromeProcess = spawn(chromePath, [
      '--app=http://localhost:3000',
      '--window-size=1920,1080',
      '--window-position=0,0',
      '--no-first-run',
      '--no-default-browser-check'
    ], {
      windowsHide: false,
      detached: false
    });
    
    chromeProcess.on('exit', () => {
      chromeProcess = null;
      if (!shuttingDown) {
        log('Chrome closed - shutting down JARVIS...', 'warn');
        shutdown();
      }
    });
    
    resolve();
  });
}

// ============================================
// SHUTDOWN
// ============================================

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  
  log('========================================', 'warn');
  log('SHUTTING DOWN JARVIS', 'warn');
  log('========================================', 'warn');
  
  // Kill Chrome first
  if (chromeProcess) {
    log('Closing Chrome...', 'info');
    chromeProcess.kill();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Kill all services in reverse order
  const order = ['vite', 'vision', 'gpu', 'embedding', 'piper', 'proxy', 'hardware'];
  
  for (const key of order) {
    const proc = processes.get(key);
    if (proc) {
      const config = CONFIG[key];
      log(`Stopping ${config.name}...`, 'info');
      proc.kill();
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Force kill any remaining processes by port
  log('Final cleanup...', 'info');
  for (const key in CONFIG) {
    await killPort(CONFIG[key].port);
  }
  
  // Kill any remaining JARVIS windows
  await new Promise(r => {
    const p = spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq JARVIS-*', '/T'], {
      windowsHide: true, stdio: 'ignore'
    });
    p.on('close', r);
    setTimeout(r, 1000);
  });
  
  log('Goodbye!', 'success');
  process.exit(0);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('');
  log('╔══════════════════════════════════════╗', 'info');
  log('║      JARVIS MASTER LAUNCHER          ║', 'info');
  log('╚══════════════════════════════════════╝', 'info');
  console.log('');
  
  // Check node_modules exists
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    log('ERROR: node_modules not found!', 'error');
    log('Please run: npm install', 'error');
    log('', 'info');
    log('Press any key to exit...', 'info');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(1));
    await new Promise(() => {});
    return;
  }
  
  // Handle Ctrl+C and other signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => {
    if (!shuttingDown) shutdown();
  });
  
  // Cleanup existing
  await cleanupExisting();
  
  // Check Python availability
  const pythonCheck = spawn('python', ['--version'], { windowsHide: true });
  let pythonAvailable = false;
  await new Promise(r => {
    pythonCheck.on('error', () => r());
    pythonCheck.on('close', (code) => {
      pythonAvailable = code === 0;
      r();
    });
    setTimeout(r, 2000);
  });
  
  if (!pythonAvailable) {
    log('Python not available - will run in NODE-ONLY mode', 'warn');
  }
  
  // Start required services first
  log('Starting required Node services...', 'info');
  
  const requiredServices = ['hardware', 'proxy'];
  for (const key of requiredServices) {
    const success = await startService(key);
    if (!success) {
      log('Failed to start required service!', 'error');
      await shutdown();
      return;
    }
  }
  
  // Start optional Python services (don't fail if they don't start)
  if (pythonAvailable) {
    log('Starting optional Python services...', 'info');
    const pythonServices = ['piper', 'whisper', 'embedding', 'gpu', 'vision'];
    for (const key of pythonServices) {
      await startService(key);
      await new Promise(r => setTimeout(r, 1000));  // Stagger starts
    }
  }
  
  // Start Vite (main process) - this blocks until it exits
  log('========================================', 'info');
  log('STARTING VITE (MAIN PROCESS)', 'info');
  log('========================================', 'info');
  
  const viteReady = await startService('vite');
  if (!viteReady) {
    log('Vite failed to start!', 'error');
    await shutdown();
    return;
  }
  
  // Small delay then open Chrome
  await new Promise(r => setTimeout(r, 2000));
  await startChrome();
  
  log('========================================', 'success');
  log('JARVIS IS RUNNING!', 'success');
  log('Press Ctrl+C here or close Chrome to exit', 'success');
  log('========================================', 'success');
  console.log('');
  
  // Monitor Vite process - when it exits, shutdown everything
  const viteProc = processes.get('vite');
  if (viteProc) {
    viteProc.on('exit', () => {
      log('Vite exited - shutting down...', 'warn');
      shutdown();
    });
  }
  
  // Keep process alive and monitor for issues
  setInterval(async () => {
    if (shuttingDown) return;
    
    // Check if required services are still running
    for (const key of requiredServices) {
      const proc = processes.get(key);
      const config = CONFIG[key];
      
      if (!proc || proc.exitCode !== null) {
        const running = await checkPort(config.port);
        if (!running) {
          log(`${config.name} stopped unexpectedly!`, 'error');
          log('Restarting...', 'warn');
          await startService(key);
        }
      }
    }
    
    // Check Chrome
    if (chromeProcess && chromeProcess.exitCode !== null) {
      log('Chrome was closed', 'warn');
      shutdown();
    }
  }, 5000);
  
  // Keep running
  await new Promise(() => {});
}

// Run
main().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  shutdown();
});
