/**
 * Conversation History Component for JARVIS AI Engine v1.1
 * 
 * Displays persistent conversation history with:
 * - List of all conversations
 * - Search through history
 * - Resume previous conversations
 * - Export/import functionality
 */

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  MessageSquare, 
  Calendar, 
  Trash2, 
  Download, 
  Upload,
  X,
  ChevronRight,
  Tag,
  Clock,
  Mic,
  Type
} from 'lucide-react';
import { conversationPersistence, PersistedConversation } from '../services/conversationPersistence';
import { logger } from '../services/logger';

interface ConversationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  isOpen,
  onClose,
  onSelectConversation
}) => {
  const [conversations, setConversations] = useState<PersistedConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, messages: 0, size: '0 KB' });

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = () => {
    const all = conversationPersistence.getAllConversations();
    setConversations(all);
    
    const s = conversationPersistence.getStats();
    setStats({
      total: s.totalConversations,
      messages: s.totalMessages,
      size: `${(s.storageSizeBytes / 1024).toFixed(1)} KB`
    });
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      loadConversations();
      return;
    }

    const results = conversationPersistence.search(searchQuery);
    setConversations(results.map(r => r.conversation));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Use a safer delete without native confirm for better UX
    // In production, this would use a custom modal
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Delete this conversation?')) {
        conversationPersistence.deleteConversation(id);
        loadConversations();
        logger.log('CONVERSATION', `Deleted conversation ${id}`, 'info');
      }
    } else {
      // Fallback: delete without confirmation in SSR/embedded contexts
      conversationPersistence.deleteConversation(id);
      loadConversations();
      logger.log('CONVERSATION', `Deleted conversation ${id}`, 'info');
    }
  };

  const handleExport = () => {
    const data = conversationPersistence.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-conversations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logger.log('CONVERSATION', 'Exported all conversations', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const imported = conversationPersistence.import(data);
        loadConversations();
        alert(`Imported ${imported} conversations`);
        logger.log('CONVERSATION', `Imported ${imported} conversations`, 'success');
      } catch (err) {
        alert('Failed to import: Invalid file format');
        logger.log('CONVERSATION', 'Import failed: Invalid format', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectConversation(id);
    onClose();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getPreviewText = (conv: PersistedConversation) => {
    const lastTurn = conv.turns[conv.turns.length - 1];
    if (!lastTurn) return 'No messages';
    
    const text = lastTurn.text;
    return text.length > 60 ? text.slice(0, 60) + '...' : text;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-cyan-900/30 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950/40 rounded border border-cyan-800/50">
              <History size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Conversation History</h2>
              <div className="text-[10px] text-cyan-700 font-mono">
                {stats.total} conversations • {stats.messages} messages • {stats.size}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-cyan-950/30 rounded text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Actions */}
        <div className="p-4 border-b border-cyan-900/20 flex gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search conversations..."
              className="w-full bg-black border border-cyan-900/30 rounded pl-9 pr-3 py-2 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-cyan-950/30 border border-cyan-800/50 rounded text-xs text-cyan-400 hover:bg-cyan-950/50 transition-colors"
          >
            Search
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-green-950/30 border border-green-800/50 rounded text-xs text-green-400 hover:bg-green-950/50 transition-colors flex items-center gap-2"
          >
            <Download size={12} /> Export
          </button>
          <label className="px-3 py-2 bg-indigo-950/30 border border-indigo-800/50 rounded text-xs text-indigo-400 hover:bg-indigo-950/50 transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={12} /> Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No conversations found</p>
              <p className="text-xs mt-1">Start chatting to create conversations</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={`p-3 rounded border cursor-pointer transition-all group ${
                  selectedId === conv.id
                    ? 'bg-cyan-950/30 border-cyan-500/50'
                    : 'bg-black/40 border-transparent hover:border-cyan-900/30 hover:bg-cyan-950/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {conv.metadata.origin === 'voice' ? (
                        <Mic size={10} className="text-green-500" />
                      ) : (
                        <Type size={10} className="text-cyan-500" />
                      )}
                      <span className="text-xs font-medium text-white truncate">
                        {conv.title}
                      </span>
                      {conv.tags.length > 0 && (
                        <span className="flex items-center gap-1 text-[9px] text-indigo-400">
                          <Tag size={8} />
                          {conv.tags.length}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">
                      {getPreviewText(conv)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] text-gray-600 flex items-center gap-1">
                      <Calendar size={8} />
                      {formatDate(conv.updatedAt)}
                    </span>
                    <span className="text-[9px] text-gray-600 flex items-center gap-1">
                      <MessageSquare size={8} />
                      {conv.messageCount}
                    </span>
                  </div>
                </div>
                
                {/* Tags */}
                {conv.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {conv.tags.slice(0, 3).map((tag, i) => (
                      <span 
                        key={i}
                        className="text-[8px] px-1.5 py-0.5 bg-cyan-950/30 border border-cyan-900/30 rounded text-cyan-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Delete button - visible on hover */}
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="absolute top-2 right-2 p-1.5 bg-red-950/50 border border-red-900/50 rounded text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-cyan-900/20 flex justify-between items-center text-[10px] text-gray-600">
          <span>Conversations are stored locally in your browser</span>
          <button
            onClick={() => {
              const confirmed = typeof window !== 'undefined' && window.confirm 
                ? window.confirm('Clear all conversation history? This cannot be undone.')
                : true; // In SSR, proceed without confirmation
              if (confirmed) {
                conversationPersistence.clearAll();
                loadConversations();
              }
            }}
            className="text-red-500 hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationHistory;
