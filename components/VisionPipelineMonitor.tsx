/**
 * Vision Pipeline Monitor Component
 * 
 * Displays real-time video processing status and visual memory
 */

import React, { useState } from 'react';
import { useVisionPipeline } from '../hooks/useVisionPipeline';
import {
  Camera,
  Video,
  Brain,
  Clock,
  Trash2,
  RefreshCw,
  Search,
  Activity,
  Tag,
  Box,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const VisionPipelineMonitor: React.FC = () => {
  const {
    isInitialized,
    isProcessing,
    visionServerAvailable,
    visualMemorySize,
    activeStreams,
    queryVisualMemory,
    getActivitySummary,
    clearVisualMemory,
    recentMemory
  } = useVisionPipeline();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ReturnType<typeof queryVisualMemory> extends Promise<infer T> ? T : never>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await queryVisualMemory(searchQuery, {
        timeWindowMs: 10 * 60 * 1000, // 10 minutes
        maxResults: 10
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Visual memory search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const activitySummary = getActivitySummary(5 * 60 * 1000); // Last 5 minutes

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Camera className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Vision Pipeline</h3>
              <p className="text-sm text-slate-400">
                Video processing & visual memory
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {visionServerAvailable ? (
              <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                <CheckCircle2 className="w-3 h-3" />
                Server Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">
                <XCircle className="w-3 h-3" />
                Server Offline
              </span>
            )}
            {isProcessing && (
              <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                Processing
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-700">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Brain className="w-4 h-4" />
            Visual Memory
          </div>
          <div className="text-2xl font-bold text-white">
            {visualMemorySize}
          </div>
          <div className="text-xs text-slate-500">
            Stored frames
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Video className="w-4 h-4" />
            Active Streams
          </div>
          <div className="text-2xl font-bold text-white">
            {activeStreams.length}
          </div>
          <div className="text-xs text-slate-500">
            Currently sampling
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Tag className="w-4 h-4" />
            Recent Tags
          </div>
          <div className="text-2xl font-bold text-white">
            {activitySummary.topTags.length}
          </div>
          <div className="text-xs text-slate-500">
            In last 5 minutes
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Box className="w-4 h-4" />
            Objects Detected
          </div>
          <div className="text-2xl font-bold text-white">
            {activitySummary.uniqueObjects.length}
          </div>
          <div className="text-xs text-slate-500">
            Unique objects
          </div>
        </div>
      </div>

      {/* Visual Memory Search */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-medium text-slate-300">
            Query Visual Memory
          </h4>
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="e.g., 'What did I see 5 minutes ago?'"
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
          >
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-400">
              Found {searchResults.length} results:
            </p>
            {searchResults.map((entry) => (
              <div
                key={entry.id}
                className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">
                    {entry.source}
                  </span>
                </div>
                <p className="text-sm text-white mt-1">{entry.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {entry.objects.slice(0, 3).map((obj) => (
                    <span
                      key={obj}
                      className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded"
                    >
                      {obj}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-medium text-slate-300">
              Recent Activity (Last 5 min)
            </h4>
          </div>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            {showSummary ? 'Hide' : 'Show'} Details
          </button>
        </div>

        {showSummary && (
          <div className="space-y-3">
            {/* Top Tags */}
            {activitySummary.topTags.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Top Tags:</p>
                <div className="flex flex-wrap gap-1">
                  {activitySummary.topTags.slice(0, 8).map(({ tag, count }) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded"
                    >
                      {tag} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {activitySummary.sources.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Active Sources:</p>
                <div className="flex flex-wrap gap-1">
                  {activitySummary.sources.map((source) => (
                    <span
                      key={source}
                      className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Memory Entries */}
        {recentMemory.length > 0 && (
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {recentMemory.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="p-2 bg-slate-800/30 rounded border border-slate-700/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="text-xs text-slate-400">{entry.source}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 truncate">
                  {entry.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-slate-800/30 border-t border-slate-700 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Visual memory retains up to 10 minutes of activity
        </p>
        <button
          onClick={clearVisualMemory}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear Memory
        </button>
      </div>
    </div>
  );
};

export default VisionPipelineMonitor;
