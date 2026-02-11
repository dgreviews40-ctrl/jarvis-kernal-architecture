import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  safeJsonParse,
  safeJsonStringify,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  estimateLocalStorageUsage,
  isLocalStorageAvailable,
  safeGet,
  safeExecute,
  safeExecuteAsync,
  debounce,
  throttle,
  withRetry
} from '../../services/safeUtils';

describe('SafeUtils', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse<{ name: string }>('{"name": "test"}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test' });
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid JSON', () => {
      const result = safeJsonParse('invalid json');
      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
      expect(result.data).toBeUndefined();
    });

    it('should return default value on error', () => {
      const defaultValue = { fallback: true };
      const result = safeJsonParse('invalid', defaultValue);
      expect(result.success).toBe(false);
      expect(result.data).toEqual(defaultValue);
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify valid data', () => {
      const result = safeJsonStringify({ name: 'test' });
      expect(result).toBe('{"name":"test"}');
    });

    it('should return default value for circular references', () => {
      const obj: any = { a: 1 };
      obj.self = obj; // Circular reference
      const result = safeJsonStringify(obj, '{}');
      expect(result).toBe('{}');
    });
  });

  describe('safeLocalStorage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    describe('safeLocalStorageSet', () => {
      it('should set item successfully', () => {
        const result = safeLocalStorageSet('test', { value: 123 });
        expect(result.success).toBe(true);
        expect(localStorage.getItem('test')).toBe('{"value":123}');
      });

      it('should handle quota exceeded error', () => {
        // Mock localStorage to throw quota error
        const originalSetItem = localStorage.setItem.bind(localStorage);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          const error = new DOMException('Quota exceeded', 'QuotaExceededError');
          throw error;
        });

        const result = safeLocalStorageSet('test', { value: 123 });
        expect(result.success).toBe(false);
        expect(result.quotaExceeded).toBe(true);

        vi.restoreAllMocks();
      });
    });

    describe('safeLocalStorageGet', () => {
      it('should get item successfully', () => {
        localStorage.setItem('test', '{"value":123}');
        const result = safeLocalStorageGet<{ value: number }>('test');
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ value: 123 });
      });

      it('should return undefined for missing key', () => {
        const result = safeLocalStorageGet('nonexistent');
        expect(result.success).toBe(true);
        expect(result.data).toBeUndefined();
      });

      it('should return error for invalid JSON', () => {
        localStorage.setItem('test', 'invalid json');
        const result = safeLocalStorageGet('test');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('safeLocalStorageRemove', () => {
      it('should remove item successfully', () => {
        localStorage.setItem('test', 'value');
        const result = safeLocalStorageRemove('test');
        expect(result).toBe(true);
        expect(localStorage.getItem('test')).toBeNull();
      });
    });
  });

  describe('isLocalStorageAvailable', () => {
    it('should return true when localStorage is available', () => {
      expect(isLocalStorageAvailable()).toBe(true);
    });
  });

  describe('safeGet', () => {
    it('should get nested property', () => {
      const obj = { a: { b: { c: 'value' } } };
      expect(safeGet(obj, 'a.b.c')).toBe('value');
    });

    it('should return default for missing path', () => {
      const obj = { a: { b: {} } };
      expect(safeGet(obj, 'a.b.c', 'default')).toBe('default');
    });

    it('should handle null/undefined', () => {
      expect(safeGet(null, 'a.b', 'default')).toBe('default');
      expect(safeGet(undefined, 'a.b', 'default')).toBe('default');
    });
  });

  describe('safeExecute', () => {
    it('should execute function successfully', () => {
      const result = safeExecute(() => 'success', 'default');
      expect(result).toBe('success');
    });

    it('should return default on error', () => {
      const result = safeExecute(() => { throw new Error('fail'); }, 'default');
      expect(result).toBe('default');
    });
  });

  describe('safeExecuteAsync', () => {
    it('should execute async function successfully', async () => {
      const result = await safeExecuteAsync(async () => 'success', 'default');
      expect(result).toBe('success');
    });

    it('should return default on error', async () => {
      const result = await safeExecuteAsync(async () => { throw new Error('fail'); }, 'default');
      expect(result).toBe('default');
    });
  });

  describe('debounce', () => {
    it('should debounce calls', async () => {
      const fn = vi.fn();
      const { call } = debounce(fn, 50);
      
      call(1);
      call(2);
      call(3);
      
      expect(fn).not.toHaveBeenCalled();
      
      await new Promise(r => setTimeout(r, 60));
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(3);
    });

    it('should cancel pending calls', async () => {
      const fn = vi.fn();
      const { call, cancel } = debounce(fn, 50);
      
      call(1);
      cancel();
      
      await new Promise(r => setTimeout(r, 60));
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('throttle', () => {
    it('should throttle calls', async () => {
      const fn = vi.fn();
      const { call } = throttle(fn, 50, { leading: true, trailing: false });
      
      call(1);
      call(2);
      call(3);
      
      expect(fn).toHaveBeenCalledTimes(1); // leading
      expect(fn).toHaveBeenCalledWith(1);
      
      await new Promise(r => setTimeout(r, 60));
      expect(fn).toHaveBeenCalledTimes(1); // no trailing
    });

    it('should cancel pending calls', () => {
      const fn = vi.fn();
      const { call, cancel } = throttle(fn, 50, { leading: false, trailing: false });
      
      call(1);
      cancel();
      
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { maxAttempts: 3 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, { maxAttempts: 3, baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      await expect(withRetry(fn, { maxAttempts: 2, baseDelay: 10 })).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      const onRetry = vi.fn();
      
      await withRetry(fn, { maxAttempts: 2, baseDelay: 10, onRetry });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });
  });
});
