import { MemoryService } from '../services/memory';
import { MemoryNode } from '../types';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  
  beforeEach(() => {
    memoryService = new MemoryService();
  });

  describe('store', () => {
    it('should store a memory node with correct properties', () => {
      const content = 'Test memory content';
      const tags = ['test', 'unit'];
      
      const result = memoryService.store(content, 'FACT', tags);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe(content);
      expect(result.type).toBe('FACT');
      expect(result.tags).toEqual(expect.arrayContaining(tags));
      expect(result.timestamp).toBeDefined();
    });

    it('should handle empty tags array', () => {
      const content = 'Test content';
      
      const result = memoryService.store(content, 'FACT', []);
      
      expect(result.tags).toEqual([]);
    });
  });

  describe('recall', () => {
    it('should return matching memories based on query', () => {
      // Store some test memories
      memoryService.store('This is about weather in Medford', 'FACT', ['weather', 'medford']);
      memoryService.store('My favorite color is blue', 'FACT', ['color', 'preference']);
      
      const results = memoryService.recall('weather');
      
      expect(results.length).toBe(1);
      expect(results[0].node.content).toContain('weather');
    });

    it('should return memories with high similarity score', () => {
      memoryService.store('The temperature in Medford is 72 degrees', 'FACT', ['weather', 'temperature']);
      
      const results = memoryService.recall('What is the temperature?');
      
      expect(results.length).toBe(1);
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it('should return empty array when no matches found', () => {
      const results = memoryService.recall('nonexistent query');
      
      expect(results.length).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a memory by ID', () => {
      const node = memoryService.store('Test content', 'FACT', []);
      
      expect(memoryService.nodes.size).toBe(1);
      
      memoryService.delete(node.id);
      
      expect(memoryService.nodes.size).toBe(0);
    });

    it('should return false when trying to delete non-existent memory', () => {
      const result = memoryService.delete('non-existent-id');
      
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all stored memories', () => {
      memoryService.store('First memory', 'FACT', []);
      memoryService.store('Second memory', 'FACT', []);
      
      const all = memoryService.getAll();
      
      expect(all.length).toBe(2);
    });
  });
});