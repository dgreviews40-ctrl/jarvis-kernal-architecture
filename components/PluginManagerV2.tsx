/**
 * Plugin Manager v2 UI
 * 
 * Manage plugins with the new v2 architecture.
 */

import React, { useEffect, useState } from 'react';
import { Box, Play, Square, Trash2, Settings, Download, Plus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { usePluginStore, usePlugins, useSelectedPlugin } from '../stores';
import { PluginManifestV2 } from '../plugins/types';

export const PluginManagerV2: React.FC = () => {
  const plugins = usePlugins();
  const selectedPlugin = useSelectedPlugin();
  const { 
    loadPlugins, 
    installPlugin, 
    uninstallPlugin, 
    startPlugin, 
    stopPlugin,
    selectPlugin,
    isLoading 
  } = usePluginStore();
  
  const [showInstallModal, setShowInstallModal] = useState(false);
  
  useEffect(() => {
    loadPlugins();
  }, []);
  
  const handleInstall = async (manifest: PluginManifestV2) => {
    const success = await installPlugin(manifest);
    if (success) {
      setShowInstallModal(false);
    }
  };
  
  const getStateColor = (state: string) => {
    switch (state) {
      case 'active': return 'text-green-400 bg-green-950/30 border-green-500/30';
      case 'loaded': return 'text-blue-400 bg-blue-950/30 border-blue-500/30';
      case 'installed': return 'text-gray-400 bg-gray-950/30 border-gray-500/30';
      case 'error': return 'text-red-400 bg-red-950/30 border-red-500/30';
      case 'loading':
      case 'starting':
      case 'stopping': return 'text-yellow-400 bg-yellow-950/30 border-yellow-500/30';
      default: return 'text-gray-400 bg-gray-950/30 border-gray-500/30';
    }
  };
  
  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#333]">
        <div className="flex items-center gap-3">
          <Box className="text-cyan-500" size={20} />
          <h2 className="text-lg font-bold text-white">PLUGIN MANAGER v2</h2>
          <span className="text-xs text-gray-500 font-mono">
            {plugins.length} plugins
          </span>
        </div>
        <button
          onClick={() => setShowInstallModal(true)}
          className="px-3 py-1.5 bg-cyan-900/30 border border-cyan-500/50 rounded text-cyan-400 hover:bg-cyan-900/50 transition-all flex items-center gap-2 text-xs"
        >
          <Plus size={14} />
          Install Plugin
        </button>
      </div>
      
      {/* Plugin List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {plugins.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Box size={48} className="mx-auto mb-4 opacity-20" />
            <p>No plugins installed</p>
            <p className="text-xs mt-2">Click "Install Plugin" to add one</p>
          </div>
        ) : (
          plugins.map(plugin => (
            <div
              key={plugin.manifest.id}
              onClick={() => selectPlugin(plugin.manifest.id)}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                selectedPlugin?.manifest.id === plugin.manifest.id
                  ? 'border-cyan-500/50 bg-cyan-950/20'
                  : 'border-[#333] bg-[#111] hover:border-[#444]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    plugin.state === 'active' ? 'bg-green-500' :
                    plugin.state === 'error' ? 'bg-red-500' :
                    plugin.state === 'loading' || plugin.state === 'starting' ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-500'
                  }`} />
                  <div>
                    <div className="font-bold text-sm text-gray-200">{plugin.manifest.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {plugin.manifest.id} • v{plugin.manifest.version}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-1 rounded border ${getStateColor(plugin.state)}`}>
                    {plugin.state}
                  </span>
                  
                  {/* Action Buttons */}
                  {plugin.state === 'active' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        stopPlugin(plugin.manifest.id);
                      }}
                      className="p-1.5 text-yellow-500 hover:bg-yellow-900/30 rounded"
                      title="Stop"
                    >
                      <Square size={14} />
                    </button>
                  ) : plugin.state === 'loaded' || plugin.state === 'installed' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startPlugin(plugin.manifest.id);
                      }}
                      className="p-1.5 text-green-500 hover:bg-green-900/30 rounded"
                      title="Start"
                    >
                      <Play size={14} />
                    </button>
                  ) : null}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Uninstall ${plugin.manifest.name}?`)) {
                        uninstallPlugin(plugin.manifest.id);
                      }
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-900/30 rounded"
                    title="Uninstall"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              {plugin.manifest.description && (
                <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                  {plugin.manifest.description}
                </p>
              )}
              
              {plugin.lastError && (
                <div className="mt-2 p-2 bg-red-950/30 border border-red-500/30 rounded text-xs text-red-400">
                  <AlertCircle size={12} className="inline mr-1" />
                  {plugin.lastError.message}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Selected Plugin Details */}
      {selectedPlugin && (
        <div className="border-t border-[#333] p-4 bg-[#0d0d0d]">
          <h3 className="text-sm font-bold text-cyan-400 mb-3">{selectedPlugin.manifest.name}</h3>
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Author:</span>
              <span className="text-gray-300 ml-2">{selectedPlugin.manifest.author}</span>
            </div>
            <div>
              <span className="text-gray-500">License:</span>
              <span className="text-gray-300 ml-2">{selectedPlugin.manifest.license}</span>
            </div>
            <div>
              <span className="text-gray-500">Engine Version:</span>
              <span className="text-gray-300 ml-2">{selectedPlugin.manifest.engineVersion}</span>
            </div>
            <div>
              <span className="text-gray-500">API Calls:</span>
              <span className="text-gray-300 ml-2">{selectedPlugin.apiCalls}</span>
            </div>
          </div>
          
          {selectedPlugin.manifest.provides.length > 0 && (
            <div className="mt-3">
              <span className="text-gray-500 text-xs">Capabilities:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedPlugin.manifest.provides.map(cap => (
                  <span key={cap.name} className="text-[10px] px-2 py-0.5 bg-cyan-900/30 text-cyan-400 rounded">
                    {cap.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {selectedPlugin.manifest.permissions.length > 0 && (
            <div className="mt-3">
              <span className="text-gray-500 text-xs">Permissions:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedPlugin.manifest.permissions.map(perm => (
                  <span key={perm} className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Install Modal (simplified) */}
      {showInstallModal && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#111] border border-[#333] rounded-lg p-6 w-96 max-w-full">
            <h3 className="text-lg font-bold text-white mb-4">Install Plugin</h3>
            <p className="text-sm text-gray-400 mb-4">
              Plugin installation from marketplace coming soon.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              For now, plugins can be registered programmatically via the plugin registry.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginManagerV2;
