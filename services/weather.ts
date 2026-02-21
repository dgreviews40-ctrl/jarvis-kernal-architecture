/**
 * JARVIS Advanced Weather Plugin
 * Real-time weather data using Open-Meteo API (free, no API key required)
 */

export interface WeatherCondition {
  code: number;
  description: string;
  icon: string;
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  cloudCover: number;
  precipitation: number;
  condition: WeatherCondition;
  isDay: boolean;
  timestamp: number;
}

export interface HourlyForecast {
  time: Date;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  precipitationProbability: number;
  condition: WeatherCondition;
  isDay: boolean;
}

export interface DailyForecast {
  date: Date;
  tempMax: number;
  tempMin: number;
  sunrise: Date;
  sunset: Date;
  uvIndexMax: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  condition: WeatherCondition;
}

export interface AirQuality {
  aqi: number;
  pm2_5: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
  category: 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
}

export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  admin1?: string;
}

export interface WeatherData {
  location: WeatherLocation;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  airQuality?: AirQuality;
  lastUpdated: number;
}

export interface RadarFrame {
  time: number;
  path: string;
}

export interface RadarData {
  frames: RadarFrame[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  generated: number;
}

export interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';
  urgency: 'immediate' | 'expected' | 'future' | 'past' | 'unknown';
  event: string;
  effective: Date;
  expires: Date;
  areaDesc: string;
  instruction?: string;
  sender: string;
}

export interface WeatherAlertsData {
  alerts: WeatherAlert[];
  lastChecked: number;
}

