/**
 * JARVIS Home Assistant Proxy
 * Bypasses CORS restrictions when connecting to Home Assistant
 */

// Change to the parent directory to find node_modules
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import process from 'process';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to the parent directory to find node_modules
process.chdir(resolve(__dirname, '..'));

let express, createProxyMiddleware, cors;

try {
  ({ default: express } = await import('express'));
} catch (e) {
  console.error('[PROXY] ERROR: express is not installed. Please run: npm install');
  process.exit(1);
}

try {
  ({ createProxyMiddleware } = await import('http-proxy-middleware'));
} catch (e) {
  console.error('[PROXY] ERROR: http-proxy-middleware is not installed. Please run: npm install');
  process.exit(1);
}

try {
  ({ default: cors } = await import('cors'));
} catch (e) {
  console.error('[PROXY] ERROR: cors is not installed. Please run: npm install');
  process.exit(1);
}

const app = express();
const PORT = 3101; // Using port 3101 for the proxy

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Store the Home Assistant URL and token (would be set by the main app)
let haConfig = {
  url: null,
  token: null
};

// Enhanced URL validation with better security
// Note: Local IP addresses are allowed for Home Assistant integration
function isValidUrl(string) {
  try {
    const url = new URL(string);
    // Allow only http/https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    
    // Validate IP format if it's an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      const octets = hostname.split('.').map(Number);
      // Validate octet values
      if (octets.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
        return false;
      }
      // Note: We allow private/local IP ranges for Home Assistant
      // (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x)
    }

    // Check for obviously malicious patterns in the URL
    const urlString = url.toString();
    if (
      urlString.includes('../') ||
      urlString.includes('..\\') ||
      urlString.includes('%2e%2e%2f') ||  // URL encoded ../
      urlString.includes('%2e%2e%5c') ||  // URL encoded ..\
      urlString.includes('127.0.0.1') && urlString.includes('etc/passwd') ||
      urlString.includes('file://') ||
      urlString.includes('ftp://') ||
      urlString.includes('javascript:') ||
      urlString.includes('data:')
    ) {
      return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

// Helper function to validate token format (basic validation)
function isValidToken(token) {
  // Home Assistant tokens can vary widely in format
  // Just ensure it's a reasonable length and doesn't contain obviously malicious patterns
  if (typeof token !== 'string' || token.length < 10) {
    return false;
  }
  // Check for obvious injection patterns but allow typical token characters
  return !/\.\.|\$\(|`|<script/i.test(token);
}

// Update Home Assistant configuration
app.post('/config', (req, res) => {
  const { url, token } = req.body;
  console.log(`[PROXY] Received config request with URL: ${url ? url.substring(0, 50) : 'undefined'}, token length: ${token ? token.length : 'undefined'}`);

  if (!url || !token) {
    console.log(`[PROXY] Missing URL or token: url=${!!url}, token=${!!token}`);
    return res.status(400).json({ success: false, message: 'URL and token required' });
  }

  // Validate URL to prevent SSRF attacks
  if (!isValidUrl(url)) {
    console.log(`[PROXY] Invalid URL: ${url}`);
    return res.status(400).json({ success: false, message: 'Invalid URL format or blocked IP range' });
  }

  // Validate token format
  if (!isValidToken(token)) {
    console.log(`[PROXY] Invalid token format: token length=${token.length}, first 20 chars=${token.substring(0, 20)}`);
    return res.status(400).json({ success: false, message: 'Invalid token format' });
  }

  haConfig = { url, token };
  console.log(`[PROXY] Configuration updated: ${url}`);
  res.json({ success: true, message: 'Configuration updated' });
});

// Get current configuration status
app.get('/status', (req, res) => {
  res.json({
    configured: !!(haConfig.url && haConfig.token),
    url: haConfig.url ? haConfig.url : null,
    hasToken: !!haConfig.token
  });
});

// Save API Key to .env.local file
app.post('/save-api-key', async (req, res) => {
  const { provider, key } = req.body;
  
  if (!provider || !key) {
    return res.status(400).json({ 
      success: false, 
      message: 'Provider and key are required' 
    });
  }
  
  // Validate provider
  const validProviders = ['gemini', 'openai', 'anthropic'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid provider. Must be one of: ${validProviders.join(', ')}` 
    });
  }
  
  // Basic key validation
  if (typeof key !== 'string' || key.length < 10) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid API key format' 
    });
  }
  
  try {
    // Get the project root directory (parent of server directory)
    const projectRoot = resolve(__dirname, '..');
    const envLocalPath = path.join(projectRoot, '.env.local');
    const envPath = path.join(projectRoot, '.env');
    
    // Determine which file to write to (prefer .env.local, fall back to .env)
    const targetPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;
    
    // Read existing content
    let envContent = '';
    try {
      envContent = fs.readFileSync(targetPath, 'utf8');
    } catch (e) {
      // File doesn't exist, start with empty content
      envContent = '';
    }
    
    // Build the env variable name
    const envVarName = `VITE_${provider.toUpperCase()}_API_KEY`;
    
    // Check if the key already exists and replace it, or add it
    const lines = envContent.split('\n');
    let keyFound = false;
    const newLines = lines.map(line => {
      // Match the specific env var (handle comments and whitespace)
      const match = line.match(new RegExp(`^\\s*${envVarName}\\s*=.*$`));
      if (match) {
        keyFound = true;
        return `${envVarName}=${key}`;
      }
      return line;
    });
    
    // If key wasn't found, add it
    if (!keyFound) {
      // Add a comment header if the file is not empty and doesn't have a comment
      if (newLines.length > 0 && newLines[0].trim() !== '' && !newLines[0].startsWith('#')) {
        newLines.unshift(`# ${provider.toUpperCase()} API Key`);
      }
      newLines.push(`${envVarName}=${key}`);
    }
    
    // Write the updated content
    fs.writeFileSync(targetPath, newLines.join('\n'), 'utf8');
    
    console.log(`[PROXY] API key for ${provider} saved to ${targetPath}`);
    
    res.json({ 
      success: true, 
      message: `API key for ${provider} saved successfully`,
      file: targetPath
    });
    
  } catch (error) {
    console.error('[PROXY] Error saving API key:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save API key',
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Home Assistant Proxy', timestamp: new Date().toISOString() });
});

