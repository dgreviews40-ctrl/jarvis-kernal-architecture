export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResults {
  query: string;
  results: SearchResult[];
}

export class SearchService {
  private isBrowser: boolean;
  
  constructor() {
    // Detect if we're running in a browser environment
    this.isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  }

  /**
   * Perform a web search using DuckDuckGo's instant answer API
   * This is a free alternative that doesn't require an API key
   * 
   * NOTE: In browser environments, this may fail due to CORS restrictions.
   * The search should ideally be proxied through a backend server.
   */
  public async search(query: string): Promise<SearchResults> {
    // Check if this is a weather query and handle it specially
    if (this.isWeatherQuery(query)) {
      return await this.searchWeather(query);
    }

    // In browser environments, DuckDuckGo API calls will likely fail due to CORS
    // Return a graceful fallback instead of attempting the fetch
    if (this.isBrowser) {
      console.warn('[SEARCH] Browser environment detected. DuckDuckGo API has CORS restrictions. Consider using a proxy server.');
      return {
        query,
        results: [{
          title: 'Search Unavailable in Browser',
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: `Web search is not available in browser mode due to CORS restrictions. Please visit the link to search manually, or configure a proxy server for search functionality.`
        }]
      };
    }

    try {
      // Use DuckDuckGo Instant Answer API (doesn't require API key)
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const results: SearchResult[] = [];

      // Extract results from DuckDuckGo API
      if (data.AbstractText) {
        results.push({
          title: data.Heading || 'Summary',
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.AbstractText
        });
      }

      // Add related topics if available
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Result || topic.Name || 'Related Topic',
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
        });
      }

      // Fallback: if no abstract, try to use Results array
      if (results.length === 0 && data.Results && Array.isArray(data.Results)) {
        data.Results.slice(0, 3).forEach((result: any) => {
          if (result.Text && result.FirstURL) {
            results.push({
              title: result.Result || 'Search Result',
              url: result.FirstURL,
              snippet: result.Text
            });
          }
        });
      }

      return {
        query,
        results: results.length > 0 ? results : [{
          title: 'No results found',
          url: 'https://duckduckgo.com',
          snippet: `No specific information found for: ${query}`
        }]
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        query,
        results: [{
          title: 'Search Error',
          url: 'https://duckduckgo.com',
          snippet: `Unable to perform search for: ${query}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Check if the query is related to weather
   */
  private isWeatherQuery(query: string): boolean {
    const weatherTerms = [
      'weather', 'temperature', 'forecast', 'rain', 'snow', 'sunny', 'cloudy',
      'hot', 'cold', 'degrees', 'humidity', 'pressure', 'wind', 'storm', 'precipitation'
    ];
    const lowerQuery = query.toLowerCase();
    return weatherTerms.some(term => lowerQuery.includes(term));
  }

  /**
   * Specialized search for weather information
   */
  private async searchWeather(query: string): Promise<SearchResults> {
    try {
      // Enhance the weather query to get better results
      const enhancedQuery = query + " weather forecast";
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(enhancedQuery)}&format=json&no_html=1&skip_disambig=1`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const results: SearchResult[] = [];

      // Extract weather information from DuckDuckGo API
      if (data.AbstractText) {
        results.push({
          title: data.Heading || 'Weather Information',
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.AbstractText
        });
      }

      // Add related weather topics if available
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 2).forEach((topic: any) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Result || topic.Name || 'Weather Related',
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
        });
      }

      // If no specific weather info found, provide a generic response
      if (results.length === 0) {
        return {
          query,
          results: [{
            title: 'Weather Information',
            url: 'https://weather.com',
            snippet: `For the most accurate and up-to-date weather information for ${query.replace('weather', '').trim()}, please check a dedicated weather service like weather.com or your local weather station.`
          }]
        };
      }

      return {
        query,
        results
      };
    } catch (error) {
      console.error('Weather search error:', error);
      return {
        query,
        results: [{
          title: 'Weather Search Error',
          url: 'https://weather.com',
          snippet: `Unable to retrieve current weather information. For weather updates, please check a dedicated weather service like weather.com or your local weather station.`
        }]
      };
    }
  }

  /**
   * Format search results for AI consumption
   */
  public formatResultsForAI(results: SearchResults): string {
    if (results.results.length === 0) {
      return `No search results found for "${results.query}".`;
    }

    let formatted = `Search results for: "${results.query}"\n\n`;

    results.results.forEach((result, index) => {
      formatted += `Result ${index + 1}:\n`;
      formatted += `Title: ${result.title}\n`;
      formatted += `URL: ${result.url}\n`;
      formatted += `Snippet: ${result.snippet}\n\n`;
    });

    formatted += `Note: These are the most relevant results for the query "${results.query}". Use this information to answer the user's question accurately.`;

    return formatted;
  }
}

export const searchService = new SearchService();