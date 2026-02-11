/**
 * SDK Timer Plugin Example
 * 
 * Demonstrates the SDK pattern for creating JARVIS plugins.
 * This is a complete, working timer plugin that can be installed in JARVIS.
 */

import { 
  definePlugin, 
  useLogger, 
  useConfig, 
  useScheduler,
  useCommands,
  useMemory
} from '../../sdk/packages/jarvis-sdk/src/index.js';

// Timer state
interface Timer {
  id: string;
  name: string;
  endTime: number;
  durationMinutes: number;
  cancel: () => void;
}

export default definePlugin(
  {
    id: 'timer.sdk',
    name: 'SDK Timer Example',
    version: '1.0.0',
    description: 'Example timer plugin using the JARVIS SDK',
    author: 'JARVIS',
    permissions: ['system:notification', 'audio:output', 'memory:write'],
  },
  async (context) => {
    const log = useLogger(context);
    const config = useConfig(context);
    const scheduler = useScheduler(context);
    const commands = useCommands(context);
    const memory = useMemory(context);
    
    // Active timers
    const timers = new Map<string, Timer>();
    let timerCounter = 0;
    
    // Get config values
    const defaultDuration = config.get('defaultDuration', 5);
    const soundEnabled = config.get('soundEnabled', true);
    
    // Helper: Format time remaining
    function formatTimeRemaining(endTime: number): string {
      const remaining = Math.max(0, endTime - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Helper: Create a timer
    function createTimer(name: string, minutes: number): string {
      timerCounter++;
      const id = `timer-${timerCounter}`;
      const endTime = Date.now() + (minutes * 60 * 1000);
      
      // Schedule the timer
      const cancel = scheduler.after(minutes * 60 * 1000, async () => {
        const timer = timers.get(id);
        if (!timer) return;
        
        // Notify user
        context.system.notify('Timer Complete', `${timer.name} is done!`);
        
        // Speak if enabled
        if (soundEnabled) {
          await context.voice.speak(`${timer.name} timer is complete!`);
        }
        
        // Log to memory
        await memory.store(
          `Timer completed: ${timer.name} (${timer.durationMinutes} minutes)`,
          ['timer', 'completed']
        );
        
        log.info(`Timer completed: ${id} - ${timer.name}`);
        timers.delete(id);
      });
      
      const timer: Timer = { id, name, endTime, durationMinutes: minutes, cancel };
      timers.set(id, timer);
      
      log.info(`Timer created: ${id} - ${name} (${minutes} min)`);
      return id;
    }
    
    // Register voice commands
    commands.register('set timer', (params) => {
      // Parse: "set timer 10 minutes pizza" or "set timer 5"
      const name = params.slice(2).join(' ') || 'Timer';
      const minutes = parseInt(params[0]) || defaultDuration;
      
      const id = createTimer(name, minutes);
      context.voice.speak(`Timer set for ${minutes} minutes`);
      
      log.info(`Voice command: set timer`, { name, minutes, id });
    });
    
    commands.register('timer status', () => {
      if (timers.size === 0) {
        context.voice.speak('You have no active timers');
        return;
      }
      
      const status = Array.from(timers.values())
        .map(t => `${t.name}: ${formatTimeRemaining(t.endTime)} remaining`)
        .join('. ');
      
      context.voice.speak(`You have ${timers.size} active timers. ${status}`);
    });
    
    commands.register('cancel timer', (params) => {
      const name = params.join(' ').toLowerCase();
      
      // Find timer by name
      for (const [id, timer] of timers) {
        if (timer.name.toLowerCase().includes(name) || id.includes(name)) {
          timer.cancel();
          timers.delete(id);
          context.voice.speak(`${timer.name} timer cancelled`);
          log.info(`Timer cancelled: ${id}`);
          return;
        }
      }
      
      context.voice.speak('I could not find that timer');
    });
    
    commands.register('cancel all timers', () => {
      const count = timers.size;
      scheduler.clearAll();
      timers.clear();
      context.voice.speak(`Cancelled ${count} timers`);
      log.info(`All timers cancelled (${count})`);
    });
    
    // Plugin lifecycle
    return {
      onStart: () => {
        log.info('Timer plugin started', { 
          defaultDuration, 
          soundEnabled,
          activeTimers: timers.size 
        });
        
        context.system.notify(
          'Timer Plugin',
          `SDK Timer ready (default: ${defaultDuration} min)`
        );
      },
      
      onPause: () => {
        log.info('Timer plugin paused');
        // Note: timers continue running while paused
      },
      
      onResume: () => {
        log.info('Timer plugin resumed');
      },
      
      onStop: () => {
        log.info('Timer plugin stopping');
        // Cancel all timers on stop
        scheduler.clearAll();
        timers.clear();
      },
      
      onConfigChange: (newConfig) => {
        log.info('Configuration updated', { config: newConfig });
        // Config changes take effect for new timers
      },
    };
  }
);