// Shutdown endpoint - gracefully shuts down all JARVIS services
app.options('/api/shutdown', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

app.post('/api/shutdown', async (req, res) => {
  console.log('[PROXY] Shutdown requested from client');
  
  // Set CORS headers explicitly for this endpoint
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  res.json({ 
    success: true, 
    message: 'Shutdown initiated',
    timestamp: new Date().toISOString()
  });
  
  // Give the response time to send before shutting down
  setTimeout(() => {
    console.log('[PROXY] Executing shutdown sequence...');
    
    // On Windows, we need to kill the Node.js processes
    if (process.platform === 'win32') {
      // Kill by window title patterns
      const { spawn } = require('child_process');
      
      // Kill Vite dev server
      spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq *Vite*', '/T'], { 
        windowsHide: true, 
        stdio: 'ignore' 
      });
      
      // Kill Node.js processes related to JARVIS
      spawn('taskkill', ['/F', '/FI', 'IMAGENAME eq node.exe', '/FI', "COMMANDLINE eq *jarvis*", '/T'], { 
        windowsHide: true, 
        stdio: 'ignore' 
      });
      
      // Kill Python services
      spawn('taskkill', ['/F', '/FI', 'IMAGENAME eq python.exe', '/FI', "COMMANDLINE eq *jarvis*", '/T'], { 
        windowsHide: true, 
        stdio: 'ignore' 
      });
    }
    
    // Exit the proxy server itself
    console.log('[PROXY] Exiting...');
    process.exit(0);
  }, 500);
});

// Helper function to sanitize path
function sanitizePath(path) {
  // Remove any directory traversal attempts - multiple iterations to handle cases like ....//
  let sanitized = path.replace(/(\.\.\/|\.\.\\)+/g, '');
  // Also normalize the path to remove any remaining traversal patterns
  sanitized = sanitized.replace(/\.\.\/?/g, '').replace(/\.\.\\/g, '');
  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, '');
  return sanitized;
}

