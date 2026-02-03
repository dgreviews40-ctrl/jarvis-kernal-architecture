/**
 * Integration Hub
 * Central router for all external integrations
 */

import { calendar } from './calendar';
import { weather } from './weather';
import { news } from './news';
import { webSearch } from './webSearch';
import { taskAutomation } from './taskAutomation';

export interface IntegrationResult {
  handled: boolean;
  response?: string;
  action?: string;
  data?: any;
}

export interface IntegrationConfig {
  weatherApiKey?: string;
  defaultLocation?: string;
  newsApiKey?: string;
  searchApiKey?: string;
  searchEngineId?: string;
  userInterests?: string[];
}

class IntegrationHub {
  private config: IntegrationConfig = {};

  public configure(config: IntegrationConfig): void {
    this.config = config;

    if (config.weatherApiKey) {
      weather.configure(config.weatherApiKey, config.defaultLocation);
    }
    if (config.newsApiKey) {
      news.configure(config.newsApiKey);
    }
    if (config.userInterests) {
      news.setInterests(config.userInterests);
    }
    if (config.searchApiKey) {
      webSearch.configure(config.searchApiKey, config.searchEngineId);
    }
  }

  /**
   * Route user input to appropriate integration
   */
  public async route(input: string): Promise<IntegrationResult> {
    const lower = input.toLowerCase();

    // 1. Check for reminders/tasks
    const reminder = calendar.parseReminder(input);
    if (reminder) {
      const id = calendar.setReminder(reminder);
      return {
        handled: true,
        response: `I've set a reminder to ${reminder.text} at ${reminder.time.toLocaleString()}.`,
        action: 'reminder_set',
        data: { id, reminder }
      };
    }

    const task = taskAutomation.parseTask(input);
    if (task && task.title) {
      const newTask = taskAutomation.createTask(task as any);
      return {
        handled: true,
        response: `I've added "${newTask.title}" to your tasks.`,
        action: 'task_created',
        data: newTask
      };
    }

    // 2. Check for automation
    const automation = taskAutomation.parseAutomation(input);
    if (automation) {
      const rule = taskAutomation.createRule(automation.name, automation.trigger, automation.actions);
      return {
        handled: true,
        response: `I've created an automation: "${rule.name}".`,
        action: 'automation_created',
        data: rule
      };
    }

    // 3. Check for weather queries
    if (lower.includes('weather') || lower.match(/\b(hot|cold|rain|snow|sunny|temperature)\b/)) {
      const query = weather.parseWeatherQuery(input);
      try {
        const data = await weather.getCurrent(query.location);
        if (data) {
          return {
            handled: true,
            response: weather.getNaturalSummary(data),
            action: 'weather_report',
            data
          };
        }
      } catch (e) {
        return {
          handled: true,
          response: "I'm having trouble getting the weather right now. Please check your weather API configuration.",
          action: 'weather_error'
        };
      }
    }

    // 4. Check for news queries
    if (lower.includes('news') || lower.includes('headlines') || lower.includes('briefing')) {
      const query = news.parseNewsQuery(input);
      try {
        if (query.type === 'briefing') {
          const briefing = await news.getBriefing({ timeRange: this.getTimeRange() });
          return {
            handled: true,
            response: briefing,
            action: 'news_briefing'
          };
        }
        if (query.query) {
          const articles = await news.search(query.query);
          return {
            handled: true,
            response: this.formatNewsResults(articles),
            action: 'news_search',
            data: articles
          };
        }
      } catch (e) {
        return {
          handled: true,
          response: "I'm having trouble getting news updates right now.",
          action: 'news_error'
        };
      }
    }

    // 5. Check for web search
    if (webSearch.isSearchQuery(input)) {
      try {
        // Try knowledge graph first
        const knowledge = await webSearch.getKnowledge(input);
        if (knowledge) {
          return {
            handled: true,
            response: `${knowledge.title}: ${knowledge.description}`,
            action: 'knowledge_answer',
            data: knowledge
          };
        }

        // Fall back to web search
        const results = await webSearch.search(input.replace(/search for|look up|google/i, '').trim());
        return {
          handled: true,
          response: webSearch.summarizeResults(results, input),
          action: 'web_search',
          data: results
        };
      } catch (e) {
        return {
          handled: true,
          response: "I'm having trouble searching the web right now.",
          action: 'search_error'
        };
      }
    }

    // 6. Check for calendar queries
    if (lower.includes('schedule') || lower.includes('upcoming') || lower.includes('what do i have')) {
      const events = calendar.getUpcoming(24);
      if (events.length === 0) {
        return {
          handled: true,
          response: "You have no upcoming events in the next 24 hours.",
          action: 'calendar_check'
        };
      }
      return {
        handled: true,
        response: `You have ${events.length} upcoming event${events.length > 1 ? 's' : ''}:\n` +
          events.map(e => `• ${e.title} at ${e.startTime.toLocaleTimeString()}`).join('\n'),
        action: 'calendar_check',
        data: events
      };
    }

    // 7. Check for task queries
    if (lower.includes('my tasks') || lower.includes('to do') || lower.includes('todo list')) {
      const tasks = taskAutomation.getTasks({ status: 'pending' });
      if (tasks.length === 0) {
        return {
          handled: true,
          response: "You have no pending tasks. Great job!",
          action: 'task_list'
        };
      }
      return {
        handled: true,
        response: `You have ${tasks.length} pending task${tasks.length > 1 ? 's' : ''}:\n` +
          tasks.slice(0, 5).map(t => `• ${t.title}${t.dueDate ? ` (due ${t.dueDate.toLocaleDateString()})` : ''}`).join('\n'),
        action: 'task_list',
        data: tasks
      };
    }

    // Not handled by any integration
    return { handled: false };
  }

  /**
   * Get all integration capabilities
   */
  public getCapabilities(): string[] {
    return [
      '📅 Calendar & Reminders - "Remind me to call mom at 5pm"',
      '🌤️ Weather - "What\'s the weather like?"',
      '📰 News & Briefings - "Give me the morning briefing"',
      '🔍 Web Search - "Search for quantum computing"',
      '✅ Tasks - "Add task: Finish report due tomorrow"',
      '⚡ Automations - "Every morning tell me the weather"',
      '📊 Knowledge - "What is machine learning?"'
    ];
  }

  private getTimeRange(): 'morning' | 'day' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'day';
    return 'evening';
  }

  private formatNewsResults(articles: any[]): string {
    if (articles.length === 0) return "I couldn't find any news on that topic.";
    
    return articles.map((a, i) => 
      `${i + 1}. **${a.title}**\n   ${a.summary}`
    ).join('\n\n');
  }

  // Expose individual services
  public get calendar() { return calendar; }
  public get weather() { return weather; }
  public get news() { return news; }
  public get webSearch() { return webSearch; }
  public get taskAutomation() { return taskAutomation; }
}

export const integrationHub = new IntegrationHub();
export { calendar, weather, news, webSearch, taskAutomation };
