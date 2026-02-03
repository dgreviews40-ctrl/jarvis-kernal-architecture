import React from 'react';
import { RuntimePlugin } from '../types';
import { Box, ToggleLeft, ToggleRight, Shield, Zap, Store } from 'lucide-react';
import { useUIStore } from '../stores';

interface PluginManagerProps {
  plugins: RuntimePlugin[];
  onToggle: (id: string) => void;
}

export const PluginManager: React.FC<PluginManagerProps> = ({ plugins, onToggle }) => {
  const { setMainView } = useUIStore();
  return (
    <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Box size={16} className="text-cyan-500" />
          PLUGIN REGISTRY
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainView('MARKETPLACE')}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded border border-purple-600/30 transition-colors"
          >
            <Store size={12} />
            Marketplace
          </button>
          <span className="text-xs text-gray-600 font-mono">INSTALLED: {plugins.length}</span>
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
        {plugins.map(p => (
          <div 
            key={p.manifest.id} 
            className={`
              border rounded p-3 transition-all
              ${p.status === 'ACTIVE' 
                ? 'border-[#333] bg-[#111]' 
                : 'border-gray-800 bg-gray-900/50 opacity-60'}
            `}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-bold text-sm text-gray-200">{p.manifest.name}</div>
                <div className="text-[10px] text-gray-500 font-mono">{p.manifest.id} • v{p.manifest.version}</div>
              </div>
              <button 
                onClick={() => onToggle(p.manifest.id)}
                className={`text-gray-400 hover:text-white transition-colors`}
              >
                {p.status === 'ACTIVE' 
                  ? <ToggleRight size={24} className="text-cyan-500" /> 
                  : <ToggleLeft size={24} className="text-gray-600" />}
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-3 line-clamp-2">
              {p.manifest.description}
            </p>

            <div className="flex flex-wrap gap-2">
              {/* Permissions */}
              {p.manifest.permissions.map(perm => (
                <div key={perm} className="flex items-center gap-1 text-[9px] bg-red-900/20 text-red-400 px-1.5 py-0.5 rounded border border-red-900/30">
                  <Shield size={8} />
                  {perm}
                </div>
              ))}
              {/* Capabilities */}
              {p.manifest.capabilities.map(cap => (
                <div key={cap} className="flex items-center gap-1 text-[9px] bg-blue-900/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-900/30">
                  <Zap size={8} />
                  {cap}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};