import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { App } from '../src/App';

describe('App Integration Tests', () => {
  let app: App;
  
  beforeAll(() => {
    // Initialize test environment
    app = new App();
  });
  
  afterAll(() => {
    // Cleanup
    app.cleanup();
  });
  
  it('should initialize without errors', () => {
    expect(app).toBeDefined();
    expect(app.state).toBeDefined();
  });
  
  it('should handle basic intent analysis', async () => {
    const result = await app.processKernelRequest('Hello');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
  
  it('should handle memory operations', async () => {
    // Store something in memory
    await app.processKernelRequest('Remember that my favorite color is blue');
    
    // Retrieve it
    const result = await app.processKernelRequest('What is my favorite color?');
    
    expect(result).toContain('blue');
  });
  
  it('should handle voice commands correctly', async () => {
    // Test voice command processing
    const result1 = await app.processKernelRequest('Turn on the lights');
    expect(result1).toBeDefined();
    
    const result2 = await app.processKernelRequest('What time is it?');
    expect(result2).toBeDefined();
  });
  
  it('should handle Ollama fallback correctly', async () => {
    // Test when Gemini is unavailable
    const originalHasApiKey = (app as any).hasApiKey;
    (app as any).hasApiKey = () => false;
    
    try {
      const result = await app.processKernelRequest('What is the weather today?');
      expect(result).toBeDefined();
    } finally {
      (app as any).hasApiKey = originalHasApiKey;
    }
  });
});