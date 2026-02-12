/**
 * Home Assistant Shopping List & Todo Integration
 * 
 * Integrates with Home Assistant's native shopping list and todo entities.
 * Allows JARVIS to manage shopping lists and todos via voice commands.
 * 
 * Features:
 * - Add items to shopping list
 * - Mark items as complete/incomplete
 * - Get current shopping list items
 * - Clear completed items
 * - Support for multiple todo lists
 * 
 * Home Assistant Services Used:
 * - shopping_list.add_item
 * - shopping_list.complete_item
 * - shopping_list.incomplete_item
 * - shopping_list.clear_completed
 * - todo.add_item
 * - todo.update_item
 * - todo.remove_item
 */

import { haService, HAEntity } from './home_assistant';
import { logger } from './logger';

export interface ShoppingListItem {
  name: string;
  id?: string;
  complete: boolean;
}

export interface TodoList {
  entity_id: string;
  name: string;
  items: TodoItem[];
}

export interface TodoItem {
  uid: string;
  summary: string;
  description?: string;
  due?: string;
  status: 'needs_action' | 'completed';
}

export interface ShoppingListSummary {
  total: number;
  completed: number;
  pending: number;
  items: ShoppingListItem[];
}

/**
 * Home Assistant Shopping List Service
 * Manages shopping lists and todo entities through Home Assistant
 */
