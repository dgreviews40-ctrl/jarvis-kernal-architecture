import React, { useState, useEffect } from 'react';
import {
  Cloud, Sun, Droplets, Wind, Gauge,
  MapPin, Search, RefreshCw, Sunrise, Sunset,
  Loader2
} from 'lucide-react';
import {
  weatherService,
  WeatherData,
  WeatherLocation,
  HourlyForecast,
  DailyForecast,
} from '../services/weather';

type TemperatureUnit = 'C' | 'F';

const formatTemp = (temp: number, unit: TemperatureUnit): string => {
  // Weather service already returns Fahrenheit (temperature_unit=fahrenheit in API call)
  // So we just round the value, no conversion needed
  return `${Math.round(temp)}°`;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatDay = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short' });
};

const getAQIColor = (aqi: number): string => {
  if (aqi <= 50) return 'text-green-400';
  if (aqi <= 100) return 'text-yellow-400';
  if (aqi <= 150) return 'text-orange-400';
  if (aqi <= 200) return 'text-red-400';
  if (aqi <= 300) return 'text-purple-400';
  return 'text-rose-600';
};

const getAQILabel = (aqi: number): string => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

const getWindDirection = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % 8];
};

interface HourlyCardProps {
  hour: HourlyForecast;
  unit: TemperatureUnit;
}

const HourlyCard: React.FC<HourlyCardProps> = ({ hour, unit }) => (
  <div className="flex flex-col items-center min-w-[60px] p-2 bg-[#111] rounded-lg border border-[#222]">
    <span className="text-[10px] text-gray-500 mb-1">
      {formatTime(hour.time)}
    </span>
    <span className="text-lg mb-1">{hour.condition.icon}</span>
    <span className="text-sm font-bold text-white">
      {formatTemp(hour.temperature, unit)}
    </span>
    {hour.precipitationProbability > 0 && (
      <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
        <Droplets size={8} />
        {hour.precipitationProbability}%
      </span>
    )}
  </div>
);

interface DailyRowProps {
  day: DailyForecast;
  unit: TemperatureUnit;
}

const DailyRow: React.FC<DailyRowProps> = ({ day, unit }) => (
  <div className="flex items-center justify-between py-2 border-b border-[#222] last:border-0">
    <div className="flex items-center gap-3 w-24">
      <span className="text-lg">{day.condition.icon}</span>
      <span className="text-sm text-gray-300">{formatDay(day.date)}</span>
    </div>
    {day.precipitationProbabilityMax > 0 && (
      <span className="text-xs text-blue-400 flex items-center gap-1">
        <Droplets size={10} />
        {day.precipitationProbabilityMax}%
      </span>
    )}
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 w-10 text-right">
        {formatTemp(day.tempMin, unit)}
      </span>
      <div className="w-16 h-1.5 bg-gradient-to-r from-blue-500 via-gray-500 to-orange-500 rounded-full" />
      <span className="text-sm font-bold text-white w-10">
        {formatTemp(day.tempMax, unit)}
      </span>
    </div>
  </div>
);

