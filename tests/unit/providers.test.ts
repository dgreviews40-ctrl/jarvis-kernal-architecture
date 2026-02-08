import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaProvider } from '../../services/providers';
import { AIProvider } from '../../types';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  
  beforeEach(() => {
    provider = new OllamaProvider();
    // Mock fetch for testing
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be available when Ollama is running', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });
    
    const available = await provider.isAvailable();
    expect(available).toBe(true);
  });

  it('should not be available when Ollama is not running', async () => {
    (fetch as any).mockRejectedValue(new Error('Network error'));
    
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });

  it('should generate response with proper structure', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ response: 'Test response' })
    });
    
    const result = await provider.generate({
      prompt: 'Test prompt',
      systemInstruction: 'Test system instruction'
    });
    
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('provider', AIProvider.OLLAMA);
    expect(result).toHaveProperty('latencyMs');
    expect(typeof result.text).toBe('string');
  });

  it('should handle errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API error'));
    
    const result = await provider.generate({
      prompt: 'Test prompt',
      systemInstruction: 'Test system instruction'
    });
    
    expect(result.text).toContain('[SIMULATED]');
    expect(result.provider).toBe(AIProvider.OLLAMA);
  });
});