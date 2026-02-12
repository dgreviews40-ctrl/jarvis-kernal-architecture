import { describe, it, expect, beforeEach, vi } from 'vitest';
import { haShoppingList } from '../../services/haShoppingList';

// Mock haService
vi.mock('../../services/home_assistant', () => ({
  haService: {
    initialized: true,
  },
  HAEntity: class HAEntity {},
}));

// Mock logger
vi.mock('../../services/logger', () => ({
  logger: {
    log: vi.fn(),
  },
}));

describe('HAShoppingListService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Item Parsing', () => {
    it('should parse "add milk to shopping list"', () => {
      const result = haShoppingList.parseItemFromText('add milk to shopping list');
      expect(result).not.toBeNull();
      expect(result?.item).toBe('milk');
      expect(result?.listType).toBe('shopping');
    });

    it('should parse "put eggs on the shopping list"', () => {
      const result = haShoppingList.parseItemFromText('put eggs on the shopping list');
      expect(result).not.toBeNull();
      expect(result?.item).toBe('eggs');
      expect(result?.listType).toBe('shopping');
    });

    it('should parse "I need to buy bread"', () => {
      const result = haShoppingList.parseItemFromText('I need to buy bread');
      expect(result).not.toBeNull();
      expect(result?.item).toBe('bread');
      expect(result?.listType).toBe('shopping');
    });

    it('should parse "add apples and oranges to shopping"', () => {
      const result = haShoppingList.parseItemFromText('add apples and oranges to shopping');
      expect(result).not.toBeNull();
      expect(result?.item).toBe('apples and oranges');
    });

    it('should parse todo items', () => {
      const result = haShoppingList.parseItemFromText('remind me to call mom');
      expect(result).not.toBeNull();
      expect(result?.item).toBe('call mom');
      expect(result?.listType).toBe('todo');
    });

    it('should return null for non-list text', () => {
      const result = haShoppingList.parseItemFromText('what is the weather today');
      expect(result).toBeNull();
    });

    it('should handle empty input', () => {
      const result = haShoppingList.parseItemFromText('');
      expect(result).toBeNull();
    });
  });

  describe('Status', () => {
    it('should return status object', () => {
      const status = haShoppingList.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('hasShoppingList');
      expect(status).toHaveProperty('todoListCount');
      
      expect(typeof status.initialized).toBe('boolean');
      expect(typeof status.hasShoppingList).toBe('boolean');
      expect(typeof status.todoListCount).toBe('number');
    });
  });

  describe('Shopping List Summary', () => {
    it('should generate summary for empty list', async () => {
      // Mock empty list response
      const result = await haShoppingList.getShoppingListSummary();
      
      // Should return a string response
      expect(typeof result).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when adding empty item', async () => {
      await expect(haShoppingList.addItem('')).rejects.toThrow('Item name cannot be empty');
    });

    it('should throw error when adding whitespace-only item', async () => {
      await expect(haShoppingList.addItem('   ')).rejects.toThrow('Item name cannot be empty');
    });
  });
});