// Popular cities for quick selection
const POPULAR_CITIES: WeatherLocation[] = [
  { name: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', country: 'United States', admin1: 'New York' },
  { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles', country: 'United States', admin1: 'California' },
  { name: 'Chicago', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago', country: 'United States', admin1: 'Illinois' },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', country: 'United Kingdom' },
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', country: 'Japan' },
];

const WeatherDashboard: React.FC = () => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [showSearch, setShowSearch] = useState(true);
  const [unit, setUnit] = useState<TemperatureUnit>('F');
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = weatherService.subscribe(setData);
    weatherService.startAutoRefresh();

    // If location already set, hide search
    if (weatherService.getLocation()) {
      setShowSearch(false);
      setInitializing(false);
    } else {
      // No location saved - auto-load default city (New York)
      const defaultCity = POPULAR_CITIES[0]; // New York
      setLoading(true);
      weatherService.setLocation(defaultCity).then(() => {
        setShowSearch(false);
        setLoading(false);
        setInitializing(false);
      }).catch(() => {
        setInitializing(false);
        setLoading(false);
      });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    const results = await weatherService.searchLocations(searchQuery);
    if (results.length === 0) {
      setError('No cities found. Try a different search.');
    }
    setSearchResults(results);
    setLoading(false);
  };

  const handleSelectLocation = async (location: WeatherLocation) => {
    setLoading(true);
    setError(null);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    await weatherService.setLocation(location);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await weatherService.refresh();
    setLoading(false);
  };

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    const success = await weatherService.useCurrentLocation();
    if (success) {
      setShowSearch(false);
    } else {
      setError('Could not get your location. Please search for a city instead.');
    }
    setLoading(false);
  };

  // Show loading state while initializing
  if (initializing || (loading && !data)) {
    return (
      <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg p-6 flex flex-col items-center justify-center">
        <Cloud className="text-cyan-500 mb-4" size={48} />
        <Loader2 size={32} className="text-cyan-400 animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Loading weather data...</p>
      </div>
    );
  }

  // No data yet - show search interface
  if (!data) {
    return (
      <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Cloud className="text-cyan-500" size={24} />
          <h2 className="text-lg font-bold text-white">WEATHER STATION</h2>
        </div>

        {/* Search Form */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a city..."
              className="flex-1 bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
          </form>

          <button
            onClick={handleUseCurrentLocation}
            disabled={loading}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <MapPin size={14} />
            Use my current location
          </button>

          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs text-gray-500 mb-2 font-medium">SEARCH RESULTS</h3>
            <div className="space-y-1">
              {searchResults.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectLocation(loc)}
                  className="w-full text-left p-3 text-sm text-gray-300 hover:bg-[#1a1a1a] rounded-lg transition-colors border border-[#222]"
                >
                  <span className="font-medium text-white">{loc.name}</span>
                  {loc.admin1 && <span className="text-gray-500">, {loc.admin1}</span>}
                  {loc.country && <span className="text-gray-500">, {loc.country}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Popular Cities */}
        {searchResults.length === 0 && (
          <div className="flex-1">
            <h3 className="text-xs text-gray-500 mb-3 font-medium">POPULAR CITIES</h3>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_CITIES.map((city, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectLocation(city)}
                  disabled={loading}
                  className="p-3 text-left bg-[#111] border border-[#222] rounded-lg hover:border-cyan-500/50 transition-colors disabled:opacity-50"
                >
                  <span className="text-white font-medium">{city.name}</span>
                  <span className="text-gray-500 text-xs block">{city.country}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { current, hourly, daily, airQuality, location } = data;

  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg p-4 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className="text-cyan-500" size={20} />
          <h2 className="text-sm font-bold text-white">WEATHER STATION</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Temperature Unit Toggle */}
          <button
            onClick={() => setUnit(u => u === 'F' ? 'C' : 'F')}
            className="text-xs px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-gray-400 hover:text-white transition-colors"
          >
            °{unit}
          </button>
          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <Search size={16} />
          </button>
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="mb-4 p-3 bg-[#111] border border-[#333] rounded-lg">
          <form onSubmit={handleSearch} className="flex gap-2 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city..."
              className="flex-1 bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </form>
          <button
            onClick={handleUseCurrentLocation}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <MapPin size={12} />
            Use current location
          </button>
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectLocation(loc)}
                  className="w-full text-left p-2 text-sm text-gray-300 hover:bg-[#1a1a1a] rounded transition-colors"
                >
                  <span className="font-medium">{loc.name}</span>
                  {loc.admin1 && <span className="text-gray-500">, {loc.admin1}</span>}
                  {loc.country && <span className="text-gray-500">, {loc.country}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Location */}
      <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
        <MapPin size={12} />
        <span>{location.name}</span>
        {location.admin1 && <span>, {location.admin1}</span>}
      </div>

      {/* Current Weather */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-4xl">{current.condition.icon}</span>
            <span className="text-4xl font-bold text-white">
              {formatTemp(current.temperature, unit)}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{current.condition.description}</p>
          <p className="text-xs text-gray-500">
            Feels like {formatTemp(current.feelsLike, unit)}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1 text-gray-400">
            <Droplets size={12} className="text-blue-400" />
            <span>{current.humidity}%</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Wind size={12} className="text-gray-400" />
            <span>{Math.round(current.windSpeed)} km/h {getWindDirection(current.windDirection)}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Gauge size={12} className="text-purple-400" />
            <span>{Math.round(current.pressure)} hPa</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Sun size={12} className="text-yellow-400" />
            <span>UV {current.uvIndex}</span>
          </div>
        </div>
      </div>

      {/* Air Quality */}
      {airQuality && (
        <div className="mb-4 p-2 bg-[#111] border border-[#222] rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Air Quality</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${getAQIColor(airQuality.aqi)}`}>
                {airQuality.aqi} AQI
              </span>
              <span className={`text-xs ${getAQIColor(airQuality.aqi)}`}>
                {getAQILabel(airQuality.aqi)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hourly Forecast */}
      <div className="mb-4">
        <h3 className="text-xs text-gray-500 mb-2 font-medium">HOURLY FORECAST</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {hourly.slice(0, 12).map((hour, i) => (
            <HourlyCard key={i} hour={hour} unit={unit} />
          ))}
        </div>
      </div>

      {/* 7-Day Forecast */}
      <div className="flex-1 min-h-0">
        <h3 className="text-xs text-gray-500 mb-2 font-medium">7-DAY FORECAST</h3>
        <div className="overflow-y-auto custom-scrollbar h-full">
          {daily.map((day, i) => (
            <DailyRow key={i} day={day} unit={unit} />
          ))}
        </div>
      </div>

      {/* Sunrise/Sunset */}
      {daily[0] && (
        <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-[#222]">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Sunrise size={14} className="text-orange-400" />
            <span>{formatTime(daily[0].sunrise)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Sunset size={14} className="text-purple-400" />
            <span>{formatTime(daily[0].sunset)}</span>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-[10px] text-gray-600 text-center mt-2">
        Updated {new Date(data.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default WeatherDashboard;
