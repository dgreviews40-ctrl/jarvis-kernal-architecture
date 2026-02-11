/**
 * Command Plugin Template
 * 
 * A voice command handler plugin that responds to natural language commands.
 * Use this template for plugins that process voice input and take actions.
 */

import { definePlugin, useLogger, useCommands, useConfig } from '@jarvis/sdk';

export default definePlugin(
  {
    id: '__PLUGIN_ID__',
    name: '__PLUGIN_NAME__',
    version: '1.0.0',
    description: '__PLUGIN_DESCRIPTION__',
    author: 'Anonymous',
    permissions: ['system:notification', 'audio:output'],
  },
  async (context) => {
    const log = useLogger(context);
    const config = useConfig(context);
    const commands = useCommands(context);
    
    // Get plugin configuration
    const greeting = config.get('greeting', 'Command plugin ready!');
    
    // Register voice commands
    commands.register('hello', () => {
      context.voice.speak('Hello! How can I help you today?');
      log.info('Responded to hello command');
    });
    
    commands.register('what time is it', () => {
      const now = new Date();
      const time = now.toLocaleTimeString();
      context.voice.speak(`The current time is ${time}`);
      log.info(`Told user the time: ${time}`);
    });
    
    commands.register('remember', (params) => {
      const text = params.join(' ');
      if (!text) {
        context.voice.speak('What would you like me to remember?');
        return;
      }
      
      context.memory.store(text, ['note', 'user'])
        .then(() => {
          context.voice.speak('I will remember that.');
          log.info(`Stored memory: ${text}`);
        })
        .catch((err) => {
          context.voice.speak('Sorry, I could not save that.');
          log.error('Failed to store memory', { error: err });
        });
    });
    
    commands.register('recall', async (params) => {
      const query = params.join(' ') || 'recent notes';
      
      try {
        const results = await context.memory.recall(query, 3);
        if (results.length === 0) {
          context.voice.speak('I could not find anything matching that.');
          return;
        }
        
        const topResult = results[0];
        context.voice.speak(`I found: ${topResult.content}`);
        log.info('Recalled memory', { query, results: results.length });
      } catch (err) {
        context.voice.speak('Sorry, I had trouble searching my memory.');
        log.error('Failed to recall memory', { error: err });
      }
    });
    
    // Plugin lifecycle
    return {
      onStart: () => {
        log.info('Command plugin started');
        context.system.notify('Command Plugin', greeting);
      },
      
      onStop: () => {
        log.info('Command plugin stopped');
      },
    };
  }
);
