/**
 * Plugin Marketplace Tests
 * 
 * Tests for marketplace functionality
 */

import {
  searchPlugins,
  getFeaturedPlugins,
  getCategories,
  getPluginDetails,
  installFromMarketplace,
  submitRating,
  checkAllUpdates,
  getMarketplaceStats
} from '../../plugins/marketplace';

describe('Plugin Marketplace', () => {
  describe('searchPlugins', () => {
    it('should return all plugins when no query', async () => {
      const result = await searchPlugins();
      expect(result.plugins.length).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should filter by search query', async () => {
      const result = await searchPlugins('weather');
      expect(result.plugins.length).toBeGreaterThan(0);
      expect(result.plugins[0].manifest.name.toLowerCase()).toContain('weather');
    });

    it('should filter by category', async () => {
      const result = await searchPlugins('', { category: 'utility' });
      expect(result.plugins.every(p => p.manifest.tags.includes('utility'))).toBe(true);
    });

    it('should filter by verified status', async () => {
      const result = await searchPlugins('', { verified: true });
      expect(result.plugins.every(p => p.verified)).toBe(true);
    });

    it('should filter by minimum rating', async () => {
      const result = await searchPlugins('', { minRating: 4.5 });
      expect(result.plugins.every(p => p.rating >= 4.5)).toBe(true);
    });

    it('should sort by rating and downloads', async () => {
      const result = await searchPlugins();
      // Check that results are sorted (higher rated plugins first)
      for (let i = 1; i < result.plugins.length; i++) {
        const prev = result.plugins[i - 1];
        const curr = result.plugins[i];
        const prevScore = prev.rating * Math.log(prev.downloadCount + 1);
        const currScore = curr.rating * Math.log(curr.downloadCount + 1);
        expect(prevScore).toBeGreaterThanOrEqual(currScore);
      }
    });
  });

  describe('getFeaturedPlugins', () => {
    it('should return verified plugins only', async () => {
      const result = await getFeaturedPlugins();
      expect(result.plugins.every(p => p.verified)).toBe(true);
    });

    it('should return at most 5 plugins', async () => {
      const result = await getFeaturedPlugins();
      expect(result.plugins.length).toBeLessThanOrEqual(5);
    });

    it('should sort by rating', async () => {
      const result = await getFeaturedPlugins();
      for (let i = 1; i < result.plugins.length; i++) {
        expect(result.plugins[i - 1].rating).toBeGreaterThanOrEqual(result.plugins[i].rating);
      }
    });
  });

  describe('getCategories', () => {
    it('should return unique categories', () => {
      const categories = getCategories();
      const uniqueCategories = [...new Set(categories)];
      expect(categories).toEqual(uniqueCategories);
    });

    it('should return sorted categories', () => {
      const categories = getCategories();
      const sorted = [...categories].sort();
      expect(categories).toEqual(sorted);
    });

    it('should include categories from all plugins', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('getPluginDetails', () => {
    it('should return plugin details for valid ID', async () => {
      const result = await getPluginDetails('weather.forecast');
      expect(result.listing).toBeDefined();
      expect(result.listing?.manifest.id).toBe('weather.forecast');
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid ID', async () => {
      const result = await getPluginDetails('invalid.plugin');
      expect(result.listing).toBeUndefined();
      expect(result.error).toBe('Plugin not found');
    });
  });

  describe('installFromMarketplace', () => {
    it('should fail for non-existent plugin', async () => {
      const result = await installFromMarketplace('nonexistent.plugin');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should call progress callback', async () => {
      const progressCallback = jest.fn();
      await installFromMarketplace('weather.forecast', progressCallback);
      // Progress callback should be called during installation
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('submitRating', () => {
    it('should accept valid rating', async () => {
      const result = await submitRating('weather.forecast', 5, 'Great plugin!');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept rating without review', async () => {
      const result = await submitRating('weather.forecast', 4);
      expect(result.success).toBe(true);
    });
  });

  describe('checkAllUpdates', () => {
    it('should detect available updates', async () => {
      const installedPlugins = [
        { id: 'weather.forecast', version: '1.0.0' }, // Old version
        { id: 'demo.hello-world', version: '1.0.0' }  // Current version
      ];
      
      const result = await checkAllUpdates(installedPlugins);
      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.updates)).toBe(true);
    });

    it('should return empty array when no updates', async () => {
      const installedPlugins = [
        { id: 'weather.forecast', version: '99.0.0' } // Future version
      ];
      
      const result = await checkAllUpdates(installedPlugins);
      expect(result.updates).toHaveLength(0);
    });
  });

  describe('getMarketplaceStats', () => {
    it('should return stats object', () => {
      const stats = getMarketplaceStats();
      expect(stats).toHaveProperty('totalPlugins');
      expect(stats).toHaveProperty('verifiedPlugins');
    });

    it('should calculate correct totals', () => {
      const stats = getMarketplaceStats();
      expect(stats.totalPlugins).toBeGreaterThan(0);
      expect(stats.verifiedPlugins).toBeGreaterThanOrEqual(0);
      expect(stats.verifiedPlugins).toBeLessThanOrEqual(stats.totalPlugins);
    });
  });
});
