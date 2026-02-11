/**
 * Conversational Data Formatter
 * 
 * Transforms raw sensor data, weather info, and system stats into natural,
 * human-like responses that provide context and insights rather than just facts.
 */

import { jarvisPersonality } from './jarvisPersonality';

interface SensorData {
  type: 'temperature' | 'humidity' | 'pressure' | 'power' | 'energy' | 'light' | 'motion' | 'generic';
  value: number | string;
  unit?: string;
  location?: string;
  name?: string;
  timestamp?: number;
  previousValue?: number;
  threshold?: { min?: number; max?: number };
}

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  condition: string;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  location: string;
}

interface SystemStats {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  temperature?: number;
  uptime?: number;
}

export class ConversationalFormatter {
  
  /**
   * Format weather data as a conversational response
   */
  formatWeather(data: WeatherData, includeGreeting: boolean = true): string {
    const name = jarvisPersonality.getUserName();
    const parts: string[] = [];
    
    // Opening based on conditions
    const tempF = data.temperature;
    const condition = data.condition.toLowerCase();
    
    // Temperature description with personality
    if (tempF < 32) {
      parts.push(`It's freezing out there${name ? `, ${name}` : ''} - only ${Math.round(tempF)} degrees`);
    } else if (tempF < 50) {
      parts.push(`It's quite chilly at ${Math.round(tempF)} degrees`);
    } else if (tempF < 65) {
      parts.push(`It's a cool ${Math.round(tempF)} degrees`);
    } else if (tempF < 75) {
      parts.push(`It's a pleasant ${Math.round(tempF)} degrees`);
    } else if (tempF < 85) {
      parts.push(`It's warm out there - ${Math.round(tempF)} degrees`);
    } else {
      parts.push(`It's pretty hot${name ? `, ${name}` : ''} - ${Math.round(tempF)} degrees`);
    }
    
    // Condition context
    if (condition.includes('rain') || condition.includes('shower')) {
      parts.push(`and raining. You might want an umbrella if you're heading out`);
    } else if (condition.includes('snow')) {
      parts.push(`with snow. Drive carefully if you're going anywhere`);
    } else if (condition.includes('cloud') || condition.includes('overcast')) {
      parts.push(`and overcast`);
    } else if (condition.includes('sun') || condition.includes('clear')) {
      parts.push(`and sunny`);
    }
    
    // Humidity context
    if (data.humidity > 70) {
      parts.push(`It's also quite humid at ${data.humidity}%`);
    } else if (data.humidity < 30) {
      parts.push(`The air is pretty dry at ${data.humidity}% humidity`);
    }
    
    // Wind context
    const windMph = Math.round(data.windSpeed * 0.621371);
    if (windMph > 20) {
      parts.push(`Winds are strong at ${windMph} mph from the ${this.getWindDirection(data.windDirection)}`);
    } else if (windMph > 10) {
      parts.push(`There's a gentle breeze at ${windMph} mph`);
    }
    
    // Feels like comparison
    if (Math.abs(data.feelsLike - data.temperature) > 3) {
      if (data.feelsLike < data.temperature) {
        parts.push(`Though it feels more like ${Math.round(data.feelsLike)} with the wind`);
      } else {
        parts.push(`Though it feels more like ${Math.round(data.feelsLike)} with the humidity`);
      }
    }
    
    // Suggestion
    const suggestion = this.getWeatherSuggestion(tempF, condition, data.humidity);
    if (suggestion) {
      parts.push(suggestion);
    }
    
    return parts.join('. ') + '.';
  }