// Create a custom proxy handler that uses the current configuration
app.use('/ha-api', async (req, res, next) => {
  if (!haConfig.url) {
    return res.status(500).json({
      error: 'Proxy not configured',
      message: 'Home Assistant URL not configured. Please configure via POST /config'
    });
  }

  if (!haConfig.token) {
    return res.status(500).json({
      error: 'Proxy not configured',
      message: 'Home Assistant token not configured. Please configure via POST /config'
    });
  }

  try {
    // Construct the target URL
    let targetUrl = haConfig.url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'http://' + targetUrl;
    }
    // Remove trailing slash to avoid double slashes when appending API path
    targetUrl = targetUrl.replace(/\/$/, '');

    // Sanitize the request URL to prevent path traversal
    // Remove leading /ha-api and any leading slashes to avoid double slashes
    const sanitizedPath = sanitizePath(req.url.replace('/ha-api', '').replace(/^\/+/, ''));

    // Append the API path
    const apiUrl = targetUrl + '/api/' + sanitizedPath;

    // Check if this is a camera proxy request (which may need special handling)
    const isCameraRequest = apiUrl.includes('/camera_proxy/');
    const isStreamRequest = apiUrl.includes('/camera_proxy_stream/');

    console.log(`[PROXY] Forwarding request to: ${apiUrl}, isCamera: ${isCameraRequest}, isStream: ${isStreamRequest}`);

    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${haConfig.token}`,
      // For camera requests, we need to accept image content types
      'Accept': (isCameraRequest || isStreamRequest) ? 'image/*,multipart/x-mixed-replace,*/*' : 'application/json',
      'Content-Type': 'application/json'
    };

    // Add original headers if they exist
    Object.keys(req.headers).forEach(key => {
      if (!headers[key] && key !== 'authorization' && key !== 'host' && key !== 'connection') {
        headers[key] = req.headers[key];
      }
    });

    // Make the request to Home Assistant - only include body for non-GET/HEAD methods
    const options = {
      method: req.method,
      headers: headers
    };

    // Only include body for methods that can have a body
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      // Explicitly delete body property for GET/HEAD requests to avoid the error
      delete options.body;
    }

    const response = await fetch(apiUrl, options);

    console.log(`[PROXY] Response status: ${response.status}, isCamera: ${isCameraRequest}, isStream: ${isStreamRequest}`);

    // Set response headers
    res.status(response.status);

    // Handle MJPEG stream (multipart/x-mixed-replace)
    if (isStreamRequest) {
      const contentType = response.headers.get('content-type') || 'multipart/x-mixed-replace';
      console.log(`[PROXY] Streaming response with content-type: ${contentType}`);

      res.set({
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      });

      // Pipe the stream directly to the response
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        } catch (err) {
          console.error('[PROXY] Stream error:', err);
        } finally {
          // Ensure the reader is released and response is ended
          try {
            reader.releaseLock();
          } catch (releaseErr) {
            console.error('[PROXY] Error releasing reader lock:', releaseErr);
          }
          res.end();
        }
      };
      pump();
      return;
    }

    // Set response headers
    res.status(response.status);

    // For camera requests, we need to preserve the original content type
    const contentType = response.headers.get('content-type') || (isCameraRequest ? 'image/jpeg' : 'application/json');

    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    });

    // For camera images, we need to handle binary data properly
    if (isCameraRequest) {
      // Check if response is ok before processing
      if (!response.ok) {
        console.error(`[PROXY] Camera request failed with status: ${response.status}`);
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error(`[PROXY] Error response: ${errorText}`);
        return res.status(response.status).send(errorText);
      }

      try {
        // Get the original content type from the response
        const originalContentType = response.headers.get('content-type');
        console.log(`[PROXY] Original content-type: ${originalContentType}`);

        // Convert the response to ArrayBuffer and then to Buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Set the content type for images, removing any charset specification
        let imageContentType = 'image/jpeg'; // default
        if (originalContentType) {
          // Remove charset specification if present
          imageContentType = originalContentType.split(';')[0].trim();
        }

        console.log(`[PROXY] Setting content-type to: ${imageContentType}`);
        res.set('Content-Type', imageContentType);
        res.send(buffer);
      } catch (bufferError) {
        console.error('[PROXY] Error processing camera image buffer:', bufferError);
        res.status(500).send('Error processing image');
      }
    } else {
      // For non-camera requests
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error(`[PROXY] API request failed with status: ${response.status}, response: ${errorText}`);
        return res.status(response.status).send(errorText);
      }

      const responseBody = await response.text();
      res.send(responseBody);
    }
  } catch (error) {
    console.error('[PROXY] Error forwarding request:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      hint: 'Make sure Home Assistant URL and token are configured via POST /config'
    });
  }
});

// Handle preflight requests for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

console.log(`JARVIS Home Assistant Proxy starting on port ${PORT}...`);
console.log('Waiting for configuration...');

app.listen(PORT, () => {
  console.log(`JARVIS Home Assistant Proxy running on port ${PORT}`);
  console.log('Routes:');
  console.log('  POST /config - Set Home Assistant URL and token');
  console.log('  POST /save-api-key - Save API key to .env.local file');
  console.log('  POST /api/shutdown - Shutdown JARVIS services');
  console.log('  GET  /status - Get configuration status');
  console.log('  GET  /health - Health check');
  console.log('  ALL  /ha-api/* - Proxy to Home Assistant API');
});

// Export for use in other modules if needed
export const proxyApp = app;
export const updateConfig = (url, token) => { haConfig = { url, token }; };