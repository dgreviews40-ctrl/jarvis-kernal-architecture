import { describe, it, expect, vi } from 'vitest';
import { getCPUUsage, getMemoryUsage, getGPUUsage } from '../server/hardware-monitor.cjs';

// Mock the required modules for testing
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('os', () => ({
  cpus: vi.fn(),
  totalmem: vi.fn(),
  freemem: vi.fn(),
  platform: vi.fn(),
}));

describe('Hardware Monitoring Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCPUUsage', () => {
    it('should return valid CPU usage percentage', () => {
      // Mock WMIC response
      vi.mocked(require('child_process').execSync).mockReturnValueOnce('LoadPercentage=42');
      
      const result = getCPUUsage();
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(typeof result).toBe('number');
    });

    it('should handle WMIC errors gracefully', () => {
      vi.mocked(require('child_process').execSync).mockImplementationOnce(() => {
        throw new Error('WMIC command failed');
      });
      
      const result = getCPUUsage();
      expect(result).toBe(0);
    });
  });

  describe('getMemoryUsage', () => {
    it('should calculate memory usage correctly', () => {
      vi.mocked(require('os').totalmem).mockReturnValueOnce(16 * 1024 * 1024 * 1024); // 16GB
      vi.mocked(require('os').freemem).mockReturnValueOnce(4 * 1024 * 1024 * 1024); // 4GB free
      
      const result = getMemoryUsage();
      expect(result).toBe(75); // 75% used (12GB used out of 16GB)
    });
  });

  describe('getGPUUsage', () => {
    it('should return GPU usage when nvidia-smi is available', () => {
      vi.mocked(require('child_process').execSync).mockReturnValueOnce(`
      +-----------------------------------------------------------------------------+
      | NVIDIA-SMI 535.86.05    Driver Version: 535.86.05    CUDA Version: 12.2     |
      |-------------------------------+----------------------+----------------------+
      | GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
      | Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
      |===============================+======================+======================|
      |   0  NVIDIA RTX 4090     Off  | 00000000:01:00.0 Off |                  N/A |
      | 30%   65C    P2    250W / 450W|   8192MiB / 24576MiB |     42%      Default |
      +-------------------------------+----------------------+----------------------+
      `);
      
      const result = getGPUUsage();
      expect(result).toBe(42);
    });

    it('should return 0 when GPU info is unavailable', () => {
      vi.mocked(require('child_process').execSync).mockImplementationOnce(() => {
        throw new Error('nvidia-smi not found');
      });
      
      const result = getGPUUsage();
      expect(result).toBe(0);
    });
  });
});