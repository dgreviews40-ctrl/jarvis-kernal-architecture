/**
 * Piper Launcher Service
 * Handles auto-detection and startup of the Piper TTS server
 */

import { piperTTS } from './piperTTS';
import { logger } from './logger';

export type PiperLauncherState = 
  | 'CHECKING'
  | 'NOT_INSTALLED'
  | 'NOT_RUNNING'
  | 'STARTING'
  | 'RUNNING'
  | 'ERROR';

interface PiperLauncherStatus {
  state: PiperLauncherState;
  message: string;
  error?: string;
}

class PiperLauncherService {
  private status: PiperLauncherStatus = { state: 'CHECKING', message: '' };
  private observers: ((status: PiperLauncherStatus) => void)[] = [];
  private checkInterval: number | null = null;
  private readonly PIPER_DIR = 'C:\\Users\\dman\\Desktop\\jarvis-kernel-architect\\Piper';
  private readonly PIPER_SERVER_URL = 'http://localhost:5000'; // Default Piper server URL
  private readonly START_SCRIPT = 'start-jarvis-server.bat';
  private hasCheckedInstall = false;
  private isActuallyInstalled: boolean | null = null;

  constructor() {
    // Don't auto-check on construct - wait for explicit check
  }

  public subscribe(callback: (status: PiperLauncherStatus) => void): () => void {
    this.observers.push(callback);
    callback(this.status); // Initial state
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  private notify() {
    this.observers.forEach(cb => cb(this.status));
  }

  private setStatus(state: PiperLauncherState, message: string, error?: string) {
    this.status = { state, message, error };
    logger.info('PIPER', message, { state, error });
    this.notify();
  }

  /**
   * Check if Piper is installed (exists in the Piper folder)
   * In browser environment, we can't check filesystem, so we rely on HTTP check
   */
  public isInstalled(): boolean {
    // If we've already checked, return cached result
    if (this.hasCheckedInstall && this.isActuallyInstalled !== null) {
      return this.isActuallyInstalled;
    }

    // Browser environment - we can't check filesystem directly
    // Assume installed and verify via HTTP instead when checkStatus is called
    this.isActuallyInstalled = true;
    this.hasCheckedInstall = true;
    return true;
  }

  /**
   * Check current Piper status
   */
  public async checkStatus(): Promise<PiperLauncherStatus> {
    this.setStatus('CHECKING', 'Checking Piper status...');

    // Check if server is running first (works in both Node and browser)
    const isRunning = await piperTTS.isAvailable();
    
    if (isRunning) {
      this.setStatus('RUNNING', 'Piper server is running');
      this.startHealthCheck();
      return this.status;
    }

    // Server not running - check if installed
    if (!this.isInstalled()) {
      this.setStatus('NOT_INSTALLED', 'Piper not found. Run Install-JARVIS-Voice.bat');
      return this.status;
    }

    this.setStatus('NOT_RUNNING', 'Piper is installed but not running');
    return this.status;
  }

  /**
   * Start the Piper server
   */
  public async startServer(): Promise<boolean> {
    if (this.status.state === 'RUNNING') {
      return true;
    }

    // First check if it's already running
    const isRunning = await piperTTS.isAvailable();
    if (isRunning) {
      this.setStatus('RUNNING', 'Piper server is already running');
      this.startHealthCheck();
      return true;
    }

    this.setStatus('STARTING', 'Attempting to start Piper server...');

    try {
      // Try to start via available methods
      const started = await this.launchPiperProcess();
      
      if (started) {
        // Wait for server to be ready
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const nowRunning = await piperTTS.isAvailable();
          
          if (nowRunning) {
            this.setStatus('RUNNING', 'Piper server started successfully');
            this.startHealthCheck();
            return true;
          }
          
          attempts++;
          this.setStatus('STARTING', `Waiting for Piper server... (${attempts}s)`);
        }
        
        throw new Error('Server did not start within 30 seconds');
      } else {
        throw new Error('Failed to launch Piper process - manual start required');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus('ERROR', 'Failed to auto-start Piper server', errorMsg);
      return false;
    }
  }

  /**
   * Launch the Piper process
   * In a browser environment, we cannot directly spawn processes
   * We try multiple fallback methods
   */
  private async launchPiperProcess(): Promise<boolean> {
    // Method 1: Try the proxy spawn endpoint (if available)
    try {
      const response = await fetch('http://localhost:3101/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'python',
          args: ['piper_server.py'],
          cwd: this.PIPER_DIR,
          detached: true
        })
      });

      if (response.ok) {
        logger.success('PIPER', 'Spawned via proxy endpoint');
        return true;
      }
    } catch (err) {
      logger.info('PIPER', 'Proxy spawn endpoint not available (expected in browser)', { error: (err as Error).message });
      // Fall through to next method
    }

    // Method 2: Try to use a custom protocol handler (if registered)
    // This would require the user to have registered a protocol handler
    try {
      // Attempt to open via a custom protocol that might be registered
      const protocolUrl = `jarvis://piper/start?path=${encodeURIComponent(this.PIPER_DIR)}`;
      const link = document.createElement('a');
      link.href = protocolUrl;
      link.click();
      
      // We can't know if this worked, so return true and let the polling check
      logger.info('PIPER', 'Attempted to launch via custom protocol');
      return true;
    } catch (err) {
      logger.info('PIPER', 'Custom protocol not available', { error: (err as Error).message });
      // Fall through
    }

    // Method 3: Provide instructions for manual launch
    // Browsers cannot directly execute local batch files for security reasons
    logger.warning('PIPER', 'Auto-launch not available in browser environment');
    
    // Return true to allow polling to check if user starts it manually
    // or if it was already started by another means
    return true;
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = window.setInterval(async () => {
      const isRunning = await piperTTS.isAvailable();
      
      if (!isRunning && this.status.state === 'RUNNING') {
        this.setStatus('NOT_RUNNING', 'Piper server stopped unexpectedly');
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop health checks
   */
  public stopHealthCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current status
   */
  public getStatus(): PiperLauncherStatus {
    return this.status;
  }

  /**
   * Get the Piper directory path
   */
  public getPiperDirectory(): string {
    return this.PIPER_DIR;
  }

  /**
   * Get the start script name
   */
  public getStartScript(): string {
    return this.START_SCRIPT;
  }

  /**
   * Generate manual start instructions
   */
  public getManualInstructions(): string {
    return `Piper server is not running. To start it manually:

1. Open Command Prompt
2. Run: cd "${this.PIPER_DIR}"
3. Run: python piper_server.py

Or double-click: ${this.PIPER_DIR}\\${this.START_SCRIPT}`;
  }

  /**
   * Check if auto-launch is available
   * In browser environment, this will always be false
   */
  public isAutoLaunchAvailable(): boolean {
    // Auto-launch requires Node.js environment or native integration
    // Browser security prevents spawning local processes
    return false;
  }
}

export const piperLauncher = new PiperLauncherService();
