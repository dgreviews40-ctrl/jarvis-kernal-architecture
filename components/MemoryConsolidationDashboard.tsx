/**
 * Memory Consolidation Dashboard - Kernel v1.4.1
 * 
 * Displays memory consolidation statistics and controls:
 * - Consolidation stats (merged, decayed, duplicates)
 * - Session summaries
 * - Manual consolidation controls
 * - Configuration settings
 */

import React, { useState, useEffect } from 'react';
import { Brain, Merge, Trash2, Clock, Settings, Play, RotateCcw, Save } from 'lucide-react';
import { useMemoryConsolidationStats } from '../stores';
import { memoryConsolidationService } from '../services/memoryConsolidationService';
import { logger } from '../services/logger';

export const MemoryConsolidationDashboard: React.FC = () => {
  const stats = useMemoryConsolidationStats();
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [lastResult, setLastResult] = useState<{
    merged: number;
    decayed: number;
    removed: number;
    duplicates: number;
  } | null>(null);
  const [config, setConfig] = useState(memoryConsolidationService.getConfig());
  const [showSettings, setShowSettings] = useState(false);

  const handleRunConsolidation = async () => {
    setIsConsolidating(true);
    try {
      const result = await memoryConsolidationService.runConsolidation();
      setLastResult(result);
      logger.log('MEMORY', 'Manual consolidation completed', 'success');
    } catch (error) {
      logger.log('MEMORY', `Consolidation failed: ${error.message}`, 'error');
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleUpdateConfig = () => {
    memoryConsolidationService.updateConfig(config);
    logger.log('MEMORY', 'Configuration updated', 'success');
    setShowSettings(false);
  };

  const handleResetStats = () => {
    memoryConsolidationService.resetStats();
    logger.log('MEMORY', 'Statistics reset', 'info');
  };

  return (
    <div className="h-full flex flex-col bg-gray-950 text-cyan-400 font-mono p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-lg font-bold text-cyan-300">Memory Consolidation</h2>
            <p className="text-xs text-cyan-600">Kernel v1.4.1 • Intelligent Memory Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-cyan-900/30 border border-cyan-700/50 rounded hover:bg-cyan-800/40 transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={handleResetStats}
            className="p-2 bg-cyan-900/30 border border-cyan-700/50 rounded hover:bg-cyan-800/40 transition-colors"
            title="Reset Stats"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Brain size={20} />}
          label="Total Memories"
          value={stats.totalMemories}
          color="cyan"
        />
        <StatCard
          icon={<Merge size={20} />}
          label="Merged This Session"
          value={stats.mergedThisSession}
          color="green"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Decayed This Session"
          value={stats.decayedThisSession}
          color="yellow"
        />
        <StatCard
          icon={<Trash2 size={20} />}
          label="Duplicates Removed"
          value={stats.duplicatesRemoved}
          color="red"
        />
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className="mb-6 p-4 bg-cyan-900/20 border border-cyan-700/30 rounded">
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">Last Consolidation Result</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">{lastResult.merged}</div>
              <div className="text-xs text-cyan-600">Merged</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{lastResult.decayed}</div>
              <div className="text-xs text-cyan-600">Decayed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{lastResult.removed}</div>
              <div className="text-xs text-cyan-600">Removed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-400">{lastResult.duplicates}</div>
              <div className="text-xs text-cyan-600">Duplicates</div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {!showSettings && (
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleRunConsolidation}
            disabled={isConsolidating}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-black font-semibold rounded transition-colors"
          >
            <Play size={16} />
            {isConsolidating ? 'Consolidating...' : 'Run Consolidation'}
          </button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-cyan-900/20 border border-cyan-700/30 rounded">
          <h3 className="text-sm font-semibold text-cyan-300 mb-4">Consolidation Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <SettingField
              label="Merge Threshold"
              value={config.mergeThreshold}
              min={0.5}
              max={1}
              step={0.05}
              onChange={(v) => setConfig({ ...config, mergeThreshold: v })}
              description="Similarity required to merge memories"
            />
            <SettingField
              label="Duplicate Threshold"
              value={config.duplicateThreshold}
              min={0.8}
              max={1}
              step={0.05}
              onChange={(v) => setConfig({ ...config, duplicateThreshold: v })}
              description="Similarity to consider as duplicate"
            />
            <SettingField
              label="Decay Start (days)"
              value={config.decayStartDays}
              min={1}
              max={365}
              step={1}
              onChange={(v) => setConfig({ ...config, decayStartDays: v })}
              description="Days before decay begins"
            />
            <SettingField
              label="Decay Rate"
              value={config.decayRate}
              min={0.01}
              max={0.5}
              step={0.01}
              onChange={(v) => setConfig({ ...config, decayRate: v })}
              description="Daily decay rate"
            />
            <SettingField
              label="Min Relevance Score"
              value={config.minRelevanceScore}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setConfig({ ...config, minRelevanceScore: v })}
              description="Minimum score to keep memory"
            />
            <SettingField
              label="Max Memories"
              value={config.maxMemories}
              min={1000}
              max={50000}
              step={1000}
              onChange={(v) => setConfig({ ...config, maxMemories: v })}
              description="Maximum memories before forced consolidation"
            />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.autoConsolidate}
                onChange={(e) => setConfig({ ...config, autoConsolidate: e.target.checked })}
                className="rounded border-cyan-600"
              />
              <span className="text-sm">Auto-consolidate</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleUpdateConfig}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-black font-semibold rounded transition-colors"
            >
              <Save size={16} />
              Save Settings
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-cyan-100 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="mt-auto p-4 bg-cyan-900/10 border border-cyan-800/30 rounded text-sm">
        <h4 className="font-semibold text-cyan-300 mb-2">How it works:</h4>
        <ul className="space-y-1 text-cyan-500 text-xs">
          <li>• <strong>Merge:</strong> Similar memories are combined into one</li>
          <li>• <strong>Decay:</strong> Old, unaccessed memories gradually lose relevance</li>
          <li>• <strong>Deduplication:</strong> Exact or near-exact duplicates are removed</li>
          <li>• <strong>Cross-session:</strong> Session summaries persist across restarts</li>
        </ul>
      </div>
    </div>
  );
};

// Helper Components

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'cyan' | 'green' | 'yellow' | 'red' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    cyan: 'bg-cyan-900/30 border-cyan-700/50 text-cyan-400',
    green: 'bg-green-900/30 border-green-700/50 text-green-400',
    yellow: 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400',
    red: 'bg-red-900/30 border-red-700/50 text-red-400',
    orange: 'bg-orange-900/30 border-orange-700/50 text-orange-400',
  };

  return (
    <div className={`p-4 rounded border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
};

interface SettingFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  description: string;
}

const SettingField: React.FC<SettingFieldProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  description,
}) => (
  <div>
    <label className="block text-xs text-cyan-300 mb-1">{label}</label>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full px-2 py-1 bg-cyan-950 border border-cyan-700 rounded text-cyan-300 text-sm"
    />
    <p className="text-xs text-cyan-600 mt-1">{description}</p>
  </div>
);

export default MemoryConsolidationDashboard;
