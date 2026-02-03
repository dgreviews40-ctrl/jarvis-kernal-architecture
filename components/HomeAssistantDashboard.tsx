import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { haService, HAEntity } from '../services/home_assistant';
import {
  getWhitelistState,
  toggleEntity,
  setMode,
  getMode,
  clearWhitelist,
  selectCategory,
  syncWithEntities,
  categorizeEntity,
  getCategoryLabel,
  isEntityEnabled
} from '../services/haEntityWhitelist';

interface HAEntityDisplay {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  friendly_name: string;
  domain: string;
  icon: string;
  category: string;
  enabled: boolean;
}

type ViewMode = 'dashboard' | 'whitelist';

const HomeAssistantDashboard: React.FC = () => {
  const [entities, setEntities] = useState<HAEntityDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    entitiesCount: 0,
    error: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [whitelistMode, setWhitelistMode] = useState<'whitelist' | 'blacklist' | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Load data on mount and when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    const loadDataAsync = async () => {
      if (!isMounted) return;
      
      try {
        setIsLoading(true);

        // Get connection status
        const status = await haService.getStatus();
        if (!isMounted) return;
        setConnectionStatus(status);

        if (status.connected) {
          // Get all HA entities
          const haEntities = Array.from((haService as any).entities.values()) as HAEntity[];
          
          // Sync with whitelist (adds new entities, removes old ones)
          syncWithEntities(haEntities);
          
          // Get current whitelist state
          const whitelistState = getWhitelistState();
          setWhitelistMode(whitelistState.mode);
          
          // Transform entities for display
          const entityList: HAEntityDisplay[] = haEntities.map(entity => {
            const category = categorizeEntity(entity);
            // Check if entity is enabled based on current mode
            const enabled = isEntityEnabled(entity.entity_id);
            
            return {
              entity_id: entity.entity_id,
              state: entity.state,
              attributes: entity.attributes,
              friendly_name: entity.attributes?.friendly_name || entity.entity_id,
              domain: entity.entity_id.split('.')[0],
              icon: entity.attributes?.icon || getDefaultIcon(entity.entity_id.split('.')[0]),
              category,
              enabled
            };
          });

          if (isMounted) {
            setEntities(entityList);
          }
        }
      } catch (error) {
        console.error('Error fetching Home Assistant data:', error);
        if (isMounted) {
          setConnectionStatus({
            connected: false,
            entitiesCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadDataAsync();
    
    // Refresh data periodically
    const interval = setInterval(loadDataAsync, 120000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Calculate stats from current entities state
  const stats = useMemo(() => {
    const total = entities.length;
    const enabled = entities.filter(e => e.enabled).length;
    const disabled = total - enabled;
    
    const byCategory: Record<string, { total: number; enabled: number }> = {};
    for (const entity of entities) {
      if (!byCategory[entity.category]) {
        byCategory[entity.category] = { total: 0, enabled: 0 };
      }
      byCategory[entity.category].total++;
      if (entity.enabled) {
        byCategory[entity.category].enabled++;
      }
    }
    
    return { total, enabled, disabled, byCategory };
  }, [entities]);

  // Filter entities based on search and category
  const filteredEntities = useMemo(() => {
    let filtered = entities;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }

    // Apply search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entity =>
        entity.friendly_name.toLowerCase().includes(term) ||
        entity.entity_id.toLowerCase().includes(term) ||
        entity.domain.toLowerCase().includes(term) ||
        entity.state.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [entities, searchTerm, selectedCategory]);

  // Dashboard only shows ENABLED entities
  const dashboardEntities = useMemo(() => {
    return filteredEntities.filter(e => e.enabled);
  }, [filteredEntities]);

  const getControllableEntities = () => {
    return dashboardEntities.filter(entity =>
      ['switch', 'light', 'fan', 'cover', 'lock'].includes(entity.domain)
    );
  };

  const getSensorEntities = () => {
    return dashboardEntities.filter(entity =>
      ['sensor', 'binary_sensor', 'camera', 'weather'].includes(entity.domain)
    );
  };

  // Handle entity toggle (for controllable devices)
  const handleEntityToggle = async (entityId: string, currentState: string) => {
    try {
      const action = currentState === 'on' ? 'turn_off' : 'turn_on';
      await haService.executeSmartCommand([entityId, action]);
      
      // Refresh data after action
      await loadData();
    } catch (error) {
      console.error(`Error toggling entity ${entityId}:`, error);
      alert(`Failed to toggle ${entityId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle whitelist toggle (for Jarvis visibility)
  const handleWhitelistToggle = (entityId: string) => {
    const entity = entities.find(e => e.entity_id === entityId);
    if (!entity) return;

    const newEnabled = !entity.enabled;
    
    // Update the actual HA entity in whitelist storage
    const haEntity = Array.from((haService as any).entities.values() as HAEntity[])
      .find((e: HAEntity) => e.entity_id === entityId);
    
    if (haEntity) {
      toggleEntity(haEntity, newEnabled);
    }

    // Update local state immediately for responsive UI
    setEntities(prev => prev.map(e =>
      e.entity_id === entityId ? { ...e, enabled: newEnabled } : e
    ));
  };

  // Handle mode change
  const handleModeChange = (mode: 'whitelist' | 'blacklist' | 'all') => {
    // Update storage - this also updates all entity states in storage
    setMode(mode);
    setWhitelistMode(mode);
    
    // Update all entities in UI to match new mode defaults
    if (mode === 'all') {
      // All mode: everything enabled
      setEntities(prev => prev.map(e => ({ ...e, enabled: true })));
    } else if (mode === 'whitelist') {
      // Whitelist mode: everything disabled by default
      setEntities(prev => prev.map(e => ({ ...e, enabled: false })));
    } else if (mode === 'blacklist') {
      // Blacklist mode: everything enabled by default
      setEntities(prev => prev.map(e => ({ ...e, enabled: true })));
    }
  };

  // Handle category selection
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  // Handle select all in category
  const handleSelectAllInCategory = (category: string, enabled: boolean) => {
    selectCategory(category, enabled);
    
    // Update local state
    setEntities(prev => prev.map(e =>
      e.category === category ? { ...e, enabled } : e
    ));
  };

  // Clear whitelist
  const handleClearWhitelist = () => {
    if (confirm('Clear all whitelist settings? This will reset all entity visibility.')) {
      clearWhitelist();
      setEntities(prev => prev.map(e => ({ ...e, enabled: true })));
      setWhitelistMode('all');
    }
  };

  const getDefaultIcon = (domain: string): string => {
    switch (domain) {
      case 'light': return '💡';
      case 'switch': return '🔌';
      case 'lock': return '🔒';
      case 'cover': return '🚪';
      case 'fan': return '🌀';
      case 'climate': return '🌡️';
      case 'sensor': return '📊';
      case 'binary_sensor': return '📡';
      default: return '⚙️';
    }
  };

  const getDomainColor = (domain: string): string => {
    switch (domain) {
      case 'light': return 'bg-yellow-500/20 border-yellow-500/50';
      case 'switch': return 'bg-blue-500/20 border-blue-500/50';
      case 'lock': return 'bg-purple-500/20 border-purple-500/50';
      case 'cover': return 'bg-green-500/20 border-green-500/50';
      case 'fan': return 'bg-cyan-500/20 border-cyan-500/50';
      case 'sensor': return 'bg-orange-500/20 border-orange-500/50';
      default: return 'bg-gray-500/20 border-gray-500/50';
    }
  };

  const getStateColor = (state: string): string => {
    if (state === 'on' || state === 'home' || state === 'open') return 'text-green-400';
    if (state === 'off' || state === 'away' || state === 'closed') return 'text-red-400';
    return 'text-gray-400';
  };

  // Get unique categories from entities
  const getCategories = () => {
    const categories = new Set(entities.map(e => e.category));
    return ['all', ...Array.from(categories).sort()];
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Home Assistant Dashboard</h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700 h-full overflow-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 sticky top-0 bg-gray-900/50 backdrop-blur-sm py-2 z-10">
        <h3 className="text-xl font-bold text-white">Home Assistant Dashboard</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                viewMode === 'dashboard' 
                  ? 'bg-cyan-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Dashboard ({stats.enabled})
            </button>
            <button
              onClick={() => setViewMode('whitelist')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                viewMode === 'whitelist' 
                  ? 'bg-cyan-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Jarvis Access
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              connectionStatus.connected
                ? 'bg-green-900/30 text-green-400 border border-green-800'
                : 'bg-red-900/30 text-red-400 border border-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus.connected ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span className="text-sm">
                {connectionStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-gray-400 text-sm">
              {connectionStatus.entitiesCount} entities
            </div>
          </div>
        </div>
      </div>

      {!connectionStatus.connected ? (
        <div className="text-center py-8">
          <div className="text-red-400 mb-2">⚠️ Connection Error</div>
          <div className="text-gray-400 text-sm">{connectionStatus.error}</div>
          <div className="mt-4 text-gray-500 text-sm">
            Please check your Home Assistant configuration in Settings
          </div>
        </div>
      ) : viewMode === 'whitelist' ? (
        // Whitelist Configuration View
        <div>
          {/* Mode Selection */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h4 className="text-lg font-semibold text-cyan-400 mb-3">Jarvis Access Mode</h4>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={() => handleModeChange('all')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  whitelistMode === 'all'
                    ? 'bg-green-600/30 border-green-500 text-green-400'
                    : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:text-white'
                }`}
              >
                <div className="font-medium">🌐 All Entities</div>
                <div className="text-xs opacity-75">Jarvis can access everything</div>
              </button>
              <button
                onClick={() => handleModeChange('whitelist')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  whitelistMode === 'whitelist'
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-400'
                    : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:text-white'
                }`}
              >
                <div className="font-medium">✓ Whitelist</div>
                <div className="text-xs opacity-75">Only selected entities</div>
              </button>
              <button
                onClick={() => handleModeChange('blacklist')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  whitelistMode === 'blacklist'
                    ? 'bg-orange-600/30 border-orange-500 text-orange-400'
                    : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:text-white'
                }`}
              >
                <div className="font-medium">✕ Blacklist</div>
                <div className="text-xs opacity-75">Exclude selected entities</div>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-gray-700/30 rounded-lg">
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Entities</div>
              </div>
              <div className="p-3 bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{stats.enabled}</div>
                <div className="text-xs text-gray-400">Accessible to Jarvis</div>
              </div>
              <div className="p-3 bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-400">{stats.disabled}</div>
                <div className="text-xs text-gray-400">Hidden from Jarvis</div>
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-4 flex flex-wrap gap-2">
            {getCategories().map(category => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {category === 'all' ? '📁 All Categories' : getCategoryLabel(category)}
              </button>
            ))}
          </div>

          {/* Bulk Actions */}
          {selectedCategory !== 'all' && whitelistMode !== 'all' && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => handleSelectAllInCategory(selectedCategory, true)}
                className="px-3 py-1 bg-green-600/30 text-green-400 rounded-lg text-sm hover:bg-green-600/50"
              >
                Enable All in Category
              </button>
              <button
                onClick={() => handleSelectAllInCategory(selectedCategory, false)}
                className="px-3 py-1 bg-red-600/30 text-red-400 rounded-lg text-sm hover:bg-red-600/50"
              >
                Disable All in Category
              </button>
            </div>
          )}

          {/* Entity Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEntities.map((entity) => (
              <div
                key={entity.entity_id}
                className={`p-3 rounded-lg border transition-all ${
                  entity.enabled
                    ? 'bg-cyan-900/20 border-cyan-500/50'
                    : 'bg-gray-800/30 border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <span className="text-xl mr-2">{entity.icon}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-white text-sm truncate">
                        {entity.friendly_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{entity.entity_id}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleWhitelistToggle(entity.entity_id)}
                    className={`ml-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      entity.enabled
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    {entity.enabled ? '✓ On' : '✕ Off'}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">{getCategoryLabel(entity.category)}</span>
                  <span className={getStateColor(entity.state)}>{entity.state}</span>
                </div>
              </div>
            ))}
          </div>

          {filteredEntities.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No entities match your filters
            </div>
          )}

          {/* Clear Button */}
          <div className="mt-6 text-center">
            <button
              onClick={handleClearWhitelist}
              className="px-4 py-2 text-red-400 hover:text-red-300 text-sm"
            >
              Reset All Settings
            </button>
          </div>
        </div>
      ) : (
        // Dashboard View - ONLY SHOWS ENABLED ENTITIES
        <>
          {/* Show message if whitelist is active */}
          {whitelistMode !== 'all' && (
            <div className="mb-4 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
              <div className="text-sm text-cyan-400">
                🔒 Showing only {stats.enabled} enabled entities. 
                <button 
                  onClick={() => setViewMode('whitelist')}
                  className="underline hover:text-cyan-300 ml-1"
                >
                  Configure access
                </button>
              </div>
            </div>
          )}

          {/* Controllable Devices */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center">
              <span className="mr-2">⚡</span> Controllable Devices
              <span className="ml-2 text-sm text-gray-500">({getControllableEntities().length})</span>
            </h4>
            {getControllableEntities().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {getControllableEntities().map((entity) => (
                  <div
                    key={entity.entity_id}
                    className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:scale-[1.02] ${getDomainColor(entity.domain)}`}
                    onClick={() => handleEntityToggle(entity.entity_id, entity.state)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-xl mr-3">{entity.icon}</span>
                        <div>
                          <div className="font-medium text-white">{entity.friendly_name}</div>
                          <div className="text-xs text-gray-400">{entity.entity_id}</div>
                        </div>
                      </div>
                      <div className={`font-semibold ${getStateColor(entity.state)}`}>
                        {entity.state}
                      </div>
                    </div>
                    {entity.attributes.unit_of_measurement && (
                      <div className="mt-2 text-sm text-gray-300">
                        {entity.attributes.current_temperature || entity.attributes.brightness || entity.state}
                        {entity.attributes.unit_of_measurement}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">
                {whitelistMode === 'all' 
                  ? 'No controllable devices found' 
                  : 'No enabled controllable devices. Enable some in Jarvis Access.'}
              </div>
            )}
          </div>

          {/* Sensors */}
          <div>
            <h4 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center">
              <span className="mr-2">📊</span> Sensors
              <span className="ml-2 text-sm text-gray-500">({getSensorEntities().length})</span>
            </h4>
            {getSensorEntities().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {getSensorEntities().map((entity) => (
                  <div
                    key={entity.entity_id}
                    className={`p-4 rounded-lg border ${getDomainColor(entity.domain)}`}
                  >
                    <div className="flex items-center">
                      <span className="text-xl mr-3">{entity.icon}</span>
                      <div>
                        <div className="font-medium text-white">{entity.friendly_name}</div>
                        <div className="text-xs text-gray-400">{entity.entity_id}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold text-white">
                        {entity.attributes.unit_of_measurement
                          ? `${entity.state} ${entity.attributes.unit_of_measurement}`
                          : entity.state}
                      </div>
                      {entity.attributes.device_class && (
                        <div className="text-xs text-gray-400 mt-1 capitalize">
                          {entity.attributes.device_class.replace('_', ' ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">
                {whitelistMode === 'all' 
                  ? 'No sensors found' 
                  : 'No enabled sensors. Enable some in Jarvis Access.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HomeAssistantDashboard;
