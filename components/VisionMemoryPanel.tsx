/**
 * Vision Memory Panel Component
 * 
 * Displays and manages visual memories - images JARVIS has seen.
 * Features:
 * - Grid/thumbnail view of stored images
 * - Search by text description
 * - Tag filtering
 * - Time range filtering
 * - Import/export memories
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Image as ImageIcon, Tag, Calendar, 
  Download, Upload, Trash2, X, Eye, Sparkles,
  Grid, List, Clock, Filter
} from 'lucide-react';

import { visionMemory, VisionMemoryEntry, VisionSearchResult, VisionStats } from '../services/visionMemory';

// Types
interface VisionMemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'size';

const VisionMemoryPanel: React.FC<VisionMemoryPanelProps> = ({ isOpen, onClose }) => {
  // State
  const [memories, setMemories] = useState<VisionMemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VisionSearchResult[] | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [stats, setStats] = useState<VisionStats | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<VisionMemoryEntry | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load memories on mount
  useEffect(() => {
    if (isOpen) {
      loadMemories();
      visionMemory.initialize();
    }
  }, [isOpen]);

  // Subscribe to memory changes
  useEffect(() => {
    const handleMemoryAdded = () => loadMemories();
    const handleMemoryDeleted = () => loadMemories();
    
    visionMemory.on('memoryAdded', handleMemoryAdded);
    visionMemory.on('memoryDeleted', handleMemoryDeleted);
    
    return () => {
      visionMemory.off('memoryAdded', handleMemoryAdded);
      visionMemory.off('memoryDeleted', handleMemoryDeleted);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      } else {
        setSearchResults(null);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadMemories = () => {
    const all = visionMemory.getAllMemories();
    setMemories(all);
    setStats(visionMemory.getStats());
  };

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const results = await visionMemory.searchMemories(query, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter and sort memories
  const getFilteredMemories = (): VisionMemoryEntry[] => {
    let filtered = searchResults 
      ? searchResults.map(r => r.entry)
      : memories;

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(m => 
        selectedTags.some(tag => m.tags.includes(tag))
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest': return b.timestamp - a.timestamp;
        case 'oldest': return a.timestamp - b.timestamp;
        case 'size': return b.metadata.size - a.metadata.size;
        default: return 0;
      }
    });

    return filtered;
  };

  const handleDeleteMemory = async (id: string) => {
    if (confirm('Delete this memory?')) {
      await visionMemory.deleteMemory(id);
      if (selectedMemory?.id === id) {
        setSelectedMemory(null);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Clear ALL vision memories? This cannot be undone.')) {
      await visionMemory.clearAllMemories();
      setShowConfirmClear(false);
      setSelectedMemory(null);
    }
  };

  const handleExport = () => {
    const data = visionMemory.exportMemories();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis_vision_memories_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await visionMemory.importMemories(text);
      alert(`Imported ${count} memories`);
      loadMemories();
    } catch (error) {
      alert('Import failed: ' + (error as Error).message);
    }
    
    e.target.value = '';
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const displayedMemories = getFilteredMemories();
  const allTags = stats?.topTags || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[95vw] h-[90vh] bg-slate-900/95 rounded-2xl border border-slate-700 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ImageIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Vision Memory</h2>
              <p className="text-sm text-slate-400">
                {stats?.totalImages || 0} images · {formatSize(stats?.totalSize || 0)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Import/Export */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            
            <button
              onClick={() => setShowConfirmClear(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-4 border-b border-slate-700 bg-slate-800/50">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
            {isSearching && (
              <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 animate-pulse" />
            )}
          </div>

          {/* View Mode */}
          <div className="flex items-center bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="size">Largest First</option>
          </select>

          {/* Filter indicator */}
          {(selectedTags.length > 0 || searchResults) && (
            <button
              onClick={() => { setSelectedTags([]); setSearchQuery(''); setSearchResults(null); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-400 bg-purple-500/10 rounded-lg hover:bg-purple-500/20 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Tags */}
          <div className="w-48 border-r border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </h3>
            <div className="space-y-1">
              {allTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="capitalize">{tag}</span>
                  <span className="text-xs text-slate-500">{count}</span>
                </button>
              ))}
              {allTags.length === 0 && (
                <p className="text-xs text-slate-500 italic">No tags yet</p>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {displayedMemories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No memories found</p>
                <p className="text-sm">
                  {searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search'
                    : 'Share images with JARVIS to build your visual memory'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {displayedMemories.map((memory) => (
                  <div
                    key={memory.id}
                    onClick={() => setSelectedMemory(memory)}
                    className="group relative aspect-square bg-slate-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                  >
                    <img
                      src={memory.thumbnailUrl}
                      alt={memory.description}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs text-white line-clamp-2">{memory.description}</p>
                        <p className="text-xs text-slate-400">{formatDate(memory.timestamp)}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteMemory(memory.id); }}
                      className="absolute top-2 right-2 p-1 bg-red-500/80 text-white rounded opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div className="space-y-2">
                {displayedMemories.map((memory) => (
                  <div
                    key={memory.id}
                    onClick={() => setSelectedMemory(memory)}
                    className="flex items-center gap-4 p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition-colors"
                  >
                    <img
                      src={memory.thumbnailUrl}
                      alt={memory.description}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{memory.description || 'No description'}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(memory.timestamp)} · {formatSize(memory.metadata.size)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {memory.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteMemory(memory.id); }}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Memory Detail Modal */}
        {selectedMemory && (
            <div
              onClick={() => setSelectedMemory(null)}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-8 animate-in fade-in duration-200"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-4xl max-h-full bg-slate-900 rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
              >
                <div className="flex-1 overflow-auto p-6">
                  <img
                    src={selectedMemory.imageUrl}
                    alt={selectedMemory.description}
                    className="max-w-full rounded-xl mb-4"
                  />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {selectedMemory.description || 'Untitled Image'}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedMemory.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 text-sm bg-purple-500/20 text-purple-300 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {selectedMemory.context && (
                    <div className="p-3 bg-slate-800 rounded-lg mb-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Context</p>
                      <p className="text-sm text-slate-300">{selectedMemory.context}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-slate-800 rounded-lg">
                      <p className="text-slate-400">Dimensions</p>
                      <p className="text-white">{selectedMemory.metadata.width} x {selectedMemory.metadata.height}</p>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-lg">
                      <p className="text-slate-400">Size</p>
                      <p className="text-white">{formatSize(selectedMemory.metadata.size)}</p>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-lg">
                      <p className="text-slate-400">Date</p>
                      <p className="text-white">{formatDate(selectedMemory.timestamp)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
                  <button
                    onClick={() => setSelectedMemory(null)}
                    className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDeleteMemory(selectedMemory.id)}
                    className="flex items-center gap-2 px-4 py-2 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        {/* Clear Confirmation */}
        {showConfirmClear && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
            <div className="p-6 bg-slate-800 rounded-2xl max-w-md">
              <h3 className="text-lg font-semibold text-white mb-2">Clear All Memories?</h3>
              <p className="text-slate-300 mb-4">
                This will permanently delete all {stats?.totalImages} visual memories. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisionMemoryPanel;
