import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCPUUsage, getMemoryUsage, getGPUUsage } from '../../server/hardware-monitor.cjs';

describe('Hardware Monitoring Tests', () => {
  describe('getCPUUsage', () => {
    it('should return a number between 0 and 100', () => {
      const result = getCPUUsage();
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should not throw errors when called multiple times', () => {
      // First call establishes baseline
      const result1 = getCPUUsage();
      // Second call should have valid diff calculation
      const result2 = getCPUUsage();
      
      expect(typeof result1).toBe('number');
      expect(typeof result2).toBe('number');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage object with correct structure', () => {
      const result = getMemoryUsage();
      
      expect(result).toHaveProperty('usagePercent');
      expect(result).toHaveProperty('usedGB');
      expect(result).toHaveProperty('totalGB');
      
      expect(typeof result.usagePercent).toBe('number');
      expect(typeof result.usedGB).toBe('number');
      expect(typeof result.totalGB).toBe('number');
      
      expect(result.usagePercent).toBeGreaterThanOrEqual(0);
      expect(result.usagePercent).toBeLessThanOrEqual(100);
      expect(result.totalGB).toBeGreaterThan(0);
    });

    it('should have consistent memory values', () => {
      const result = getMemoryUsage();
      
      // usedGB should not exceed totalGB
      expect(result.usedGB).toBeLessThanOrEqual(result.totalGB);
      
      // usagePercent should reflect used/total ratio
      const calculatedPercent = Math.round((result.usedGB / result.totalGB) * 100);
      expect(Math.abs(result.usagePercent - calculatedPercent)).toBeLessThanOrEqual(1);
    });
  });

  describe('getGPUUsage', () => {
    it('should return GPU info object', () => {
      const result = getGPUUsage();
      
      expect(result).toHaveProperty('load');
      expect(result).toHaveProperty('memoryUsage');
      expect(result).toHaveProperty('temperature');
      expect(result).toHaveProperty('name');
      
      expect(typeof result.load).toBe('number');
      expect(typeof result.memoryUsage).toBe('number');
      expect(typeof result.temperature).toBe('number');
      expect(typeof result.name).toBe('string');
    });

    it('should return valid GPU load percentage', () => {
      const result = getGPUUsage();
      
      // GPU load should be 0-100 (0 if no NVIDIA GPU)
      expect(result.load).toBeGreaterThanOrEqual(0);
      expect(result.load).toBeLessThanOrEqual(100);
    });

    it('should handle missing nvidia-smi gracefully', () => {
      // This test verifies the function doesn't throw even without nvidia-smi
      expect(() => getGPUUsage()).not.toThrow();
    });
  });
});
