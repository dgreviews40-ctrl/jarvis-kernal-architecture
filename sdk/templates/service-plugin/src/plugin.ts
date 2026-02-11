/**
 * Service Plugin Template
 * 
 * A background service plugin that runs periodic tasks.
 * Use this template for plugins that monitor data, fetch updates, or perform
 * scheduled operations without user interaction.
 */

import { definePlugin, useLogger, useConfig, useScheduler } from '@jarvis/sdk';

export default definePlugin(
  {
    id: '__PLUGIN_ID__',
    name: '__PLUGIN_NAME__',
    version: '1.0.0',
    description: '__PLUGIN_DESCRIPTION__',
    author: 'Anonymous',
    permissions: ['memory:read', 'memory:write', 'system:notification', 'network:fetch'],
  },
  async (context) => {
    const log = useLogger(context);
    const config = useConfig(context);
    const scheduler = useScheduler(context);
    
    // Configuration
    const intervalMinutes = config.get('intervalMinutes', 5);
    const apiEndpoint = config.get('apiEndpoint', 'https://api.example.com/data');
    
    // Track service state
    let isRunning = false;
    let checkCount = 0;
    
    // The main service function
    async function performCheck() {
      if (isRunning) {
        log.warn('Previous check still running, skipping');
        return;
      }
      
      isRunning = true;
      checkCount++;
      
      try {
        log.info(`Performing service check #${checkCount}`);
        
        // Example: Fetch data from an API
        const response = await context.network.fetch(apiEndpoint);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Example: Process and store results
        const result = {
          timestamp: Date.now(),
          checkNumber: checkCount,
          data: data,
        };
        
        // Store in memory for later retrieval
        await context.memory.store(
          JSON.stringify(result),
          ['service', 'check', `check-${checkCount}`]
        );
        
        log.info('Service check completed', { checkNumber: checkCount });
        
        // Example: Alert on specific conditions
        if (data.alert) {
          context.system.notify(
            'Service Alert',
            data.alertMessage || 'Something requires your attention'
          );
        }
        
      } catch (error) {
        log.error('Service check failed', { 
          error: error instanceof Error ? error.message : String(error),
          checkNumber: checkCount 
        });
      } finally {
        isRunning = false;
      }
    }
    
    // Plugin lifecycle
    return {
      onStart: () => {
        log.info('Service plugin started', { 
          intervalMinutes, 
          apiEndpoint 
        });
        
        // Perform initial check
        performCheck();
        
        // Schedule periodic checks
        scheduler.every(intervalMinutes * 60 * 1000, performCheck);
        
        context.system.notify(
          'Service Plugin',
          `Service running (checking every ${intervalMinutes} min)`
        );
      },
      
      onStop: () => {
        log.info('Service plugin stopping, clearing scheduled tasks');
        scheduler.clearAll();
      },
      
      onConfigChange: (newConfig) => {
        log.info('Configuration changed', { config: newConfig });
        // Restart with new config
        scheduler.clearAll();
        const newInterval = (newConfig.intervalMinutes as number) || 5;
        scheduler.every(newInterval * 60 * 1000, performCheck);
      },
    };
  }
);