// WMO Weather interpretation codes mapping
const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Fog', icon: '🌫️' },
  48: { description: 'Depositing rime fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌧️' },
  53: { description: 'Moderate drizzle', icon: '🌧️' },
  55: { description: 'Dense drizzle', icon: '🌧️' },
  56: { description: 'Light freezing drizzle', icon: '🌨️' },
  57: { description: 'Dense freezing drizzle', icon: '🌨️' },
  61: { description: 'Slight rain', icon: '🌧️' },
  63: { description: 'Moderate rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  66: { description: 'Light freezing rain', icon: '🌨️' },
  67: { description: 'Heavy freezing rain', icon: '🌨️' },
  71: { description: 'Slight snow', icon: '🌨️' },
  73: { description: 'Moderate snow', icon: '🌨️' },
  75: { description: 'Heavy snow', icon: '❄️' },
  77: { description: 'Snow grains', icon: '🌨️' },
  80: { description: 'Slight rain showers', icon: '🌦️' },
  81: { description: 'Moderate rain showers', icon: '🌦️' },
  82: { description: 'Violent rain showers', icon: '⛈️' },
  85: { description: 'Slight snow showers', icon: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '❄️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with slight hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

function getWeatherCondition(code: number): WeatherCondition {
  const info = WMO_CODES[code] || { description: 'Unknown', icon: '❓' };
  return { code, ...info };
}

function getAQICategory(aqi: number): AirQuality['category'] {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy_sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very_unhealthy';
  return 'hazardous';
}

type WeatherObserver = (data: WeatherData | null) => void;
type WeatherAlertObserver = (alerts: WeatherAlert[]) => void;

class WeatherService {
  private currentData: WeatherData | null = null;
  private observers: WeatherObserver[] = [];
  private alertObservers: WeatherAlertObserver[] = [];
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private currentLocation: WeatherLocation | null = null;
  private storageKey = 'jarvis_weather_config';
  private cacheKey = 'jarvis_weather_cache_v2'; // Bumped version to invalidate old cached data
  private refreshIntervalMs = 10 * 60 * 1000; // 10 minutes
  private lastAlerts: WeatherAlert[] = [];
  private alertCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadSavedLocation();
    this.loadCachedData();
    // Clear old cache version to prevent stale data
    try {
      localStorage.removeItem('jarvis_weather_cache');
    } catch (e) {
      // Ignore
    }
  }

  private loadSavedLocation(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.currentLocation = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[WEATHER] Failed to load saved location:', e);
    }
  }

  private loadCachedData(): void {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is less than 30 minutes old
        if (Date.now() - data.lastUpdated < 30 * 60 * 1000) {
          // Convert date strings back to Date objects
          if (data.hourly) {
            data.hourly = data.hourly.map((h: any) => ({
              ...h,
              time: new Date(h.time)
            }));
          }
          if (data.daily) {
            data.daily = data.daily.map((d: any) => ({
              ...d,
              date: new Date(d.date),
              sunrise: new Date(d.sunrise),
              sunset: new Date(d.sunset)
            }));
          }
          this.currentData = data;
        }
      }
    } catch (e) {
      console.warn('[WEATHER] Failed to load cached data:', e);
    }
  }

  private saveLocation(location: WeatherLocation): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(location));
    } catch (e) {
      console.warn('[WEATHER] Failed to save location:', e);
    }
  }

  private cacheData(data: WeatherData): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch (e) {
      console.warn('[WEATHER] Failed to cache data:', e);
    }
  }

  public subscribe(callback: WeatherObserver): () => void {
    this.observers.push(callback);
    if (this.currentData) {
      callback(this.currentData);
    }
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  private notify(): void {
    this.observers.forEach(cb => cb(this.currentData));
  }

  public subscribeToAlerts(callback: WeatherAlertObserver): () => void {
    this.alertObservers.push(callback);
    return () => {
      this.alertObservers = this.alertObservers.filter(cb => cb !== callback);
    };
  }

  private notifyAlertObservers(alerts: WeatherAlert[]): void {
    this.alertObservers.forEach(cb => cb(alerts));
  }

  public async checkAndNotifyAlerts(): Promise<void> {
    if (!this.currentLocation || !this.currentData) return;
    
    try {
      // Try NWS API first
      const alertData = await this.getWeatherAlerts(
        this.currentLocation.latitude,
        this.currentLocation.longitude
      );
      
      let currentAlerts: WeatherAlert[] = [];
      
      if (alertData) {
        currentAlerts = alertData.alerts;
      } else {
        // Fallback to condition-based alerts
        const { alerts } = this.checkSevereWeather(this.currentData);
        currentAlerts = alerts;
      }
      
      // Check for new alerts (not in lastAlerts)
      const newAlerts = currentAlerts.filter(alert => 
        !this.lastAlerts.some(lastAlert => lastAlert.id === alert.id)
      );
      
      // Notify observers of all current alerts
      this.notifyAlertObservers(currentAlerts);
      
      // If there are new severe/extreme alerts, also notify individually
      for (const alert of newAlerts) {
        if (alert.severity === 'extreme' || alert.severity === 'severe') {
          // Emit event for voice notification
          const { eventBus } = await import('./eventBus');
          await eventBus.publish('weather:alert:new', alert);
        }
      }
      
      this.lastAlerts = currentAlerts;
    } catch (e) {
      console.warn('[WEATHER] Alert check failed:', e);
    }
  }

  public startAlertChecking(): void {
    if (this.alertCheckInterval) return;
    
    // Check immediately
    this.checkAndNotifyAlerts();
    
    // Check every 2 minutes
    this.alertCheckInterval = setInterval(() => {
      this.checkAndNotifyAlerts();
    }, 2 * 60 * 1000);
  }

  public stopAlertChecking(): void {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }
  }

  public async searchLocations(query: string): Promise<WeatherLocation[]> {
    if (!query.trim()) return [];

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.results) return [];

      return data.results.map((r: any) => ({
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
        country: r.country,
        admin1: r.admin1,
      }));
    } catch (e) {
      console.error('[WEATHER] Location search failed:', e);
      return [];
    }
  }

  public async setLocation(location: WeatherLocation): Promise<void> {
    this.currentLocation = location;
    this.saveLocation(location);
    await this.refresh();
  }

  public async setLocationByCoords(lat: number, lon: number): Promise<void> {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${lat}&longitude=${lon}&count=1`;
      const response = await fetch(url);
      const data = await response.json();

      const location: WeatherLocation = {
        name: data.results?.[0]?.name || 'Current Location',
        latitude: lat,
        longitude: lon,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        country: data.results?.[0]?.country,
        admin1: data.results?.[0]?.admin1,
      };

      await this.setLocation(location);
    } catch (e) {
      const location: WeatherLocation = {
        name: 'Current Location',
        latitude: lat,
        longitude: lon,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      await this.setLocation(location);
    }
  }

  public async useCurrentLocation(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.error('[WEATHER] Geolocation not supported');
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await this.setLocationByCoords(position.coords.latitude, position.coords.longitude);
          resolve(true);
        },
        (error) => {
          console.error('[WEATHER] Geolocation error:', error);
          resolve(false);
        },
        { timeout: 10000 }
      );
    });
  }

  public getLocation(): WeatherLocation | null {
    return this.currentLocation;
  }

  public getData(): WeatherData | null {
    return this.currentData;
  }

  public async refresh(): Promise<WeatherData | null> {
    if (!this.currentLocation) {
      console.warn('[WEATHER] No location set');
      return null;
    }

    try {
      const { latitude, longitude, timezone, name, country, admin1 } = this.currentLocation;

      // Fetch weather data (using Fahrenheit for US users)
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.searchParams.set('latitude', latitude.toString());
      weatherUrl.searchParams.set('longitude', longitude.toString());
      weatherUrl.searchParams.set('timezone', timezone);
      weatherUrl.searchParams.set('temperature_unit', 'fahrenheit');
      weatherUrl.searchParams.set('wind_speed_unit', 'mph');
      weatherUrl.searchParams.set('precipitation_unit', 'inch');
      weatherUrl.searchParams.set('current', [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'is_day', 'precipitation', 'weather_code', 'cloud_cover',
        'pressure_msl', 'surface_pressure', 'wind_speed_10m',
        'wind_direction_10m', 'wind_gusts_10m'
      ].join(','));
      weatherUrl.searchParams.set('hourly', [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'precipitation_probability', 'precipitation', 'weather_code',
        'wind_speed_10m', 'is_day'
      ].join(','));
      weatherUrl.searchParams.set('daily', [
        'weather_code', 'temperature_2m_max', 'temperature_2m_min',
        'sunrise', 'sunset', 'uv_index_max', 'precipitation_sum',
        'precipitation_probability_max', 'wind_speed_10m_max'
      ].join(','));
      weatherUrl.searchParams.set('forecast_days', '7');

      const weatherResponse = await fetch(weatherUrl.toString());
      const weatherJson = await weatherResponse.json();

      // Fetch air quality data
      const aqUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      aqUrl.searchParams.set('latitude', latitude.toString());
      aqUrl.searchParams.set('longitude', longitude.toString());
      aqUrl.searchParams.set('current', [
        'us_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide',
        'sulphur_dioxide', 'carbon_monoxide'
      ].join(','));

      let airQuality: AirQuality | undefined;
      try {
        const aqResponse = await fetch(aqUrl.toString());
        const aqJson = await aqResponse.json();
        if (aqJson.current) {
          const aqi = aqJson.current.us_aqi || 0;
          airQuality = {
            aqi,
            pm2_5: aqJson.current.pm2_5 || 0,
            pm10: aqJson.current.pm10 || 0,
            o3: aqJson.current.ozone || 0,
            no2: aqJson.current.nitrogen_dioxide || 0,
            so2: aqJson.current.sulphur_dioxide || 0,
            co: aqJson.current.carbon_monoxide || 0,
            category: getAQICategory(aqi),
          };
        }
      } catch (e) {
        console.warn('[WEATHER] Air quality fetch failed:', e);
      }

      // Parse current weather
      const current: CurrentWeather = {
        temperature: weatherJson.current.temperature_2m,
        feelsLike: weatherJson.current.apparent_temperature,
        humidity: weatherJson.current.relative_humidity_2m,
        windSpeed: weatherJson.current.wind_speed_10m,
        windDirection: weatherJson.current.wind_direction_10m,
        windGusts: weatherJson.current.wind_gusts_10m,
        pressure: weatherJson.current.pressure_msl,
        visibility: 10000,
        uvIndex: weatherJson.daily?.uv_index_max?.[0] || 0,
        cloudCover: weatherJson.current.cloud_cover,
        precipitation: weatherJson.current.precipitation,
        condition: getWeatherCondition(weatherJson.current.weather_code),
        isDay: weatherJson.current.is_day === 1,
        timestamp: Date.now(),
      };

      // Parse hourly forecast (next 24 hours)
      const hourly: HourlyForecast[] = [];
      const now = Date.now();
      for (let i = 0; i < Math.min(24, weatherJson.hourly.time.length); i++) {
        const timeValue = weatherJson.hourly.time[i];
        if (!timeValue) continue;
        
        const time = new Date(timeValue);
        if (isNaN(time.getTime()) || time.getTime() < now) continue;

        hourly.push({
          time,
          temperature: weatherJson.hourly.temperature_2m[i],
          feelsLike: weatherJson.hourly.apparent_temperature[i],
          humidity: weatherJson.hourly.relative_humidity_2m[i],
          windSpeed: weatherJson.hourly.wind_speed_10m[i],
          precipitation: weatherJson.hourly.precipitation[i],
          precipitationProbability: weatherJson.hourly.precipitation_probability[i],
          condition: getWeatherCondition(weatherJson.hourly.weather_code[i]),
          isDay: weatherJson.hourly.is_day[i] === 1,
        });
      }

      // Parse daily forecast
      const daily: DailyForecast[] = weatherJson.daily.time.map((t: string, i: number) => ({
        date: new Date(t),
        tempMax: weatherJson.daily.temperature_2m_max[i],
        tempMin: weatherJson.daily.temperature_2m_min[i],
        sunrise: new Date(weatherJson.daily.sunrise[i]),
        sunset: new Date(weatherJson.daily.sunset[i]),
        uvIndexMax: weatherJson.daily.uv_index_max[i],
        precipitationSum: weatherJson.daily.precipitation_sum[i],
        precipitationProbabilityMax: weatherJson.daily.precipitation_probability_max[i],
        windSpeedMax: weatherJson.daily.wind_speed_10m_max[i],
        condition: getWeatherCondition(weatherJson.daily.weather_code[i]),
      }));

      const data: WeatherData = {
        location: { name, latitude, longitude, timezone, country, admin1 },
        current,
        hourly,
        daily,
        airQuality,
        lastUpdated: Date.now(),
      };

      this.currentData = data;
      this.cacheData(data);
      this.notify();

      return data;
    } catch (e) {
      console.error('[WEATHER] Refresh failed:', e);
      return null;
    }
  }

  public startAutoRefresh(): void {
    if (this.refreshInterval) return;

    this.refresh();

    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, this.refreshIntervalMs);
    
    // Also start alert checking
    this.startAlertChecking();
  }

  public stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.stopAlertChecking();
  }

  public destroy(): void {
    this.stopAutoRefresh();
    this.stopAlertChecking();
    this.observers = [];
    this.alertObservers = [];
    this.currentData = null;
  }

  public formatTemperature(temp: number, unit: 'C' | 'F' = 'F'): string {
    // Weather API returns Fahrenheit (temperature_unit=fahrenheit), so no conversion needed
    return `${Math.round(temp)}°F`;
  }

  public formatTemperatureOnlyFahrenheit(temp: number): string {
    // Weather API returns Fahrenheit, so just round the value
    return `${Math.round(temp)}°F`;
  }

  public getWindDirectionLabel(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  /**
   * Get Doppler radar data for a location using RainViewer API
   */
  public async getRadarData(latitude: number, longitude: number): Promise<RadarData | null> {
    try {
      // RainViewer API for radar data
      const url = `https://api.rainviewer.com/public/weather-maps.json`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.radar || !data.radar.past) {
        return null;
      }

      // Get the latest frames (last 6 frames = 3 hours of history)
      const frames: RadarFrame[] = data.radar.past.slice(-6).map((frame: any) => ({
        time: frame.time,
        path: frame.path,
      }));

      // Add nowcast frames if available (future predictions)
      if (data.radar.nowcast) {
        frames.push(...data.radar.nowcast.slice(0, 3).map((frame: any) => ({
          time: frame.time,
          path: frame.path,
        })));
      }

      return {
        frames,
        bounds: {
          north: latitude + 2,
          south: latitude - 2,
          east: longitude + 2,
          west: longitude - 2,
        },
        generated: data.generated,
      };
    } catch (e) {
      console.error('[WEATHER] Radar data fetch failed:', e);
      return null;
    }
  }

  /**
   * Get radar tile URL for a specific frame
   */
  public getRadarTileUrl(path: string, z: number, x: number, y: number, colorScheme = 4): string {
    return `https://tilecache.rainviewer.com${path}/${z}/${x}/${y}/${colorScheme}/1_1.png`;
  }

  /**
   * Get static radar map URL for embedding
   */
  public getRadarEmbedUrl(latitude: number, longitude: number, zoom = 7): string {
    // Use Windy.com embed as a reliable radar display
    return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=default&metricTemp=default&metricWind=default&zoom=${zoom}&overlay=radar&marker=${latitude},${longitude}&lat=${latitude}&lon=${longitude}`;
  }

  /**
   * Get alternate radar map URL (RainViewer)
   */
  public getRainViewerUrl(latitude: number, longitude: number, zoom = 7): string {
    return `https://www.rainviewer.com/weather-radar-map-live.html?lat=${latitude}&lon=${longitude}&zoom=${zoom}&oFa=0&oC=1&oU=0&oCS=1&oF=0&oAP=1&c=4&o=83&lm=1&layer=radar&sm=1&sn=1&`;
  }

  /**
   * Get weather alerts for a location using National Weather Service API (US only)
   * Falls back to checking weather conditions for non-US locations
   */
  public async getWeatherAlerts(latitude: number, longitude: number): Promise<WeatherAlertsData | null> {
    try {
      // National Weather Service API (US only)
      const url = `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'JARVIS-Weather-App/1.0'
        }
      });
      
      if (!response.ok) {
        // NWS API returns 404 for non-US locations
        return null;
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return { alerts: [], lastChecked: Date.now() };
      }
      
      const alerts: WeatherAlert[] = data.features.map((feature: any) => ({
        id: feature.properties.id,
        title: feature.properties.headline || feature.properties.event,
        description: feature.properties.description,
        severity: feature.properties.severity?.toLowerCase() || 'unknown',
        urgency: feature.properties.urgency?.toLowerCase() || 'unknown',
        event: feature.properties.event,
        effective: new Date(feature.properties.effective),
        expires: new Date(feature.properties.expires),
        areaDesc: feature.properties.areaDesc,
        instruction: feature.properties.instruction,
        sender: feature.properties.senderName,
      }));
      
      return {
        alerts,
        lastChecked: Date.now(),
      };
    } catch (e) {
      console.warn('[WEATHER] Alerts fetch failed:', e);
      return null;
    }
  }

  /**
   * Check for severe weather based on current conditions
   * Used as fallback when NWS API is not available
   */
  public checkSevereWeather(data: WeatherData): { hasAlerts: boolean; alerts: WeatherAlert[] } {
    const alerts: WeatherAlert[] = [];
    const { current, daily } = data;
    
    // Check for extreme temperatures
    if (current.temperature >= 100) {
      alerts.push({
        id: `temp-high-${Date.now()}`,
        title: 'Excessive Heat Warning',
        description: `Current temperature is ${Math.round(current.temperature)}°F. Extreme heat can be dangerous.`,
        severity: 'severe',
        urgency: 'immediate',
        event: 'Excessive Heat',
        effective: new Date(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        areaDesc: data.location.name,
        instruction: 'Stay hydrated, avoid outdoor activities during peak heat.',
        sender: 'JARVIS Weather Monitor',
      });
    }
    
    if (current.temperature <= 32) {
      alerts.push({
        id: `freeze-${Date.now()}`,
        title: 'Freeze Warning',
        description: `Current temperature is ${Math.round(current.temperature)}°F. Frost and freeze conditions expected.`,
        severity: 'moderate',
        urgency: 'expected',
        event: 'Freeze Warning',
        effective: new Date(),
        expires: new Date(Date.now() + 12 * 60 * 60 * 1000),
        areaDesc: data.location.name,
        instruction: 'Protect sensitive plants and outdoor plumbing.',
        sender: 'JARVIS Weather Monitor',
      });
    }
    
    // Check for high wind
    if (current.windSpeed >= 25) {
      alerts.push({
        id: `wind-${Date.now()}`,
        title: 'High Wind Warning',
        description: `Wind speeds of ${Math.round(current.windSpeed)} mph with gusts up to ${Math.round(current.windGusts)} mph.`,
        severity: 'moderate',
        urgency: 'immediate',
        event: 'High Wind',
        effective: new Date(),
        expires: new Date(Date.now() + 6 * 60 * 60 * 1000),
        areaDesc: data.location.name,
        instruction: 'Secure loose outdoor objects. Use caution when driving.',
        sender: 'JARVIS Weather Monitor',
      });
    }
    
    // Check for severe weather codes
    const severeCodes = [95, 96, 99]; // Thunderstorm, thunderstorm with hail
    if (severeCodes.includes(current.condition.code)) {
      alerts.push({
        id: `storm-${Date.now()}`,
        title: 'Severe Thunderstorm Warning',
        description: `Thunderstorms with ${current.condition.description.toLowerCase()} detected in your area.`,
        severity: 'severe',
        urgency: 'immediate',
        event: 'Severe Thunderstorm',
        effective: new Date(),
        expires: new Date(Date.now() + 3 * 60 * 60 * 1000),
        areaDesc: data.location.name,
        instruction: 'Seek shelter indoors immediately. Avoid windows and electrical equipment.',
        sender: 'JARVIS Weather Monitor',
      });
    }
    
    return { hasAlerts: alerts.length > 0, alerts };
  }

  /**
   * Format alert for speech - concise version for TTS
   */
  public formatAlertForSpeech(alert: WeatherAlert): string {
    const severityText = alert.severity === 'extreme' ? 'Extreme' : 
                        alert.severity === 'severe' ? 'Severe' : 
                        alert.severity === 'moderate' ? 'Moderate' : 'Minor';
    
    let speech = `${severityText} Weather Alert: ${alert.event} for ${alert.areaDesc}. `;
    
    // Add a brief description (first sentence only, max 100 chars)
    const briefDesc = alert.description.split('.')[0].substring(0, 100);
    speech += briefDesc + '. ';
    
    if (alert.instruction) {
      const briefInstruction = alert.instruction.split('.')[0].substring(0, 100);
      speech += `Instruction: ${briefInstruction}.`;
    }
    
    return speech;
  }
}

export const weatherService = new WeatherService();
