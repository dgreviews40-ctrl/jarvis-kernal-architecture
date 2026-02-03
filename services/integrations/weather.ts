/**
 * Weather Integration Service
 * Fetches weather data and provides natural language summaries
 */

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  condition: string;
  description: string;
  windSpeed: number;
  location: string;
  forecast: DailyForecast[];
  alerts: WeatherAlert[];
}

export interface DailyForecast {
  date: Date;
  high: number;
  low: number;
  condition: string;
  precipitation: number;
}

export interface WeatherAlert {
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  title: string;
  description: string;
  start: Date;
  end: Date;
}

class WeatherService {
  private apiKey: string | null = null;
  private defaultLocation: string = '';
  private cache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  public configure(apiKey: string, defaultLocation?: string) {
    this.apiKey = apiKey;
    if (defaultLocation) this.defaultLocation = defaultLocation;
  }

  /**
   * Fetch current weather
   */
  public async getCurrent(location?: string): Promise<WeatherData | null> {
    const loc = location || this.defaultLocation;
    if (!loc) throw new Error('No location specified');
    
    const cacheKey = `current_${loc}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Simulated weather data (replace with actual API call)
    const data = this.generateMockWeather(loc);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  }

  /**
   * Get weather summary in natural language
   */
  public getNaturalSummary(weather: WeatherData): string {
    const { temperature, condition, feelsLike, humidity } = weather;
    const tempDiff = feelsLike - temperature;
    
    let summary = `It's currently ${Math.round(temperature)}°F and ${condition.toLowerCase()}`;
    
    if (Math.abs(tempDiff) > 5) {
      summary += tempDiff > 0 
        ? `, but it feels like ${Math.round(feelsLike)}°F due to humidity`
        : `, with a wind chill of ${Math.round(feelsLike)}°F`;
    }
    
    // Clothing recommendations
    if (temperature < 32) {
      summary += `. Bundle up - it's freezing out there!`;
    } else if (temperature < 50) {
      summary += `. You'll want a jacket.`;
    } else if (temperature > 85) {
      summary += `. Stay hydrated - it's quite warm.`;
    }
    
    // Check for alerts
    if (weather.alerts.length > 0) {
      const severe = weather.alerts.filter(a => a.severity === 'severe' || a.severity === 'extreme');
      if (severe.length > 0) {
        summary += ` ⚠️ Weather alert: ${severe[0].title}`;
      }
    }
    
    return summary;
  }

  /**
   * Get forecast summary
   */
  public getForecastSummary(forecast: DailyForecast[]): string {
    if (forecast.length === 0) return '';
    
    const today = forecast[0];
    const tomorrow = forecast[1];
    
    let summary = `Today: High of ${Math.round(today.high)}°, ${today.condition.toLowerCase()}. `;
    
    if (tomorrow) {
      const tempChange = tomorrow.high - today.high;
      if (Math.abs(tempChange) > 10) {
        summary += `Tomorrow will be ${tempChange > 0 ? 'warmer' : 'cooler'} ` +
          `with a high of ${Math.round(tomorrow.high)}°.`;
      } else {
        summary += `Tomorrow: Similar conditions with a high of ${Math.round(tomorrow.high)}°.`;
      }
    }
    
    // Check for rain
    const rainyDays = forecast.filter(d => d.precipitation > 0.3);
    if (rainyDays.length > 0) {
      summary += ` Expect rain on ${rainyDays.map(d => 
        d.date.toLocaleDateString('en-US', { weekday: 'long' })).join(', ')}.`;
    }
    
    return summary;
  }

  /**
   * Parse weather query
   */
  public parseWeatherQuery(text: string): { type: 'current' | 'forecast'; location?: string; days?: number } {
    const lower = text.toLowerCase();
    
    const type: 'current' | 'forecast' = 
      lower.includes('forecast') || lower.includes('tomorrow') || lower.includes('week')
        ? 'forecast' : 'current';
    
    // Extract location
    const locationMatch = text.match(/(?:in|for|at)\s+([A-Za-z\s,]+?)(?:\s+(?:today|tomorrow|now|this week))?$/i);
    const location = locationMatch ? locationMatch[1].trim() : undefined;
    
    // Extract days
    let days = 1;
    if (lower.includes('week')) days = 7;
    else if (lower.includes('3 day') || lower.includes('three day')) days = 3;
    else if (lower.includes('5 day') || lower.includes('five day')) days = 5;
    
    return { type, location, days };
  }

  private generateMockWeather(location: string): WeatherData {
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Stormy', 'Snowy'];
    const baseTemp = 45 + Math.random() * 40;
    
    return {
      temperature: baseTemp,
      feelsLike: baseTemp + (Math.random() * 10 - 5),
      humidity: 30 + Math.random() * 50,
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      description: 'Partly cloudy with a chance of awesome',
      windSpeed: Math.random() * 20,
      location,
      forecast: Array.from({ length: 5 }, (_, i) => ({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        high: baseTemp + Math.random() * 15 - 5,
        low: baseTemp - 10 - Math.random() * 10,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        precipitation: Math.random()
      })),
      alerts: []
    };
  }
}

export const weather = new WeatherService();