  /**
   * Format temperature sensor data
   */
  formatTemperatureSensor(data: SensorData): string {
    const name = jarvisPersonality.getUserName();
    const value = typeof data.value === 'number' ? data.value : parseFloat(data.value as string);
    const location = data.location || 'the room';
    const sensorName = data.name || 'sensor';
    
    let response = '';
    
    // Indoor vs outdoor context
    const isIndoor = !location.toLowerCase().includes('outside') && 
                     !location.toLowerCase().includes('outdoor');
    
    if (isIndoor) {
      if (value < 60) {
        response = `It's quite cool in ${location} - only ${Math.round(value)} degrees. You might want to turn up the heat`;
      } else if (value < 68) {
        response = `It's a bit chilly in ${location} at ${Math.round(value)} degrees`;
      } else if (value > 78) {
        response = `It's getting warm in ${location} - ${Math.round(value)} degrees. You might want to cool things down`;
      } else if (value > 74) {
        response = `It's comfortable but slightly warm in ${location} at ${Math.round(value)} degrees`;
      } else {
        response = `The temperature in ${location} is a pleasant ${Math.round(value)} degrees`;
      }
    } else {
      // Outdoor sensor
      if (value < 40) {
        response = `It's cold outside${name ? `, ${name}` : ''} - ${Math.round(value)} degrees`;
      } else if (value > 85) {
        response = `It's hot out there - ${Math.round(value)} degrees`;
      } else {
        response = `Outside temperature is ${Math.round(value)} degrees`;
      }
    }
    
    // Add trend if previous value available
    if (data.previousValue !== undefined) {
      const diff = value - data.previousValue;
      if (Math.abs(diff) > 1) {
        if (diff > 0) {
          response += `. That's up ${Math.round(diff)} degrees from earlier`;
        } else {
          response += `. That's down ${Math.round(Math.abs(diff))} degrees from earlier`;
        }
      }
    }
    
    return response + '.';
  }

  /**
   * Format solar/power data
   */
  formatSolarProduction(powerKw: number, dailyTotalKwh?: number): string {
    const name = jarvisPersonality.getUserName();
    const powerW = Math.round(powerKw * 1000);
    
    let response = '';
    
    if (powerKw > 5) {
      response = `Your panels are producing excellently right now${name ? `, ${name}` : ''} - `;
      response += `${powerKw.toFixed(1)} kilowatts. `;
      response += `That's really strong output`;
    } else if (powerKw > 2) {
      response = `Your solar is producing well - ${powerKw.toFixed(1)} kilowatts right now`;
    } else if (powerKw > 0.5) {
      response = `You're generating ${powerKw.toFixed(1)} kilowatts from solar - decent for current conditions`;
    } else if (powerKw > 0) {
      response = `Your panels are producing a small amount - ${powerW} watts. `;
      response += `Probably early morning, late evening, or cloudy`;
    } else {
      response = `Your panels aren't producing any power right now${name ? `, ${name}` : ''}. `;
      response += `It's probably night time or very overcast`;
    }
    
    if (dailyTotalKwh !== undefined && dailyTotalKwh > 0) {
      response += `. You've generated ${dailyTotalKwh.toFixed(1)} kilowatt-hours today`;
      
      // Context for daily production
      if (dailyTotalKwh > 30) {
        response += ` - excellent day's production`;
      } else if (dailyTotalKwh > 15) {
        response += ` - solid output for the day`;
      }
    }
    
    return response + '.';
  }

  /**
   * Format energy consumption
   */
  formatEnergyConsumption(currentKw: number, dailyKwh?: number): string {
    const name = jarvisPersonality.getUserName();
    
    let response = '';
    
    if (currentKw > 5) {
      response = `You're using quite a bit of power right now - ${currentKw.toFixed(1)} kilowatts. `;
      response += `Is the AC running, or maybe laundry?`;
    } else if (currentKw > 2) {
      response = `Current usage is ${currentKw.toFixed(1)} kilowatts - moderate consumption`;
    } else if (currentKw > 0.5) {
      response = `You're using ${currentKw.toFixed(1)} kilowatts right now - pretty efficient`;
    } else {
      response = `Power usage is low at the moment${name ? `, ${name}` : ''} - only ${(currentKw * 1000).toFixed(0)} watts. `;
      response += `Most things must be turned off`;
    }
    
    if (dailyKwh !== undefined) {
      response += `. Today's total is ${dailyKwh.toFixed(1)} kilowatt-hours`;
    }
    
    return response + '.';
  }

