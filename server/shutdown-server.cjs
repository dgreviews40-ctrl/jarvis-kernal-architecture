/**
 * JARVIS Shutdown Server
 * Dedicated server for handling shutdown requests
 * Runs on port 9999 (the original port from the code)
 */

const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');

const PORT = 9999;
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds grace period

// Kill JARVIS processes
function shutdownJARVIS() {
  console.log('[SHUTDOWN-SERVER] Executing JARVIS shutdown...');
  
  if (process.platform === 'win32') {
    // Kill by window titles
    const windowsToKill = [
      'JARVIS-*',
      'JARVIS-HW',
      'JARVIS-PROXY', 
      'JARVIS-PIPER',
      'JARVIS-WHISPER',
      'JARVIS-EMBEDDING',
      'JARVIS-GPU',
      'JARVIS-VISION',
      '*Vite*'
    ];
    
    windowsToKill.forEach(title => {
      spawn('taskkill', ['/F', '/FI', `WINDOWTITLE eq ${title}`, '/T'], {
        windowsHide: true,
        stdio: 'ignore'
      }).on('error', () => {});
    });
    
    // Kill by port
    const ports = [3000, 3100, 3101, 5000, 5001, 5002, 5003, 5004, 9999];
    ports.forEach(port => {
      exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`, {
        windowsHide: true
      }, () => {});
    });
    
    // Kill Node processes in JARVIS directory
    exec('wmic process where "name=\'node.exe\'" get CommandLine,ProcessId /format:csv', {
      windowsHide: true
    }, (err, stdout) => {
      if (!err && stdout) {
        const lines = stdout.split('\n');
        lines.forEach(line => {
          if (line.includes('jarvis') || line.includes('JARVIS')) {
            const match = line.match(/(\d+),?$/);
            if (match) {
              const pid = match[1];
              spawn('taskkill', ['/F', '/PID', pid, '/T'], {
                windowsHide: true,
                stdio: 'ignore'
              });
            }
          }
        });
      }
    });
  }
  
  // Exit this server after delay
  setTimeout(() => {
    console.log('[SHUTDOWN-SERVER] Exiting...');
    process.exit(0);
  }, 2000);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Handle shutdown endpoint
  if (req.method === 'POST' && req.url === '/api/shutdown') {
    console.log('[SHUTDOWN-SERVER] Shutdown request received');
    
    // Send response immediately
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Shutdown initiated',
      timestamp: new Date().toISOString()
    }));
    
    // Execute shutdown after sending response
    setTimeout(shutdownJARVIS, 100);
    return;
  }
  
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'JARVIS Shutdown Server',
      port: PORT
    }));
    return;
  }
  
  // 404 for other paths
  res.writeHead(404);
  res.end('Not found');
});

// Start server
server.listen(PORT, () => {
  console.log(`[SHUTDOWN-SERVER] Running on port ${PORT}`);
  console.log(`[SHUTDOWN-SERVER] Endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/shutdown - Shutdown JARVIS`);
  console.log(`  GET  http://localhost:${PORT}/health - Health check`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[SHUTDOWN-SERVER] SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('[SHUTDOWN-SERVER] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

// Keep alive
setInterval(() => {}, 1000);
