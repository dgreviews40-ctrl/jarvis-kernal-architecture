# API Key Security Implementation

## Overview

This document describes the API key security implementation that ensures API keys are never exposed in the client bundle.

## Problem

In Vite-based applications, environment variables prefixed with `VITE_` are exposed in the client bundle at build time. This means that `VITE_GEMINI_API_KEY` would be visible to anyone who inspects the JavaScript bundle.

## Solution

API keys are now stored **server-side only** in the proxy server (port 3101) and accessed via a secure proxy endpoint.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  ┌─────────────────┐        ┌─────────────────────────────────┐  │
│  │  Settings UI    │───────▶│  POST /save-api-key (to proxy)  │  │
│  │  (No API keys)  │        │  (sends key to server)          │  │
│  └─────────────────┘        └─────────────────────────────────┘  │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────┐        ┌─────────────────────────────────┐  │
│  │  Gemini Service │───────▶│  POST /gemini/generate          │  │
│  │  (Proxy client) │        │  (calls proxy, not Google)      │  │
│  └─────────────────┘        └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROXY SERVER (Port 3101)                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Environment: GEMINI_API_KEY (not VITE_GEMINI_API_KEY)      │ │
│  │  File: .env.local (server-side only)                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  /gemini/generate endpoint                                  │ │
│  │  - Reads GEMINI_API_KEY from process.env                    │ │
│  │  - Calls Google Gemini API server-side                      │ │
│  │  - Returns response to client                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Changes Made

### 1. Server-Side Proxy (`server/gemini-proxy.js`)

Created a Gemini proxy that:
- Reads API keys from server environment variables (no `VITE_` prefix)
- Proxies requests to Google Gemini API
- Handles both regular and streaming responses
- Returns appropriate error messages if key is missing

### 2. Client Proxy Client (`services/geminiProxyClient.ts`)

Created a client that:
- Calls `localhost:3101/gemini/*` instead of Google directly
- Provides `generateViaProxy()` and `streamViaProxy()` functions
- Has fallback logic if proxy is unavailable

### 3. Updated Gemini Service (`services/gemini.ts`)

Rewrote to:
- Remove all client-side API key handling
- Use `generateViaProxyWrapper()` for all API calls
- Check proxy availability before making requests
- Added `generateResponse()` export for kernelApi compatibility

### 4. Updated Settings UI (`components/SettingsInterface.tsx`)

Modified to:
- Remove `VITE_GEMINI_API_KEY` environment variable references
- Save API keys to server proxy via `POST /save-api-key`
- Migrate legacy keys from localStorage to secure storage
- Clear legacy storage after migration

### 5. Migration Script (`scripts/migrate-api-keys.js`)

Created a script to:
- Find `VITE_*_API_KEY` entries in `.env` files
- Add non-prefixed versions (`GEMINI_API_KEY`, etc.)
- Comment out the old `VITE_` prefixed keys

## Usage

### Setting Up API Keys

1. **Start the proxy server:**
   ```bash
   npm run proxy
   ```

2. **Save your API key in JARVIS Settings:**
   - Open Settings > API & Security
   - Enter your Gemini API key
   - Click Save
   - The key is sent to the proxy server and stored server-side

3. **(Optional) Migrate existing .env files:**
   ```bash
   node scripts/migrate-api-keys.js
   ```

### How It Works

1. User enters API key in Settings UI
2. Key is sent to proxy server via `POST /save-api-key`
3. Proxy saves key to `.env.local` as `GEMINI_API_KEY` (no `VITE_` prefix)
4. When JARVIS needs to call Gemini:
   - Client calls `localhost:3101/gemini/generate`
   - Proxy reads `GEMINI_API_KEY` from environment
   - Proxy calls Google API server-side
   - Proxy returns response to client

## Security Benefits

| Before | After |
|--------|-------|
| API key in client bundle | API key never leaves server |
| `VITE_GEMINI_API_KEY` visible in JS | No `VITE_` prefixed keys in client |
| Key stored in localStorage | Key stored server-side in `.env.local` |
| Key sent to browser on every request | Key used server-side only |

## Files Modified

- `services/gemini.ts` - Removed client-side API key handling
- `components/SettingsInterface.tsx` - Updated to use proxy
- `server/proxy.js` - Added Gemini routes
- `server/gemini-proxy.js` - New proxy implementation
- `services/geminiProxyClient.ts` - New proxy client
- `scripts/migrate-api-keys.js` - New migration script

## Verification

Run tests to verify the implementation:
```bash
npm test
```

Expected: 506+ tests passing (1 Ollama test may fail due to network)

## Troubleshooting

### "Gemini proxy not available" error
1. Ensure proxy server is running: `npm run proxy`
2. Check proxy is on port 3101
3. Save API key in Settings UI

### API key not being saved
1. Check browser console for errors
2. Verify proxy server is responding: `curl http://localhost:3101/gemini/status`
3. Check `.env.local` file was updated

### Migration script not working
1. Ensure you have write permissions to `.env.local`
2. Run from project root: `node scripts/migrate-api-keys.js`
3. Check script output for migration status
