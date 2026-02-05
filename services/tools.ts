/**
 * Tool/Function Calling System for JARVIS AI Engine v1.1
 * 
 * Enables AI to call structured functions for:
 * - Home Assistant control
 * - Memory operations
 * - Timer/reminder management
 * - File generation
 * - Web search
 * - Weather queries
 */

import { AIProvider } from '../types';
import { logger } from './logger';
import { haService } from './home_assistant';
import { vectorMemoryService } from './vectorMemoryService';
import { taskAutomation } from './integrations/taskAutomation';
import { fileGeneratorService } from './fileGenerator';
import { weatherService } from './weather';
import { searchService } from './search';
import { vision } from './vision';

// ==================== TYPES ====================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];  // For string parameters with specific values
  default?: any;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>) => Promise<ToolResult>;
  requiresConfirmation?: boolean;  // For destructive operations
  category: 'smart_home' | 'memory' | 'productivity' | 'information' | 'creative';
}

export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
  display?: string;  // Human-readable result for AI
}

export interface ToolCall {
  tool: string;
  parameters: Record<string, any>;
}

// ==================== TOOL REGISTRY ====================

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    logger.log('KERNEL', `Registered tool: ${tool.name}`, 'info');
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: Tool['category']): Tool[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Get tool definitions for AI provider
   */
  getDefinitionsForProvider(provider: AIProvider): any[] {
    const tools = this.getAll();
    
    switch (provider) {
      case AIProvider.GEMINI:
        return tools.map(t => this.toGeminiFormat(t));
      case AIProvider.OLLAMA:
        return tools.map(t => this.toOllamaFormat(t));
      default:
        return [];
    }
  }

  /**
   * Execute a tool call
   */
  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.get(call.tool);
    if (!tool) {
      return {
        success: false,
        data: null,
        error: `Tool '${call.tool}' not found`
      };
    }

    try {
      logger.log('KERNEL', `Executing tool: ${call.tool}`, 'info', call.parameters);
      const result = await tool.execute(call.parameters);
      logger.log('KERNEL', `Tool ${call.tool} completed: ${result.success ? 'success' : 'failed'}`, result.success ? 'success' : 'error');
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('ERROR', `Tool ${call.tool} error: ${errMsg}`, 'error');
      return {
        success: false,
        data: null,
        error: errMsg
      };
    }
  }

  /**
   * Parse tool calls from AI response
   */
  parseToolCalls(response: string, provider: AIProvider): ToolCall[] {
    const calls: ToolCall[] = [];

    try {
      // Try to extract JSON function calls
      // Format: {"tool": "name", "parameters": {...}}
      const jsonMatches = response.match(/\{[\s\S]*?"tool"[\s\S]*?\}/g);
      
      if (jsonMatches) {
        for (const match of jsonMatches) {
          try {
            const parsed = JSON.parse(match);
            if (parsed.tool && this.get(parsed.tool)) {
              calls.push({
                tool: parsed.tool,
                parameters: parsed.parameters || {}
              });
            }
          } catch {
            // Invalid JSON, skip
          }
        }
      }

      // Alternative: Check for explicit tool call format
      // Format: call_tool("name", {...})
      const explicitMatches = response.match(/call_tool\s*\(\s*["'](\w+)["']\s*,\s*(\{[^}]*\})\s*\)/g);
      if (explicitMatches) {
        for (const match of explicitMatches) {
          const toolMatch = match.match(/call_tool\s*\(\s*["'](\w+)["']/);
          const paramsMatch = match.match(/\{(.*)\}/);
          
          if (toolMatch && paramsMatch) {
            const toolName = toolMatch[1];
            if (this.get(toolName)) {
              try {
                const params = JSON.parse(`{${paramsMatch[1]}}`);
                calls.push({ tool: toolName, parameters: params });
              } catch {
                calls.push({ tool: toolName, parameters: {} });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.log('ERROR', `Error parsing tool calls: ${error}`, 'error');
    }

    return calls;
  }

  // ==================== PRIVATE METHODS ====================

  private toGeminiFormat(tool: Tool): any {
    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce((acc, p) => ({
          ...acc,
          [p.name]: {
            type: p.type,
            description: p.description,
            ...(p.enum && { enum: p.enum })
          }
        }), {}),
        required: tool.parameters.filter(p => p.required).map(p => p.name)
      }
    };
  }

  private toOllamaFormat(tool: Tool): any {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce((acc, p) => ({
            ...acc,
            [p.name]: {
              type: p.type,
              description: p.description,
              ...(p.enum && { enum: p.enum })
            }
          }), {}),
          required: tool.parameters.filter(p => p.required).map(p => p.name)
        }
      }
    };
  }

  private registerDefaultTools(): void {
    // ==================== SMART HOME TOOLS ====================
    
    this.register({
      name: 'control_light',
      description: 'Turn lights on/off, adjust brightness, or change color',
      category: 'smart_home',
      parameters: [
        { name: 'room', type: 'string', description: 'Room name (living room, bedroom, kitchen, etc.)', required: true },
        { name: 'action', type: 'string', description: 'Action to perform', required: true, enum: ['on', 'off', 'toggle', 'brightness'] },
        { name: 'brightness', type: 'number', description: 'Brightness level (0-100)', required: false },
        { name: 'color', type: 'string', description: 'Color name or hex code', required: false }
      ],
      execute: async (params) => {
        if (!haService.initialized) {
          return { success: false, data: null, error: 'Home Assistant not connected', display: 'Home Assistant is not connected' };
        }

        try {
          // Build entity ID from room
          const room = params.room.toLowerCase().replace(/\s+/g, '_');
          const entityId = `light.${room}`;
          
          let result: string;
          switch (params.action) {
            case 'on':
              result = await haService.executeSmartCommand(['turn on', params.room, 'light']);
              break;
            case 'off':
              result = await haService.executeSmartCommand(['turn off', params.room, 'light']);
              break;
            case 'toggle':
              result = await haService.executeSmartCommand(['toggle', params.room, 'light']);
              break;
            case 'brightness':
              const brightness = Math.min(100, Math.max(0, params.brightness || 50));
              result = await haService.executeSmartCommand(['set', params.room, 'light', 'brightness', brightness.toString()]);
              break;
            default:
              return { success: false, data: null, error: 'Invalid action' };
          }

          return {
            success: true,
            data: { entityId, action: params.action },
            display: `I've ${params.action}ed the ${params.room} light. ${result}`
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    this.register({
      name: 'get_sensor_value',
      description: 'Get current value from Home Assistant sensors (temperature, humidity, energy, etc.)',
      category: 'smart_home',
      parameters: [
        { name: 'sensor_type', type: 'string', description: 'Type of sensor', required: true, enum: ['temperature', 'humidity', 'energy', 'power', 'motion', 'door', 'window', 'battery'] },
        { name: 'room', type: 'string', description: 'Room or area name', required: false },
        { name: 'entity_name', type: 'string', description: 'Specific entity name if known', required: false }
      ],
      execute: async (params) => {
        if (!haService.initialized) {
          return { success: false, data: null, error: 'Home Assistant not connected' };
        }

        try {
          const query = params.entity_name || 
                       `${params.room || ''} ${params.sensor_type}`.trim();
          
          const { searchEntities } = await import('./haEntitySearch');
          const result = await searchEntities(query);
          
          if (result.matches.length === 0) {
            return {
              success: false,
              data: null,
              error: `No ${params.sensor_type} sensor found`,
              display: `I couldn't find a ${params.sensor_type} sensor${params.room ? ` in the ${params.room}` : ''}.`
            };
          }

          const topMatch = result.matches[0];
          return {
            success: true,
            data: topMatch,
            display: `The ${topMatch.entity.attributes?.friendly_name || topMatch.entity.entity_id} is currently ${topMatch.entity.state} ${topMatch.entity.attributes?.unit_of_measurement || ''}`.trim()
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    // ==================== MEMORY TOOLS ====================

    this.register({
      name: 'remember_fact',
      description: 'Store a fact, preference, or information for later recall',
      category: 'memory',
      parameters: [
        { name: 'content', type: 'string', description: 'The information to remember', required: true },
        { name: 'category', type: 'string', description: 'Type of memory', required: false, enum: ['preference', 'fact', 'important', 'reminder'], default: 'fact' },
        { name: 'tags', type: 'array', description: 'Tags for organization', required: false }
      ],
      execute: async (params) => {
        try {
          const tags = params.tags || [params.category || 'fact', 'user_stored'];
          const memoryType = params.category === 'preference' ? 'PREFERENCE' : 
                            params.category === 'important' ? 'FACT' : 'FACT';
          
          await vectorMemoryService.store({
            id: `memory_${Date.now()}`,
            content: params.content,
            type: memoryType,
            tags,
            created: Date.now(),
            lastAccessed: Date.now()
          });

          return {
            success: true,
            data: { content: params.content },
            display: `I've stored that information: "${params.content}"`
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    this.register({
      name: 'recall_information',
      description: 'Search and retrieve previously stored information',
      category: 'memory',
      parameters: [
        { name: 'query', type: 'string', description: 'What to search for', required: true },
        { name: 'limit', type: 'number', description: 'Maximum results', required: false, default: 3 }
      ],
      execute: async (params) => {
        try {
          const results = await vectorMemoryService.recall(params.query);
          
          if (results.length === 0) {
            return {
              success: true,
              data: [],
              display: "I don't have any information about that in my memory banks."
            };
          }

          const limited = results.slice(0, params.limit || 3);
          const display = limited.map((r, i) => `${i + 1}. ${r.node.content}`).join('\n');

          return {
            success: true,
            data: limited,
            display: `Here's what I found:\n${display}`
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    // ==================== PRODUCTIVITY TOOLS ====================

    this.register({
      name: 'set_timer',
      description: 'Set a timer or reminder',
      category: 'productivity',
      parameters: [
        { name: 'duration', type: 'string', description: 'Duration (e.g., "5 minutes", "30 seconds", "1 hour")', required: true },
        { name: 'label', type: 'string', description: 'What the timer is for', required: false, default: 'Timer' }
      ],
      execute: async (params) => {
        try {
          // Parse duration
          const durationMatch = params.duration.match(/(\d+)\s*(second|seconds|minute|minutes|hour|hours)/i);
          if (!durationMatch) {
            return { success: false, data: null, error: 'Could not parse duration' };
          }

          const amount = parseInt(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          let durationMs = amount * 1000;
          if (unit.includes('minute')) durationMs = amount * 60 * 1000;
          if (unit.includes('hour')) durationMs = amount * 60 * 60 * 1000;

          const task = taskAutomation.createTask({
            title: params.label,
            description: `Timer: ${params.duration}`,
            status: 'pending',
            priority: 'medium',
            dueDate: new Date(Date.now() + durationMs),
            tags: ['timer']
          });

          // Set actual timer and track it for cleanup
          const timerId = setTimeout(() => {
            taskAutomation.completeTask(task.id);
            const { voice } = require('./voice');
            voice.speak(`Timer complete: ${params.label}`).catch((err: any) => {
              logger.log('ERROR', `Timer TTS error: ${err}`, 'error');
            });
          }, durationMs);
          
          // Store timer ID for potential cleanup
          (task as any)._timerId = timerId;

          return {
            success: true,
            data: { taskId: task.id, durationMs },
            display: `Timer set for ${params.duration}: ${params.label}`
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    this.register({
      name: 'create_task',
      description: 'Create a task or to-do item',
      category: 'productivity',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: true },
        { name: 'description', type: 'string', description: 'Task details', required: false },
        { name: 'priority', type: 'string', description: 'Priority level', required: false, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }
      ],
      execute: async (params) => {
        try {
          const task = taskAutomation.createTask({
            title: params.title,
            description: params.description,
            status: 'pending',
            priority: params.priority,
            tags: ['user_created']
          });

          return {
            success: true,
            data: task,
            display: `Task created: ${params.title}`
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    // ==================== INFORMATION TOOLS ====================

    this.register({
      name: 'get_weather',
      description: 'Get current weather conditions and forecast',
      category: 'information',
      parameters: [
        { name: 'location', type: 'string', description: 'Location (optional, uses current if not specified)', required: false },
        { name: 'type', type: 'string', description: 'Type of weather info', required: false, enum: ['current', 'forecast', 'both'], default: 'current' }
      ],
      execute: async (params) => {
        try {
          const data = weatherService.getData();
          if (!data) {
            return {
              success: false,
              data: null,
              error: 'Weather data unavailable',
              display: 'Weather data is not available. Please set your location in settings.'
            };
          }

          const current = data.current;
          const location = data.location.name;

          let display = `Currently in ${location}: ${current.condition.description}, `;
          display += `${Math.round(current.temperature)}°F (feels like ${Math.round(current.feelsLike)}°F), `;
          display += `humidity ${current.humidity}%.`;

          if (params.type === 'forecast' || params.type === 'both') {
            const tomorrow = data.daily[1];
            display += ` Tomorrow: ${tomorrow.condition.description}, `;
            display += `high ${Math.round(tomorrow.tempMax)}°F, low ${Math.round(tomorrow.tempMin)}°F.`;
          }

          return {
            success: true,
            data: { current, forecast: data.daily },
            display
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    this.register({
      name: 'search_web',
      description: 'Search the web for current information',
      category: 'information',
      parameters: [
        { name: 'query', type: 'string', description: 'Search query', required: true },
        { name: 'num_results', type: 'number', description: 'Number of results', required: false, default: 3 }
      ],
      execute: async (params) => {
        try {
          const searchResults = await searchService.search(params.query);
          // searchService returns SearchResults object with results array
          const results = searchResults.results || [];
          const limited = results.slice(0, params.num_results || 3);
          
          if (limited.length === 0) {
            return {
              success: true,
              data: [],
              display: 'No search results found.'
            };
          }

          const display = limited.map((r: any, i: number) => 
            `${i + 1}. ${r.title}\n${r.snippet}`
          ).join('\n\n');

          return {
            success: true,
            data: limited,
            display: `Search results for "${params.query}":\n\n${display}`
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    this.register({
      name: 'analyze_image',
      description: 'Capture and analyze an image from the camera',
      category: 'information',
      parameters: [
        { name: 'query', type: 'string', description: 'What to look for in the image', required: false, default: 'Describe what you see' }
      ],
      execute: async (params) => {
        try {
          if (vision.getState() !== 'ACTIVE') {
            await vision.startCamera();
            await new Promise(r => setTimeout(r, 500));
          }

          const imageBase64 = vision.captureFrame();
          if (!imageBase64) {
            return { success: false, data: null, error: 'Failed to capture image' };
          }

          // The actual analysis is done by the AI provider with the image
          return {
            success: true,
            data: { imageBase64 },
            display: 'Image captured. Analyzing...',
            // Special marker for AI to know it needs to process the image
            _internal: { requiresVision: true, query: params.query, image: imageBase64 }
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    // ==================== CREATIVE TOOLS ====================

    this.register({
      name: 'generate_file',
      description: 'Generate a file (image, PDF, text, diagram)',
      category: 'creative',
      parameters: [
        { name: 'description', type: 'string', description: 'Description of what to generate', required: true },
        { name: 'format', type: 'string', description: 'File format', required: true, enum: ['png', 'jpeg', 'svg', 'pdf', 'txt', 'md'] },
        { name: 'style', type: 'string', description: 'Style for images', required: false, enum: ['realistic', 'artistic', 'diagram', 'schematic'], default: 'realistic' }
      ],
      execute: async (params) => {
        try {
          const generated = await fileGeneratorService.generateFile(
            params.description,
            params.format as any,
            { style: params.style, width: 800, height: 600 }
          );

          return {
            success: true,
            data: generated,
            display: `I've generated a ${params.format.toUpperCase()} file: ${generated.filename}`
          };
        } catch (error) {
          return { success: false, data: null, error: String(error) };
        }
      }
    });

    logger.log('KERNEL', `Registered ${this.tools.size} default tools`, 'success');
  }
}

// Export singleton
export const toolRegistry = new ToolRegistry();
