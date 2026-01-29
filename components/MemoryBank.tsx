import React, { useState } from 'react';
import { MemoryNode, MemorySearchResult } from '../types';
import { Database, Search, Clock, Tag, Trash2 } from 'lucide-react';

interface MemoryBankProps {
  nodes: MemoryNode[];
  onForget: (id: string) => void;
  onManualSearch: (query: string) => Promise<MemorySearchResult[]>;
}

export const MemoryBank: React.FC<MemoryBankProps> = ({ nodes, onForget, onManualSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[] | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const results = await onManualSearch(searchQuery);
    setSearchResults(results);
  };

  const displayNodes = searchResults ? searchResults.map(r => r.node) : nodes;

  const getTypeColor = (type: MemoryNode['type']) => {
    switch (type) {
      case 'FACT': return 'text-blue-400 border-blue-900/50 bg-blue-950/20';
      case 'PREFERENCE': return 'text-purple-400 border-purple-900/50 bg-purple-950/20';
      case 'EPISODE': return 'text-green-400 border-green-900/50 bg-green-950/20';
      default: return 'text-gray-400 border-gray-800 bg-gray-900/20';
    }
  };

  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg p-6 flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="text-purple-500" />
          LONG-TERM MEMORY CORE
        </h2>
        <div className="text-xs text-gray-500 font-mono">
           {nodes.length} RECORDS • SQLITE (EMULATED)
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search semantic memory..."
          className="w-full bg-[#111] border border-[#333] rounded-full py-2 pl-10 pr-4 text-sm text-gray-300 focus:outline-none focus:border-purple-500 transition-colors"
        />
      </form>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
        {displayNodes.length === 0 && (
          <div className="text-center text-gray-600 italic py-8">
            No memories found matching query.
          </div>
        )}
        
        {displayNodes.map(node => (
          <div 
            key={node.id} 
            className={`border rounded-lg p-3 transition-all hover:bg-[#151515] group relative ${getTypeColor(node.type).split(' ').slice(1).join(' ')}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getTypeColor(node.type)}`}>
                {node.type}
              </span>
              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                <Clock size={10} />
                {new Date(node.created).toLocaleDateString()}
              </span>
            </div>
            
            <p className="text-sm text-gray-300 mb-2 leading-relaxed">
              {node.content}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {node.tags.map(tag => (
                <div key={tag} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <Tag size={8} />
                  {tag}
                </div>
              ))}
            </div>

            <button 
              onClick={() => onForget(node.id)}
              className="absolute top-3 right-3 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};