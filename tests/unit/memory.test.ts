import { MemoryService } from '../../services/memory';
import { MemoryNode } from '../../types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  
  beforeEach(() => {
    memoryService = new MemoryService();
  });

  describe('store', () => {
    it('should store a memory node with correct properties', async () => {
      const content = 'Test memory content';
      const tags = ['test', 'unit'];
      
      const result = await memoryService.store(content, 'FACT', tags);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe(content);
      expect(result.type).toBe('FACT');
      expect(result.tags).toEqual(expect.arrayContaining(tags));
      expect(result.created).toBeDefined();
    });

    it('should handle empty tags array', async () => {
      const content = 'Test content';
      
      const result = await memoryService.store(content, 'FACT', []);
      
      expect(result.tags).toEqual([]);
    });
  });

  describe('recall', () => {
    it('should return matching memories based on query', async () => {
      // Store some test memories
      await memoryService.store('This is about weather in Medford', 'FACT', ['weather', 'medford']);
      await memoryService.store('My favorite color is blue', 'FACT', ['color', 'preference']);
      
      const results = await memoryService.recall('weather');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].node.content.toLowerCase()).toContain('weather');
    });

    it('should return memories with similarity score', async () => {
      await memoryService.store('The temperature in Medford is 72 degrees', 'FACT', ['weather', 'temperature']);
      
      const results = await memoryService.recall('What is the temperature?');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should return empty array when no matches found', async () => {
      const results = await memoryService.recall('xyznonexistentquery123');
      
      // Results may include initial memories, but our query should not match anything closely
      const highConfidenceMatches = results.filter(r => r.score > 0.3);
      expect(highConfidenceMatches.length).toBe(0);
    });
  });

  describe('forget', () => {
    it('should delete a memory by ID', async () => {
      // Trigger lazy loading first
      await memoryService.getAll();
      const initialCount = memoryService.nodes.size;
      
      const node = await memoryService.store('Test content', 'FACT', []);
      
      expect(memoryService.nodes.size).toBe(initialCount + 1);
      
      const result = await memoryService.forget(node.id);
      
      expect(result).toBe(true);
      expect(memoryService.nodes.size).toBe(initialCount);
    });

    it('should return false when trying to delete non-existent memory', async () => {
      const result = await memoryService.forget('non-existent-id');
      
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all stored memories', async () => {
      const initialCount = (await memoryService.getAll()).length;
      
      await memoryService.store('First memory', 'FACT', []);
      await memoryService.store('Second memory', 'FACT', []);
      
      const all = await memoryService.getAll();
      
      expect(all.length).toBe(initialCount + 2);
    });
  });
});