class HAShoppingListService {
  /**
   * Get all shopping list items from Home Assistant
   */
  public async getShoppingList(): Promise<ShoppingListSummary> {
    if (!haService.initialized) {
      throw new Error('Home Assistant service not initialized');
    }

    try {
      // Find shopping list entity
      const shoppingListEntity = this.findShoppingListEntity();
      
      if (!shoppingListEntity) {
        logger.log('HOME_ASSISTANT', 'No shopping list entity found', 'warning');
        return { total: 0, completed: 0, pending: 0, items: [] };
      }

      const response = await this.callHAService('shopping_list', 'items');
      
      if (!response) {
        return { total: 0, completed: 0, pending: 0, items: [] };
      }

      const items: ShoppingListItem[] = Array.isArray(response) 
        ? response.map(item => ({
            name: item.name,
            id: item.id,
            complete: item.complete || false
          }))
        : [];

      const completed = items.filter(i => i.complete).length;
      const pending = items.filter(i => !i.complete).length;

      logger.log('HOME_ASSISTANT', `Retrieved ${items.length} shopping list items`, 'info');

      return {
        total: items.length,
        completed,
        pending,
        items
      };
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to get shopping list: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Add an item to the shopping list
   */
  public async addItem(itemName: string): Promise<string> {
    if (!haService.initialized) {
      throw new Error('Home Assistant service not initialized');
    }

    if (!itemName || itemName.trim() === '') {
      throw new Error('Item name cannot be empty');
    }

    try {
      await this.callHAService('shopping_list', 'add_item', { name: itemName.trim() });
      
      logger.log('HOME_ASSISTANT', `Added "${itemName}" to shopping list`, 'success');
      return `Added "${itemName}" to your shopping list.`;
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to add item: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Mark a shopping list item as complete
   */
  public async completeItem(itemName: string): Promise<string> {
    if (!haService.initialized) {
      throw new Error('Home Assistant service not initialized');
    }

    try {
      // First try to find the item
      const list = await this.getShoppingList();
      const item = list.items.find(i => 
        i.name.toLowerCase() === itemName.toLowerCase() ||
        i.name.toLowerCase().includes(itemName.toLowerCase())
      );

      if (!item) {
        return `I couldn't find "${itemName}" in your shopping list.`;
      }

      await this.callHAService('shopping_list', 'complete_item', { name: item.name });
      
      logger.log('HOME_ASSISTANT', `Marked "${item.name}" as complete`, 'success');
      return `Marked "${item.name}" as complete.`;
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to complete item: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Mark a shopping list item as incomplete
   */
  public async incompleteItem(itemName: string): Promise<string> {
    if (!haService.initialized) {
      throw new Error('Home Assistant service not initialized');
    }

    try {
      const list = await this.getShoppingList();
      const item = list.items.find(i => 
        i.name.toLowerCase() === itemName.toLowerCase() ||
        i.name.toLowerCase().includes(itemName.toLowerCase())
      );

      if (!item) {
        return `I couldn't find "${itemName}" in your shopping list.`;
      }

      await this.callHAService('shopping_list', 'incomplete_item', { name: item.name });
      
      logger.log('HOME_ASSISTANT', `Marked "${item.name}" as incomplete`, 'success');
      return `Marked "${item.name}" as incomplete.`;
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to incomplete item: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Clear all completed items from the shopping list
   */
  public async clearCompleted(): Promise<string> {
    if (!haService.initialized) {
      throw new Error('Home Assistant service not initialized');
    }

    try {
      const list = await this.getShoppingList();
      const completedCount = list.completed;

      if (completedCount === 0) {
        return 'There are no completed items to clear.';
      }

      await this.callHAService('shopping_list', 'clear_completed_items');
      
      logger.log('HOME_ASSISTANT', `Cleared ${completedCount} completed items`, 'success');
      return `Cleared ${completedCount} completed item${completedCount === 1 ? '' : 's'} from your shopping list.`;
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to clear completed items: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Get a summary of the shopping list for voice response
   */
  public async getShoppingListSummary(): Promise<string> {
    try {
      const list = await this.getShoppingList();

      if (list.total === 0) {
        return 'Your shopping list is empty.';
      }

      const pendingItems = list.items.filter(i => !i.complete);
      
      if (pendingItems.length === 0) {
        return `You have ${list.total} item${list.total === 1 ? '' : 's'} on your shopping list, but they're all completed.`;
      }

      const itemNames = pendingItems.map(i => i.name).join(', ');
      return `You have ${pendingItems.length} pending item${pendingItems.length === 1 ? '' : 's'} on your shopping list: ${itemNames}.`;
    } catch (error) {
      return 'I couldn\'t access your shopping list right now.';
    }
  }

  /**
   * Get all todo lists from Home Assistant
   */
  public async getTodoLists(): Promise<TodoList[]> {
    if (!haService.initialized) {
      throw new Error('Home Assistant service not initialized');
    }

    try {
      // Find all todo entities
      const todoEntities = this.findTodoEntities();
      
      const lists: TodoList[] = todoEntities.map(entity => ({
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        items: entity.attributes.items || []
      }));

      logger.log('HOME_ASSISTANT', `Found ${lists.length} todo lists`, 'info');
      return lists;
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to get todo lists: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Add an item to a specific todo list
   */
  public async addTodoItem(listName: string, itemName: string, dueDate?: string): Promise<string> {
    if (!haService.initialized) {
      throw new Error('Home Assistant service not initialized');
    }

    try {
      const lists = await this.getTodoLists();
      const list = lists.find(l => 
        l.name.toLowerCase() === listName.toLowerCase() ||
        l.name.toLowerCase().includes(listName.toLowerCase())
      );

      if (!list) {
        // Try to find shopping list as fallback
        if (listName.toLowerCase().includes('shopping')) {
          return await this.addItem(itemName);
        }
        return `I couldn't find a todo list named "${listName}".`;
      }

      const serviceData: any = { item: itemName };
      if (dueDate) {
        serviceData.due_datetime = dueDate;
      }

      await this.callHAService('todo', 'add_item', serviceData, list.entity_id);
      
      logger.log('HOME_ASSISTANT', `Added "${itemName}" to ${list.name}`, 'success');
      return `Added "${itemName}" to ${list.name}.`;
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to add todo item: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Get status of the shopping list integration
   */
  public getStatus(): {
    initialized: boolean;
    hasShoppingList: boolean;
    todoListCount: number;
  } {
    const shoppingListEntity = this.findShoppingListEntity();
    const todoEntities = this.findTodoEntities();

    return {
      initialized: haService.initialized,
      hasShoppingList: !!shoppingListEntity,
      todoListCount: todoEntities.length
    };
  }

  // ============ Private Methods ============

  private findShoppingListEntity(): HAEntity | null {
    // Get entities from the service
    const entities = (haService as any).entities as Map<string, HAEntity>;
    if (!entities) return null;

    for (const entity of entities.values()) {
      if (entity.entity_id.startsWith('shopping_list.')) {
        return entity;
      }
    }
    return null;
  }

  private findTodoEntities(): HAEntity[] {
    const entities = (haService as any).entities as Map<string, HAEntity>;
    if (!entities) return [];

    const todoEntities: HAEntity[] = [];
    for (const entity of entities.values()) {
      if (entity.entity_id.startsWith('todo.')) {
        todoEntities.push(entity);
      }
    }
    return todoEntities;
  }

  private async callHAService(
    domain: string, 
    service: string, 
    serviceData?: Record<string, any>,
    entityId?: string
  ): Promise<any> {
    const proxyUrl = 'http://localhost:3101';
    const token = (haService as any).token;

    const body: any = { ...serviceData };
    if (entityId) {
      body.entity_id = entityId;
    }

    const response = await fetch(`${proxyUrl}/ha-api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service call failed: ${response.status} - ${errorText}`);
    }

    // Try to parse JSON response, but some calls return empty body
    const text = await response.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return null;
  }

  /**
   * Smart item parsing - handles variations like:
   * - "Add milk to my shopping list"
   * - "Put eggs on the shopping list"
   * - "I need to buy bread"
   * - "Add apples and oranges to shopping"
   */
  public parseItemFromText(text: string): { item: string; listType: 'shopping' | 'todo' | null } | null {
    const lowerText = text.toLowerCase();

    // Check if it's a shopping list request
    const shoppingPatterns = [
      /add\s+(.+?)\s+to\s+(?:my\s+)?shopping/i,
      /put\s+(.+?)\s+(?:on|in)\s+(?:the\s+)?shopping/i,
      /add\s+(.+?)\s+to\s+(?:the\s+)?list/i,
      /i\s+need\s+(?:to\s+buy\s+)?(.+)/i,
    ];

    for (const pattern of shoppingPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        return { item: match[1].trim(), listType: 'shopping' };
      }
    }

    // Check for todo list patterns
    const todoPatterns = [
      /add\s+(.+?)\s+to\s+(?:my\s+)?todo/i,
      /remind\s+me\s+to\s+(.+)/i,
      /i\s+need\s+to\s+(.+)/i,
    ];

    for (const pattern of todoPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        return { item: match[1].trim(), listType: 'todo' };
      }
    }

    return null;
  }
}

// Export singleton
export const haShoppingList = new HAShoppingListService();
export default haShoppingList;
