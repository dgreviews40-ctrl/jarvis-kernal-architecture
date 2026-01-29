import React, { useState, useEffect } from 'react';
import { haService } from '../services/home_assistant';

interface HAEntityDisplay {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  friendly_name: string;
  domain: string;
  icon: string;
}

const HomeAssistantDashboard: React.FC = () => {
  const [entities, setEntities] = useState<HAEntityDisplay[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<HAEntityDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    entitiesCount: 0,
    error: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Handle search term changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (term.trim() === '') {
      // If search is empty, show all entities
      setFilteredEntities(entities);
    } else {
      // Filter entities based on search term
      const filtered = entities.filter(entity =>
        entity.friendly_name.toLowerCase().includes(term) ||
        entity.entity_id.toLowerCase().includes(term) ||
        entity.domain.toLowerCase().includes(term) ||
        entity.state.toLowerCase().includes(term)
      );
      setFilteredEntities(filtered);
    }
  };

  // Initialize data on mount without setting loading state after first load
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only show loading indicator on initial load
        const isFirstLoad = connectionStatus.entitiesCount === 0;
        if (isFirstLoad) {
          setIsLoading(true);
        }

        // Get connection status
        const status = await haService.getStatus();
        setConnectionStatus(status);

        if (status.connected) {
          // Transform entities for display
          const entityList: HAEntityDisplay[] = Array.from((haService as any).entities.values())
            .map(entity => ({
              entity_id: entity.entity_id,
              state: entity.state,
              attributes: entity.attributes,
              friendly_name: entity.attributes.friendly_name || entity.entity_id,
              domain: entity.entity_id.split('.')[0],
              icon: entity.attributes.icon || getDefaultIcon(entity.entity_id.split('.')[0])
            }));

          setEntities(entityList);
          setFilteredEntities(entityList); // Initially show all entities

          // Apply current search filter if there is one
          if (searchTerm) {
            const filtered = entityList.filter(entity =>
              entity.friendly_name.toLowerCase().includes(searchTerm) ||
              entity.entity_id.toLowerCase().includes(searchTerm) ||
              entity.domain.toLowerCase().includes(searchTerm) ||
              entity.state.toLowerCase().includes(searchTerm)
            );
            setFilteredEntities(filtered);
          }
        }

        // Only hide loading state on first load
        if (isFirstLoad) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching Home Assistant data:', error);
        setConnectionStatus({
          connected: false,
          entitiesCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Only hide loading on error during first load
        const isFirstLoad = connectionStatus.entitiesCount === 0;
        if (isFirstLoad) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Refresh data periodically but with a much longer interval to reduce flickering
    const interval = setInterval(fetchData, 120000); // Every 2 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, [searchTerm]); // Add searchTerm as dependency so search updates when it changes

  const handleEntityToggle = async (entityId: string, currentState: string) => {
    try {
      const action = currentState === 'on' ? 'turn_off' : 'turn_on';
      await haService.executeSmartCommand([entityId, action]);
      
      // Refresh the entity list after action
      const status = await haService.getStatus();
      if (status.connected) {
        const entityList: HAEntityDisplay[] = Array.from((haService as any).entities.values())
          .map(entity => ({
            entity_id: entity.entity_id,
            state: entity.state,
            attributes: entity.attributes,
            friendly_name: entity.attributes.friendly_name || entity.entity_id,
            domain: entity.entity_id.split('.')[0],
            icon: entity.attributes.icon || getDefaultIcon(entity.entity_id.split('.')[0])
          }));
        
        setEntities(entityList);
      }
    } catch (error) {
      console.error(`Error toggling entity ${entityId}:`, error);
      alert(`Failed to toggle ${entityId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Filter entities based on search term
  const getControllableEntities = () => {
    return filteredEntities.filter(entity =>
      ['switch', 'light', 'fan', 'cover', 'lock'].includes(entity.domain)
    );
  };

  const getSensorEntities = () => {
    return filteredEntities.filter(entity =>
      ['sensor', 'binary_sensor', 'camera', 'weather'].includes(entity.domain)
    );
  };

  return (
    <div className="p-6 bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700 h-full overflow-auto custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 sticky top-0 bg-gray-900/50 backdrop-blur-sm py-2 z-10">
        <h3 className="text-xl font-bold text-white">Home Assistant Dashboard</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search entities..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilteredEntities(entities);
                }}
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
      ) : (
        <>
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
              <div className="text-gray-500 text-center py-4">No controllable devices found</div>
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
              <div className="text-gray-500 text-center py-4">No sensors found</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HomeAssistantDashboard;