# Search Service

Web search integration using DuckDuckGo's instant answer API.

## Overview

The Search Service provides web search capabilities with:

- **DuckDuckGo API** - No API key required
- **Weather Queries** - Specialized handling for weather
- **CORS Handling** - Graceful degradation in browser
- **Result Formatting** - Structured search results

## Usage

```typescript
import { searchService } from './services/search';

// Basic search
const results = await searchService.search('TypeScript tutorial');
console.log(results.query);     // Original query
console.log(results.results);   // Array of results

// Weather search (automatically detected)
const weather = await searchService.search('weather in New York');
```

## Search Results

```typescript
interface SearchResults {
  query: string;
  results: SearchResult[];
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}
```

## Features

### Automatic Weather Detection

Weather-related queries are automatically detected:

```typescript
const weatherTerms = [
  'weather', 'temperature', 'forecast', 'rain', 'snow',
  'sunny', 'cloudy', 'hot', 'cold', 'degrees', 'humidity',
  'pressure', 'wind', 'storm', 'precipitation'
];
```

When detected, the query is enhanced:

```
Input: "weather in New York"
Enhanced: "weather in New York weather forecast"
```

### CORS Handling

In browser environments, DuckDuckGo API calls may fail due to CORS:

```typescript
if (this.isBrowser) {
  return {
    query,
    results: [{
      title: 'Search Unavailable in Browser',
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: 'Web search is not available in browser mode due to CORS restrictions...'
    }]
  };
}
```

**Workarounds:**
1. Use a backend proxy server
2. Open search link manually
3. Use browser extension to bypass CORS

## API Reference

### `search(query: string): Promise<SearchResults>`

Performs a web search.

**Parameters:**
- `query` - Search query string

**Returns:** `SearchResults` object

**Example:**

```typescript
const { results } = await searchService.search('JavaScript promises');

results.forEach(result => {
  console.log(`${result.title}: ${result.url}`);
  console.log(result.snippet);
});
```

### Result Structure

DuckDuckGo API returns:

```typescript
{
  AbstractText: string;      // Summary
  AbstractURL: string;       // Source URL
  Heading: string;           // Title
  RelatedTopics: [{          // Related results
    Text: string;
    FirstURL: string;
    Result: string;
  }];
  Results: [{                // Direct results
    Text: string;
    FirstURL: string;
  }];
}
```

## Implementation Details

### Browser Detection

```typescript
constructor() {
  this.isBrowser = typeof window !== 'undefined' && 
                   typeof window.document !== 'undefined';
}
```

### API Request

```typescript
const response = await fetch(
  `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
  `&format=json&no_html=1&skip_disambig=1`,
  {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (...)'
    }
  }
);
```

### Result Extraction

Priority order:
1. AbstractText (summary)
2. RelatedTopics (related results)
3. Results (direct results)

## Limitations

1. **CORS in Browser** - API blocked in browser environments
2. **Rate Limiting** - DuckDuckGo may rate-limit requests
3. **No Pagination** - Limited to first few results
4. **English Focus** - Best results for English queries
5. **No Advanced Search** - No boolean operators or filters

## Integration Example

```typescript
// In kernel processor
async function handleSearchQuery(query: string) {
  const searchResults = await searchService.search(query);
  
  if (searchResults.results.length === 0) {
    return 'No results found for your query.';
  }
  
  const topResult = searchResults.results[0];
  return `Here's what I found: ${topResult.title}. ${topResult.snippet}`;
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { SearchService } from './services/search';

describe('SearchService', () => {
  it('should detect weather queries', () => {
    const service = new SearchService();
    expect(service['isWeatherQuery']('weather today')).toBe(true);
    expect(service['isWeatherQuery']('javascript tutorial')).toBe(false);
  });

  it('should return fallback in browser', async () => {
    const service = new SearchService();
    service['isBrowser'] = true;
    
    const results = await service.search('test');
    expect(results.results[0].title).toContain('Unavailable');
  });
});
```

## Future Enhancements

- [ ] Backend proxy for CORS bypass
- [ ] Multiple search providers (Google, Bing)
- [ ] Caching layer for frequent queries
- [ ] Advanced query syntax
- [ ] Image search support
- [ ] News search filtering
