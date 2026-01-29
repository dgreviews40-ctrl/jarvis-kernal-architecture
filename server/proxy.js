/**
 * JARVIS Home Assistant Proxy
 * Bypasses CORS restrictions when connecting to Home Assistant
 */

// Change to the parent directory to find node_modules
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import process from 'process';

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

// Update Home Assistant configuration
app.post('/config', (req, res) => {
  const { url, token } = req.body;
  if (url && token) {
    haConfig = { url, token };
    console.log(`[PROXY] Configuration updated: ${url}`);
    res.json({ success: true, message: 'Configuration updated' });
  } else {
    res.status(400).json({ success: false, message: 'URL and token required' });
  }
});

// Get current configuration status
app.get('/status', (req, res) => {
  res.json({
    configured: !!(haConfig.url && haConfig.token),
    url: haConfig.url ? haConfig.url : null,
    hasToken: !!haConfig.token
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Home Assistant Proxy', timestamp: new Date().toISOString() });
});

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

    // Append the API path
    const apiUrl = targetUrl + '/api' + req.url.replace('/ha-api', '');

    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${haConfig.token}`,
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

    // Set response headers
    res.status(response.status);
    res.set({
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    });

    // Stream the response
    const responseBody = await response.text();
    res.send(responseBody);
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
  console.log('  GET  /status - Get configuration status');
  console.log('  GET  /health - Health check');
  console.log('  ALL  /ha-api/* - Proxy to Home Assistant API');
});

// Export for use in other modules if needed
export const proxyApp = app;
export const updateConfig = (url, token) => { haConfig = { url, token }; };