/**
 * News & Information Service
 * Aggregates news, summaries, and trending topics
 */

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: Date;
  category: 'technology' | 'science' | 'business' | 'world' | 'sports' | 'entertainment';
  relevance: number;
}

export interface BriefingRequest {
  categories?: string[];
  maxArticles?: number;
  focus?: string;
  timeRange?: 'morning' | 'day' | 'evening';
}

class NewsService {
  private apiKey: string | null = null;
  private userInterests: string[] = [];
  private readArticles: Set<string> = new Set();

  public configure(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get personalized news briefing
   */
  public async getBriefing(request: BriefingRequest = {}): Promise<string> {
    const { maxArticles = 5, focus, timeRange = 'morning' } = request;
    
    // Simulated news (replace with actual API)
    const articles = this.generateMockNews();
    
    // Filter by interests if no specific focus
    let filtered = articles;
    if (focus) {
      filtered = articles.filter(a => 
        a.title.toLowerCase().includes(focus.toLowerCase()) ||
        a.summary.toLowerCase().includes(focus.toLowerCase())
      );
    } else if (this.userInterests.length > 0) {
      filtered = articles.filter(a => 
        this.userInterests.some(interest => 
          a.category.toLowerCase() === interest.toLowerCase()
        )
      );
    }
    
    // Sort by relevance and recency
    filtered = filtered
      .filter(a => !this.readArticles.has(a.id))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxArticles);
    
    return this.generateBriefingText(filtered, timeRange);
  }

  /**
   * Generate natural language briefing
   */
  private generateBriefingText(articles: NewsArticle[], timeRange: string): string {
    if (articles.length === 0) {
      return "I don't have any new updates for you at the moment.";
    }
    
    const greetings: Record<string, string> = {
      morning: "Good morning! Here's your briefing:",
      day: "Here's what's happening today:",
      evening: "Good evening! Here are today's highlights:"
    };
    
    let text = greetings[timeRange] || greetings.day;
    text += '\n\n';
    
    articles.forEach((article, i) => {
      text += `${i + 1}. **${article.title}**\n`;
      text += `   ${article.summary}\n`;
      text += `   Source: ${article.source}\n\n`;
      
      // Mark as read
      this.readArticles.add(article.id);
    });
    
    return text.trim();
  }

  /**
   * Search for specific topics
   */
  public async search(query: string, maxResults: number = 3): Promise<NewsArticle[]> {
    // Simulated search
    const allNews = this.generateMockNews();
    return allNews
      .filter(a => 
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.summary.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, maxResults);
  }

  /**
   * Set user interests for personalization
   */
  public setInterests(interests: string[]): void {
    this.userInterests = interests;
  }

  /**
   * Parse news query
   */
  public parseNewsQuery(text: string): { type: 'briefing' | 'search' | 'topic'; query?: string } {
    const lower = text.toLowerCase();
    
    if (lower.includes('briefing') || lower.includes('headlines') || lower.includes('news')) {
      return { type: 'briefing' };
    }
    
    if (lower.includes('about') || lower.includes('search for')) {
      const match = text.match(/(?:about|search for)\s+(.+)/i);
      return { type: 'search', query: match?.[1] };
    }
    
    const topicMatch = lower.match(/(?:what's|what is|tell me about)\s+(.+)/);
    if (topicMatch) {
      return { type: 'topic', query: topicMatch[1] };
    }
    
    return { type: 'briefing' };
  }

  private generateMockNews(): NewsArticle[] {
    return [
      {
        id: '1',
        title: 'AI Breakthrough: New Model Achieves Human-Level Reasoning',
        summary: 'Researchers announce a significant advancement in artificial intelligence, demonstrating capabilities that rival human cognitive performance in complex problem-solving tasks.',
        source: 'TechDaily',
        url: '#',
        publishedAt: new Date(),
        category: 'technology',
        relevance: 0.95
      },
      {
        id: '2',
        title: 'Space Mission Discovers Water on Distant Moon',
        summary: 'A recent space exploration mission has confirmed the presence of water ice on a previously unexplored celestial body, opening new possibilities for future habitation.',
        source: 'Science Today',
        url: '#',
        publishedAt: new Date(Date.now() - 3600000),
        category: 'science',
        relevance: 0.88
      },
      {
        id: '3',
        title: 'Global Markets React to Economic Policy Changes',
        summary: 'Stock markets worldwide showed mixed reactions today as central banks announced new monetary policies aimed at stabilizing inflation.',
        source: 'Business Weekly',
        url: '#',
        publishedAt: new Date(Date.now() - 7200000),
        category: 'business',
        relevance: 0.75
      }
    ];
  }
}

export const news = new NewsService();
