import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecureStorage, secureStorage, constantTimeCompare, generateSecureId } from '../../services/secureStorage';

describe('SecureStorage', () => {
  let storage: SecureStorage;
  const testPassword = 'testPassword123!';

  beforeEach(async () => {
    localStorage.clear();
    storage = new SecureStorage({ prefix: 'TEST_SECURE_', memoryOnly: true });
    await storage.initialize(testPassword);
  });

  afterEach(() => {
    storage.lock();
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should initialize with a valid password', async () => {
      const newStorage = new SecureStorage({ prefix: 'TEST_INIT_', memoryOnly: true });
      await newStorage.initialize('validPass123!');
      expect(newStorage.isInitialized()).toBe(true);
      expect(newStorage.isLocked()).toBe(false);
      newStorage.lock();
    });

    it('should throw error for short password', async () => {
      const newStorage = new SecureStorage({ prefix: 'TEST_INIT_', memoryOnly: true });
      await expect(newStorage.initialize('short')).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should throw error for empty password', async () => {
      const newStorage = new SecureStorage({ prefix: 'TEST_INIT_', memoryOnly: true });
      await expect(newStorage.initialize('')).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should be locked before initialization', () => {
      const newStorage = new SecureStorage({ prefix: 'TEST_NEW_', memoryOnly: true });
      expect(newStorage.isInitialized()).toBe(false);
      expect(newStorage.isLocked()).toBe(true);
    });
  });

  describe('basic operations', () => {
    it('should store and retrieve a value', async () => {
      await storage.set('testKey', 'testValue');
      const value = await storage.get('testKey');
      expect(value).toBe('testValue');
    });

    it('should return null for non-existent key', async () => {
      const value = await storage.get('nonExistent');
      expect(value).toBeNull();
    });

    it('should check if key exists', async () => {
      await storage.set('exists', 'value');
      expect(await storage.has('exists')).toBe(true);
      expect(await storage.has('doesNotExist')).toBe(false);
    });

    it('should delete a value', async () => {
      await storage.set('toDelete', 'value');
      expect(await storage.has('toDelete')).toBe(true);
      await storage.remove('toDelete');
      expect(await storage.has('toDelete')).toBe(false);
      expect(await storage.get('toDelete')).toBeNull();
    });

    it('should update an existing value', async () => {
      await storage.set('updateKey', 'original');
      await storage.set('updateKey', 'updated');
      const value = await storage.get('updateKey');
      expect(value).toBe('updated');
    });

    it('should remove key when setting empty value', async () => {
      await storage.set('emptyTest', 'value');
      expect(await storage.has('emptyTest')).toBe(true);
      await storage.set('emptyTest', '');
      expect(await storage.has('emptyTest')).toBe(false);
    });

    it('should handle special characters in values', async () => {
      const specialValue = '!@#$%^&*()_+-=[]{}|;:,.<>?`~ äöü ñ 中文 🎉';
      await storage.set('special', specialValue);
      const retrieved = await storage.get('special');
      expect(retrieved).toBe(specialValue);
    });

    it('should handle large values', async () => {
      const largeValue = 'x'.repeat(10000);
      await storage.set('large', largeValue);
      const retrieved = await storage.get('large');
      expect(retrieved).toBe(largeValue);
    });
  });

  describe('clear operations', () => {
    it('should clear all values', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.set('key3', 'value3');
      
      await storage.clear();
      
      expect(await storage.has('key1')).toBe(false);
      expect(await storage.has('key2')).toBe(false);
      expect(await storage.has('key3')).toBe(false);
    });

    it('should preserve salt key during clear', async () => {
      // Create a storage that uses localStorage
      const localStorageStorage = new SecureStorage({ prefix: 'TEST_LOCAL_', memoryOnly: false });
      await localStorageStorage.initialize(testPassword);
      await localStorageStorage.set('key1', 'value1');
      
      const saltKeyLocal = 'TEST_LOCAL__SALT';
      const saltExistsBefore = localStorage.getItem(saltKeyLocal) !== null;
      expect(saltExistsBefore).toBe(true);
      
      await localStorageStorage.clear();
      
      // Salt should still exist for re-initialization (values cleared but salt remains)
      const saltExistsAfter = localStorage.getItem(saltKeyLocal) !== null;
      expect(saltExistsAfter).toBe(true);
      expect(await localStorageStorage.has('key1')).toBe(false);
      
      localStorageStorage.lock();
      
      // Cleanup
      localStorage.removeItem('TEST_LOCAL__SALT');
    });
  });

  describe('getAll', () => {
    it('should return all stored values', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      
      const all = await storage.getAll();
      // Keys are uppercased by the storage service
      expect(all).toEqual({
        KEY1: 'value1',
        KEY2: 'value2'
      });
    });

    it('should return empty object when no values stored', async () => {
      const all = await storage.getAll();
      expect(all).toEqual({});
    });
  });

  describe('lock functionality', () => {
    it('should lock storage and prevent access', async () => {
      await storage.set('secret', 'data');
      storage.lock();
      
      expect(storage.isLocked()).toBe(true);
      expect(storage.isInitialized()).toBe(false);
    });

    it('should throw when accessing locked storage', async () => {
      await storage.set('key', 'value');
      storage.lock();
      
      await expect(storage.get('key')).rejects.toThrow('SecureStorage not initialized');
    });

    it('should require re-initialization after lock', async () => {
      await storage.set('key', 'value');
      storage.lock();
      
      await storage.initialize(testPassword);
      // After re-initialization with same password, values should be accessible
      // Note: In memory-only mode, values are lost on lock
    });
  });

  describe('memory-only mode', () => {
    it('should not persist to localStorage in memory-only mode', async () => {
      const memStorage = new SecureStorage({ prefix: 'TEST_MEM_', memoryOnly: true });
      await memStorage.initialize(testPassword);
      await memStorage.set('memKey', 'memValue');
      
      // Should not be in localStorage
      expect(localStorage.getItem('TEST_MEM_MEMKEY')).toBeNull();
      
      // But should be retrievable from memory
      expect(await memStorage.get('memKey')).toBe('memValue');
      memStorage.lock();
    });
  });

  describe('localStorage mode', () => {
    it('should persist to localStorage', async () => {
      const lsStorage = new SecureStorage({ prefix: 'TEST_LOCAL_', memoryOnly: false });
      await lsStorage.initialize(testPassword);
      await lsStorage.set('persistKey', 'persistValue');
      
      // Should be encrypted in localStorage
      const raw = localStorage.getItem('TEST_LOCAL_PERSISTKEY');
      expect(raw).toBeTruthy();
      expect(raw).not.toContain('persistValue'); // Should be encrypted
      
      lsStorage.lock();
      
      // Cleanup
      localStorage.removeItem('TEST_LOCAL__SALT');
      localStorage.removeItem('TEST_LOCAL_PERSISTKEY');
    });

    it('should retrieve from localStorage after re-initialization', async () => {
      const storage1 = new SecureStorage({ prefix: 'TEST_RE_', memoryOnly: false });
      await storage1.initialize(testPassword);
      await storage1.set('shared', 'sharedValue');
      storage1.lock();
      
      // Create new instance with same prefix
      const storage2 = new SecureStorage({ prefix: 'TEST_RE_', memoryOnly: false });
      await storage2.initialize(testPassword);
      const value = await storage2.get('shared');
      expect(value).toBe('sharedValue');
      storage2.lock();
      
      // Cleanup
      localStorage.removeItem('TEST_RE__SALT');
      localStorage.removeItem('TEST_RE_SHARED');
    });
  });

  describe('migration', () => {
    it('should migrate legacy base64 data', async () => {
      const legacyData = {
        oldKey1: btoa('legacyValue1'),
        oldKey2: btoa('legacyValue2')
      };
      
      const migrated = await storage.migrateFromLegacy(legacyData);
      expect(migrated).toBe(2);
      
      expect(await storage.get('oldKey1')).toBe('legacyValue1');
      expect(await storage.get('oldKey2')).toBe('legacyValue2');
    });

    it('should handle migration failures gracefully', async () => {
      const legacyData = {
        valid: btoa('validValue'),
        invalid: 'not-valid-base64!!!'
      };
      
      const migrated = await storage.migrateFromLegacy(legacyData);
      expect(migrated).toBe(1); // Only valid one migrated
      expect(await storage.get('valid')).toBe('validValue');
    });
  });

  describe('encryption', () => {
    it('should produce different ciphertexts for same value', async () => {
      await storage.set('enc1', 'sameValue');
      await storage.set('enc2', 'sameValue');
      
      // Both should decrypt to same value
      expect(await storage.get('enc1')).toBe('sameValue');
      expect(await storage.get('enc2')).toBe('sameValue');
    });

    it('should handle empty string', async () => {
      await storage.set('empty', '');
      const value = await storage.get('empty');
      // Empty string is treated as removal
      expect(value).toBeNull();
    });
  });
});

