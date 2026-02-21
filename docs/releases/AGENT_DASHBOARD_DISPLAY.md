# Web Search Integration

## Summary

Web search capability has been fully integrated into JARVIS as a first-class feature. The system can now detect search intents, perform web searches using DuckDuckGo's API, and synthesize results into natural responses.

## Changes Made

### 1. Type System Updates (`types.ts`)
- Added `SEARCH` to `IntentType` enum
- Added `SEARCH` to `MemoryType` type
- Added `TextContent` interface for dashboard display

### 2. Intent Detection (`services/localIntent.ts`)
- Added search intent patterns for queries like:
  - "search the web for..."
  - "google..."
  - "look up..."
  - "find information about..."
  - Questions with "latest", "news", "current", "today"

### 3. Search Service (`services/search.ts`)
- Attempts DuckDuckGo API fetch in all environments
- Detects CORS failures in browser mode
- Returns helpful error message with proxy instructions
- Formats results for AI consumption

### 4. Kernel Processor (`services/kernelProcessor.ts`)
- Added `handleSearch()` method that:
  - Dynamically imports search service (lazy loading)
  - Cleans search query by removing prefixes
  - Performs web search via DuckDuckGo API
  - Detects CORS errors and advises user to start proxy
  - Formats results for AI consumption
  - Sends enriched context to AI provider
  - Stores search history in memory
  - Falls back to regular query on errors

### 5. Memory System Updates
- `services/memory.ts`: Added SEARCH to retention priority counts
- `services/intelligence/semanticMemory.ts`: Added SEARCH to type statistics

### 6. Dashboard Display Enhancement
- **DisplayArea component** (`components/display/DisplayArea.tsx`):
  - New `TextViewer` component with markdown table support
  - Copy to clipboard functionality
  - Formatted display of agent results
- **Agent Orchestrator** (`services/agentOrchestrator.ts`):
  - Auto-displays substantial results on main dashboard
  - `displayOnDashboard()` public API for manual display
  - `generate_text` tool for creating CSV/text content
  - CSV to Markdown table conversion for better display
  - **Aggressive post-processing** to strip links, instructions, and fake download text
  - AI prompt updated with explicit FORBIDDEN patterns (links, "click here", etc.)

## How It Works

1. **Intent Detection**: User input is analyzed by `localIntent.ts`
2. **Search Trigger**: When search intent is detected (confidence ≥ 0.95), `handleSearch()` is called
3. **Query Cleaning**: Search prefixes are stripped (e.g., "search for" → actual query)
4. **Web Search**: DuckDuckGo API fetches real-time results
5. **CORS Handling**: If fetch fails in browser, suggests starting proxy server
6. **AI Synthesis**: Results are formatted and sent to the AI with context
7. **Response**: AI generates a natural response citing sources
8. **Memory Storage**: Search is stored for future context

## Example Interactions

```
User: "Search the web for latest Tesla news"
JARVIS: [Searches DuckDuckGo] "According to recent reports, Tesla..."

User: "What's the weather in Paris?"
JARVIS: [Detects weather query, uses specialized weather handling]

User: "Who is the current president?"
JARVIS: [Detects search intent due to "current"] "According to [source]..."
```

## How Web Search Works

### Automatic Proxy Usage
When you run `JARVIS.bat`, the proxy server **automatically starts** on port 3101. The search service will:

1. **First try the proxy** (if in browser mode) - This bypasses CORS restrictions
2. **Fall back to direct API** - If proxy is unavailable
3. **Return helpful message** - If both methods fail due to CORS

### The Proxy Server Auto-Starts
```batch
JARVIS.bat
  ↓
[3/9] Home Assistant Proxy  - Port 3101  ← ALREADY STARTS AUTOMATICALLY
```

So **yes**, web search works out of the box when you run `JARVIS.bat`!

## Agent Results Dashboard Display

When the Agent System completes a task with substantial results (like your planting guide), it now automatically displays on the main dashboard:

### Features:
- **Markdown table rendering** - Clean display of tabular data
- **Copy to clipboard button** - One-click copying of results
- **Scrollable view** - For long content
- **Formatted text** - Headers, lists, and emphasis
- **No external uploads** - Content shown directly, not uploaded to file-sharing services

### How It Works:
1. Agent generates CSV/text content
2. **Auto-converts CSV to Markdown table** for better display
3. Displays on main dashboard with copy button
4. User can copy directly - no download links needed

### Manual Display API:
```typescript
agentOrchestrator.displayOnDashboard(
  "February Planting Guide", 
  content, 
  'markdown'
);
```

### generate_text Tool:
The Agent now has a `generate_text` tool that:
- Creates formatted text/CSV content
- Displays it immediately on the dashboard
- Provides copy functionality
- Does NOT use external file uploads

Example agent instruction:
```
"Use the generate_text tool to create a CSV of plants 
for February planting in Medford, Oregon"
```

## Technical Details

- **Search Service**: `services/search.ts` (3.91 KB chunk, lazy loaded)
- **API**: DuckDuckGo Instant Answer (no API key required)
- **CORS**: Uses CORS-aware detection for browser/server environments
- **Bundle Impact**: Search service is code-split and loaded on-demand
- **Proxy**: Express proxy server on port 3101

## Test Results

- ✅ TypeScript: 0 errors
- ✅ Unit Tests: 507 passed
- ✅ Build: Successful (38 chunks, 817 KB gzipped)

## Troubleshooting

### "[SIMULATED]" Response
If you see `[SIMULATED] I'm sorry, but I'm unable to connect to the Ollama service...`, this means:
- **Ollama is not running** on your system
- The agent tried to use Ollama but fell back to a simulated response

**Solutions:**
1. **Start Ollama** (if you have it installed):
   ```bash
   ollama serve
   ```
2. **Use Gemini instead** - Make sure your Gemini API key is configured in Settings
3. **Check Ollama URL** - Verify the URL in Settings matches your Ollama installation (default: http://localhost:11434)

The web search and other tools still work without Ollama - they use the search service directly!

## Future Enhancements

- Plugin marketplace registration for discoverability
- Search result caching for common queries
- Multiple search provider support (Google, Bing)
- Image search integration
- Search history dashboard
