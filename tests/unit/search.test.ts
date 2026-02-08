import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SearchService, searchService, SearchResults } from '../../services/search';

describe('SearchService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalDocument: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    // Store original document
    originalDocument = global.document;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore document
    global.document = originalDocument;
  });

  // Helper to create non-browser service
  function createNonBrowserService(): SearchService {
    // Remove document temporarily to simulate non-browser
    (global as any).document = undefined;
    return new SearchService();
  }

  describe('weather query detection', () => {
    it('should detect weather-related queries', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Sunny, 75°F',
          Heading: 'Weather in New York',
          AbstractURL: 'https://duckduckgo.com'
        })
      });

      const results = await service.search('weather in New York');
      expect(results.query).toBe('weather in New York');
      expect(results.results.length).toBeGreaterThan(0);
    });

    it('should detect temperature queries', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: '72°F',
          Heading: 'Temperature in LA',
          AbstractURL: 'https://duckduckgo.com'
        })
      });

      const results = await service.search('temperature in Los Angeles');
      expect(results.query).toContain('temperature');
    });

    it('should detect forecast queries', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: '5-day forecast',
          Heading: 'Weather Forecast',
          AbstractURL: 'https://duckduckgo.com'
        })
      });

      const results = await service.search('weekly forecast');
      expect(results.query).toContain('forecast');
    });

    it('should detect various weather terms', async () => {
      const weatherTerms = ['rain', 'snow', 'sunny', 'cloudy', 'hot', 'cold', 'humidity', 'wind', 'storm'];
      
      for (const term of weatherTerms) {
        const service = createNonBrowserService();
        fetchMock.mockResolvedValue({
          ok: true,
          json: async () => ({
            AbstractText: `Information about ${term}`,
            Heading: term,
            AbstractURL: 'https://duckduckgo.com'
          })
        });

        const results = await service.search(`${term} today`);
        expect(results.results.length).toBeGreaterThan(0);
      }
    });
  });

  describe('browser environment handling', () => {
    it('should return CORS fallback in browser mode', async () => {
      // Service created with document present (browser mode)
      const browserService = new SearchService();
      const results = await browserService.search('test query');
      
      expect(results.results[0].title).toBe('Search Unavailable in Browser');
      expect(results.results[0].snippet).toContain('CORS restrictions');
    });

    it('should provide manual search URL in browser fallback', async () => {
      const browserService = new SearchService();
      const results = await browserService.search('javascript tutorial');
      
      expect(results.results[0].url).toContain('duckduckgo.com');
      expect(results.results[0].url).toContain(encodeURIComponent('javascript tutorial'));
    });
  });

  describe('successful API responses', () => {
    it('should parse abstract text results', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'JavaScript is a programming language',
          Heading: 'JavaScript',
          AbstractURL: 'https://developer.mozilla.org'
        })
      });

      const results = await service.search('javascript');
      
      expect(results.results).toHaveLength(1);
      expect(results.results[0].title).toBe('JavaScript');
      expect(results.results[0].snippet).toBe('JavaScript is a programming language');
      expect(results.results[0].url).toBe('https://developer.mozilla.org');
    });

    it('should parse related topics', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Main result',
          Heading: 'Main',
          AbstractURL: 'https://example.com',
          RelatedTopics: [
            { Text: 'Related 1', FirstURL: 'https://related1.com', Result: 'Result 1' },
            { Text: 'Related 2', FirstURL: 'https://related2.com', Name: 'Topic 2' },
            { Text: 'Related 3', FirstURL: 'https://related3.com' }
          ]
        })
      });

      const results = await service.search('test');
      
      expect(results.results.length).toBeGreaterThan(1);
      expect(results.results[1].title).toBe('Result 1');
      expect(results.results[2].title).toBe('Topic 2');
    });

    it('should limit related topics to 3', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Main',
          Heading: 'Main',
          AbstractURL: 'https://example.com',
          RelatedTopics: Array(10).fill(null).map((_, i) => ({
            Text: `Topic ${i}`,
            FirstURL: `https://topic${i}.com`
          }))
        })
      });

      const results = await service.search('test');
      
      // Main result + 3 related = 4 total
      expect(results.results.length).toBe(4);
    });

    it('should fallback to Results array if no abstract', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          Results: [
            { Text: 'Result 1', FirstURL: 'https://result1.com', Result: 'First Result' },
            { Text: 'Result 2', FirstURL: 'https://result2.com', Result: 'Second Result' }
          ]
        })
      });

      const results = await service.search('test');
      
      expect(results.results.length).toBeGreaterThan(0);
      expect(results.results[0].snippet).toBe('Result 1');
    });

    it('should handle API with heading only', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          Heading: 'Test Heading',
          AbstractURL: 'https://test.com',
          AbstractText: ''
        })
      });

      const results = await service.search('test');
      expect(results.results.length).toBeGreaterThan(0);
    });
  });

  describe('API error handling', () => {
    it('should handle HTTP errors gracefully', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429
      });

      const results = await service.search('test');
      
      expect(results.results[0].title).toBe('Search Error');
      expect(results.results[0].snippet).toContain('Unable to perform search');
    });

    it('should handle network errors', async () => {
      const service = createNonBrowserService();
      fetchMock.mockRejectedValue(new Error('Network error'));

      const results = await service.search('test');
      
      expect(results.results[0].title).toBe('Search Error');
      expect(results.results[0].snippet).toContain('Network error');
    });

    it('should handle malformed JSON', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const results = await service.search('test');
      
      expect(results.results[0].title).toBe('Search Error');
    });

    it('should handle empty API response', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      const results = await service.search('test');
      
      expect(results.results.length).toBe(1);
      expect(results.results[0].title).toBe('No results found');
    });
  });

  describe('weather search', () => {
    it('should enhance weather query', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Partly cloudy, 68°F',
          Heading: 'Weather in Boston',
          AbstractURL: 'https://weather.com'
        })
      });

      await service.search('Boston weather');
      
      // Should enhance with "weather forecast"
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('Boston%20weather%20weather%20forecast'),
        expect.any(Object)
      );
    });

    it('should handle weather search errors', async () => {
      const service = createNonBrowserService();
      fetchMock.mockRejectedValue(new Error('Weather API error'));

      const results = await service.search('weather in Seattle');
      
      expect(results.results[0].title).toBe('Weather Search Error');
      expect(results.results[0].snippet).toContain('weather.com');
    });

    it('should provide fallback for empty weather results', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          RelatedTopics: []
        })
      });

      const results = await service.search('weather in Nowhere');
      
      expect(results.results[0].title).toBe('Weather Information');
      expect(results.results[0].url).toBe('https://weather.com');
    });
  });

  describe('formatResultsForAI', () => {
    it('should format results for AI consumption', () => {
      const service = new SearchService();
      const searchResults: SearchResults = {
        query: 'test query',
        results: [
          { title: 'Result 1', url: 'https://1.com', snippet: 'Snippet 1' },
          { title: 'Result 2', url: 'https://2.com', snippet: 'Snippet 2' }
        ]
      };

      const formatted = service.formatResultsForAI(searchResults);
      
      expect(formatted).toContain('Search results for: "test query"');
      expect(formatted).toContain('Result 1:');
      expect(formatted).toContain('Result 2:');
      expect(formatted).toContain('Title: Result 1');
      expect(formatted).toContain('URL: https://1.com');
      expect(formatted).toContain('Snippet: Snippet 1');
    });

    it('should handle empty results', () => {
      const service = new SearchService();
      const searchResults: SearchResults = {
        query: 'test',
        results: []
      };

      const formatted = service.formatResultsForAI(searchResults);
      
      expect(formatted).toContain('No search results found');
    });

    it('should include note at end', () => {
      const service = new SearchService();
      const searchResults: SearchResults = {
        query: 'example',
        results: [{ title: 'Example', url: 'https://example.com', snippet: 'An example' }]
      };

      const formatted = service.formatResultsForAI(searchResults);
      
      expect(formatted).toContain('Note: These are the most relevant results');
    });
  });

  describe('searchService singleton', () => {
    it('should exist', () => {
      expect(searchService).toBeDefined();
      expect(searchService).toBeInstanceOf(SearchService);
    });

    it('should share the same instance', () => {
      const anotherRef = searchService;
      expect(searchService).toBe(anotherRef);
    });
  });

  describe('API request headers', () => {
    it('should include proper headers in request', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ AbstractText: 'Test' })
      });

      await service.search('test query');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': expect.stringContaining('Mozilla/5.0')
          })
        })
      );
    });

    it('should URL encode query parameters', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ AbstractText: 'Test' })
      });

      await service.search('hello world & more');

      const callArg = fetchMock.mock.calls[0][0];
      expect(callArg).toContain(encodeURIComponent('hello world & more'));
      expect(callArg).toContain('q=');
      expect(callArg).toContain('format=json');
    });
  });

  describe('search result structure', () => {
    it('should return results with correct structure', async () => {
      const service = createNonBrowserService();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Description',
          Heading: 'Title',
          AbstractURL: 'https://url.com'
        })
      });

      const results = await service.search('test');
      
      expect(results).toHaveProperty('query');
      expect(results).toHaveProperty('results');
      expect(Array.isArray(results.results)).toBe(true);
      
      if (results.results.length > 0) {
        expect(results.results[0]).toHaveProperty('title');
        expect(results.results[0]).toHaveProperty('url');
        expect(results.results[0]).toHaveProperty('snippet');
      }
    });
  });
});
