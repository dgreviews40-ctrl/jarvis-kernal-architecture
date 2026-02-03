/**
 * Plugin Marketplace UI
 * 
 * Browse, search, and install plugins from the marketplace
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Download,

  CheckCircle,
  Shield,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Package,
  TrendingUp,
  Users,
  Tag,
  Loader2,
  AlertCircle,
  Check,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { PluginListing } from '../plugins/types';
import {
  searchPlugins,
  getFeaturedPlugins,
  getCategories,
  installFromMarketplace,
  getMarketplaceStats,
  getPluginDetails
} from '../plugins/marketplace';
import { usePlugins, usePluginStore } from '../stores';
import { logger } from '../services/logger';

interface PluginCardProps {
  plugin: PluginListing;
  isInstalled: boolean;
  onInstall: (plugin: PluginListing) => void;
  onClick: () => void;
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, isInstalled, onInstall, onClick }) => {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInstalling(true);
    await onInstall(plugin);
    setIsInstalling(false);
  };

  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-cyan-500/50 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
          {plugin.iconUrl ? (
            <img src={plugin.iconUrl} alt="" className="w-12 h-12 object-contain" />
          ) : (
            <Package size={32} className="text-gray-600" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                {plugin.manifest.name}
                {plugin.verified && (
                  <Shield size={14} className="text-green-400" title="Verified" />
                )}
              </h3>
              <p className="text-sm text-gray-500">{plugin.manifest.author}</p>
            </div>

          </div>

          <p className="text-sm text-gray-400 mt-2 line-clamp-2">
            {plugin.manifest.description}
          </p>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Tag size={12} />
                v{plugin.manifest.version}
              </span>
            </div>

            {isInstalled ? (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Check size={16} />
                Installed
              </span>
            ) : (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-black text-sm font-medium rounded transition-colors"
              >
                {isInstalling ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Install
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PluginDetailModalProps {
  plugin: PluginListing | null;
  isOpen: boolean;
  onClose: () => void;
  isInstalled: boolean;
  onInstall: () => void;
}

const PluginDetailModal: React.FC<PluginDetailModalProps> = ({
  plugin,
  isOpen,
  onClose,
  isInstalled,
  onInstall
}) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);

  if (!isOpen || !plugin) return null;

  const handleInstall = async () => {
    setIsInstalling(true);
    await onInstall();
    setIsInstalling(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-gray-800 rounded-xl flex items-center justify-center">
              {plugin.iconUrl ? (
                <img src={plugin.iconUrl} alt="" className="w-16 h-16 object-contain" />
              ) : (
                <Package size={40} className="text-gray-600" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                {plugin.manifest.name}
                {plugin.verified && (
                  <Shield size={20} className="text-green-400" />
                )}
              </h2>
              <p className="text-gray-400">{plugin.manifest.author}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-gray-500">v{plugin.manifest.version}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Description</h3>
            <p className="text-gray-300">{plugin.manifest.description}</p>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {plugin.manifest.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Permissions */}
          {plugin.manifest.permissions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Permissions Required</h3>
              <div className="flex flex-wrap gap-2">
                {plugin.manifest.permissions.map(perm => (
                  <span
                    key={perm}
                    className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded border border-yellow-900/50"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {plugin.manifest.dependencies.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Dependencies</h3>
              <ul className="space-y-1">
                {plugin.manifest.dependencies.map(dep => (
                  <li key={dep.pluginId} className="text-sm text-gray-400">
                    {dep.pluginId} {dep.versionRange}
                    {dep.optional && <span className="text-gray-600 ml-1">(optional)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Screenshots */}
          {plugin.screenshots && plugin.screenshots.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Screenshots</h3>
              <div className="grid grid-cols-2 gap-4">
                {plugin.screenshots.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Screenshot ${i + 1}`}
                    className="rounded-lg border border-gray-800"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Install Progress */}
          {isInstalling && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Installing...</span>
                <span className="text-sm text-cyan-400">{installProgress}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${installProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <div className="text-sm text-gray-500">
            License: {plugin.manifest.license}
          </div>
          <div className="flex items-center gap-3">
            {plugin.manifest.homepage && (
              <a
                href={plugin.manifest.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <ExternalLink size={16} />
                Website
              </a>
            )}
            {isInstalled ? (
              <span className="flex items-center gap-2 px-6 py-2 bg-green-900/50 text-green-400 rounded-lg">
                <CheckCircle size={18} />
                Installed
              </span>
            ) : (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-black font-medium rounded-lg transition-colors"
              >
                {isInstalling ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Install Plugin
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PluginMarketplaceProps {
  onClose?: () => void;
}

export const PluginMarketplace: React.FC<PluginMarketplaceProps> = ({ onClose }) => {
  const installedPlugins = usePlugins();
  const [localInstalledIds, setLocalInstalledIds] = useState<Set<string>>(new Set());

  const installedIds = useMemo(() => {
    const ids = new Set(installedPlugins.map(p => p.manifest.id));
    // Merge with locally tracked installs (for built-in plugins)
    localInstalledIds.forEach(id => ids.add(id));
    return ids;
  }, [installedPlugins, localInstalledIds]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [plugins, setPlugins] = useState<PluginListing[]>([]);
  const [featuredPlugins, setFeaturedPlugins] = useState<PluginListing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalPlugins: 0,
    verifiedPlugins: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load installed plugins from the plugin store
        await usePluginStore.getState().loadPlugins();
        
        const [searchResult, featuredResult, cats] = await Promise.all([
          searchPlugins(),
          getFeaturedPlugins(),
          Promise.resolve(getCategories())
        ]);

        if (searchResult.error) throw new Error(searchResult.error);
        if (featuredResult.error) throw new Error(featuredResult.error);

        setPlugins(searchResult.plugins);
        setFeaturedPlugins(featuredResult.plugins);
        setCategories(cats);
        setStats(getMarketplaceStats());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load marketplace');
        logger.error('MARKETPLACE', 'Failed to load marketplace data', { error: e });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Search with filters
  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await searchPlugins(searchQuery, {
        category: selectedCategory || undefined,
        verified: showVerifiedOnly || undefined
      });

      if (result.error) throw new Error(result.error);
      setPlugins(result.plugins);
    } catch (e) {
      logger.error('MARKETPLACE', 'Search failed', { error: e });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, showVerifiedOnly]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeout);
  }, [handleSearch]);

  // Install plugin
  const handleInstall = async (plugin: PluginListing) => {
    try {
      const result = await installFromMarketplace(plugin.manifest.id, (stage, progress) => {
        logger.info('MARKETPLACE', `Installing ${plugin.manifest.id}: ${stage} (${progress}%)`);
      });

      if (result.success) {
        logger.success('MARKETPLACE', `Installed ${plugin.manifest.name}`);
        // Refresh plugins from store to get updated installed list
        await usePluginStore.getState().loadPlugins();
        // Track locally for UI update (in case loadPlugins doesn't immediately reflect)
        setLocalInstalledIds(prev => new Set([...prev, plugin.manifest.id]));
        // Show success notification
        setNotification({ message: `${plugin.manifest.name} installed successfully!`, type: 'success' });
        setTimeout(() => setNotification(null), 3000);
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (e) {
      logger.error('MARKETPLACE', `Failed to install ${plugin.manifest.id}`, { error: e });
      setNotification({ message: `Installation failed: ${e instanceof Error ? e.message : 'Unknown error'}`, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black text-gray-300 relative">
      {/* Notification Toast */}
      {notification && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse ${
          notification.type === 'success' ? 'bg-green-900/90 text-green-400 border border-green-700' : 'bg-red-900/90 text-red-400 border border-red-700'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
            <Sparkles className="text-cyan-400" size={24} />
            <h1 className="text-xl font-bold text-white">Plugin Marketplace</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-gray-500">
              <Package size={14} />
              {stats.totalPlugins} plugins
            </span>
            <span className="flex items-center gap-1 text-green-400">
              <Shield size={14} />
              {stats.verifiedPlugins} verified
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="checkbox"
              checked={showVerifiedOnly}
              onChange={(e) => setShowVerifiedOnly(e.target.checked)}
              className="rounded border-gray-600"
            />
            <Shield size={14} className="text-green-400" />
            <span className="text-sm">Verified only</span>
          </label>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertCircle size={48} className="mb-4" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured Plugins */}
            {!searchQuery && !selectedCategory && !showVerifiedOnly && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-cyan-400" />
                  Featured Plugins
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {featuredPlugins.map(plugin => (
                    <PluginCard
                      key={plugin.manifest.id}
                      plugin={plugin}
                      isInstalled={installedIds.has(plugin.manifest.id)}
                      onInstall={handleInstall}
                      onClick={() => setSelectedPlugin(plugin)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All Plugins */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">
                {searchQuery ? `Search Results (${plugins.length})` : 'All Plugins'}
              </h2>
              {plugins.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No plugins found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {plugins.map(plugin => (
                    <PluginCard
                      key={plugin.manifest.id}
                      plugin={plugin}
                      isInstalled={installedIds.has(plugin.manifest.id)}
                      onInstall={handleInstall}
                      onClick={() => setSelectedPlugin(plugin)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <PluginDetailModal
        plugin={selectedPlugin}
        isOpen={!!selectedPlugin}
        onClose={() => setSelectedPlugin(null)}
        isInstalled={selectedPlugin ? installedIds.has(selectedPlugin.manifest.id) : false}
        onInstall={() => selectedPlugin && handleInstall(selectedPlugin)}
      />
    </div>
  );
};

export default PluginMarketplace;