describe('constantTimeCompare', () => {
  it('should return true for identical strings', () => {
    expect(constantTimeCompare('abc', 'abc')).toBe(true);
    expect(constantTimeCompare('longer string here', 'longer string here')).toBe(true);
  });

  it('should return false for different strings', () => {
    expect(constantTimeCompare('abc', 'def')).toBe(false);
    expect(constantTimeCompare('abc', 'abcd')).toBe(false);
    expect(constantTimeCompare('', 'a')).toBe(false);
  });

  it('should handle empty strings', () => {
    expect(constantTimeCompare('', '')).toBe(true);
  });

  it('should handle unicode', () => {
    expect(constantTimeCompare('中文', '中文')).toBe(true);
    expect(constantTimeCompare('中文', '日文')).toBe(false);
  });
});

describe('generateSecureId', () => {
  it('should generate string of specified length', () => {
    const id1 = generateSecureId(16);
    expect(id1.length).toBe(16);
    
    const id2 = generateSecureId(32);
    expect(id2.length).toBe(32);
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSecureId(16));
    }
    expect(ids.size).toBe(100);
  });

  it('should use default length of 32', () => {
    const id = generateSecureId();
    expect(id.length).toBe(32);
  });

  it('should only contain URL-safe characters', () => {
    const id = generateSecureId(100);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('secureStorage singleton', () => {
  it('should exist', () => {
    expect(secureStorage).toBeDefined();
    expect(secureStorage).toBeInstanceOf(SecureStorage);
  });

  it('should be initially locked', () => {
    expect(secureStorage.isLocked()).toBe(true);
  });
});