  /**
   * Format system/hardware stats
   */
  formatSystemStats(stats: SystemStats): string {
    const parts: string[] = [];
    
    if (stats.cpuUsage !== undefined) {
      if (stats.cpuUsage > 80) {
        parts.push(`Your system is working hard - CPU is at ${Math.round(stats.cpuUsage)}%`);
      } else if (stats.cpuUsage > 50) {
        parts.push(`CPU usage is moderate at ${Math.round(stats.cpuUsage)}%`);
      } else {
        parts.push(`System is running smoothly - CPU at ${Math.round(stats.cpuUsage)}%`);
      }
    }
    
    if (stats.memoryUsage !== undefined) {
      if (stats.memoryUsage > 85) {
        parts.push(`Memory is getting full at ${Math.round(stats.memoryUsage)}%`);
      } else {
        parts.push(`Memory usage is at ${Math.round(stats.memoryUsage)}%`);
      }
    }
    
    if (stats.temperature !== undefined) {
      if (stats.temperature > 80) {
        parts.push(`Temperature is running warm at ${Math.round(stats.temperature)}°C`);
      }
    }
    
    if (parts.length === 0) {
      return `All systems are operating normally.`;
    }
    
    return parts.join('. ') + '.';
  }

  /**
   * Format a list of sensors naturally
   */
  formatSensorList(sensors: Array<{ name: string; value: string | number; unit?: string }>): string {
    if (sensors.length === 0) {
      return `I don't see any sensor data available right now.`;
    }
    
    if (sensors.length === 1) {
      const s = sensors[0];
      return `${s.name} is showing ${s.value}${s.unit ? ' ' + s.unit : ''}.`;
    }
    
    // Multiple sensors - group them naturally
    const name = jarvisPersonality.getUserName();
    let response = name ? `Here's what I'm seeing, ${name}: ` : `Here's what I'm seeing: `;
    
    const descriptions = sensors.map(s => {
      return `${s.name} is at ${s.value}${s.unit ? ' ' + s.unit : ''}`;
    });
    
    if (descriptions.length === 2) {
      response += descriptions.join(' and ');
    } else {
      const last = descriptions.pop();
      response += descriptions.join(', ') + ', and ' + last;
    }
    
    return response + '.';
  }

  /**
   * Format a timer/reminder completion
   */
  formatTimerCompletion(timerName: string): string {
    const name = jarvisPersonality.getUserName();
    const lowerName = timerName.toLowerCase();
    
    if (lowerName.includes('work') || lowerName.includes('focus') || lowerName.includes('task')) {
      return name 
        ? `${name}, your focused work time has concluded. How did it go?`
        : `Your focused work time has concluded. How did it go?`;
    }
    
    if (lowerName.includes('break') || lowerName.includes('rest')) {
      return name
        ? `Your break time is up, ${name}. Ready to get back to it?`
        : `Your break time is up. Ready to get back to it?`;
    }
    
    if (lowerName.includes('cook') || lowerName.includes('food') || lowerName.includes('meal')) {
      return `Your cooking timer has finished. Time to check on the food!`;
    }
    
    if (lowerName.includes('exercise') || lowerName.includes('workout')) {
      return name
        ? `Workout's done, ${name}! Great job getting that in.`
        : `Workout's done! Great job getting that in.`;
    }
    
    return name
      ? `${name}, your timer for "${timerName}" has finished.`
      : `Your timer for "${timerName}" has finished.`;
  }

  /**
   * Format a success/completion message
   */
  formatSuccess(action: string): string {
    const responses = [
      `Done! ${action}`,
      `All set - ${action}`,
      `Got it. ${action}`,
      `Taken care of. ${action}`,
      `Finished. ${action}`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Helper methods
  
  private getWindDirection(degrees: number): string {
    const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  private getWeatherSuggestion(temp: number, condition: string, humidity: number): string | null {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('rain') || lowerCondition.includes('shower')) {
      return `Might be a good day to stay in`;
    }
    
    if (temp > 85 && humidity > 60) {
      return `Stay hydrated if you're going out`;
    }
    
    if (temp > 70 && temp < 80 && (lowerCondition.includes('sun') || lowerCondition.includes('clear'))) {
      return `Beautiful day - perfect for being outside`;
    }
    
    if (temp < 40) {
      return `Bundle up if you're heading out`;
    }
    
    return null;
  }
}

export const conversationalFormatter = new ConversationalFormatter();
