/**
 * UI Plugin Template
 * 
 * A React-based UI panel plugin.
 * Use this template for plugins that need a visual interface in JARVIS.
 */

import React, { useState, useEffect } from 'react';
import { 
  PluginProvider,
  usePluginContext,
  usePluginMemory,
  usePluginConfig,
  useNotification,
} from '@jarvis/sdk/react';

// Main panel component wrapped with provider
export default function Panel() {
  // The plugin context is provided by JARVIS when loading the UI
  const context = (window as any).__JARVIS_PLUGIN_CONTEXT__;
  
  if (!context) {
    return <div>Loading...</div>;
  }
  
  return (
    <PluginProvider value={context}>
      <PluginPanel />
    </PluginProvider>
  );
}

// The actual panel content
function PluginPanel() {
  const ctx = usePluginContext();
  const { recall, store, isLoading } = usePluginMemory();
  const [theme] = usePluginConfig('theme', 'dark');
  const notify = useNotification();
  
  const [memories, setMemories] = useState<Array<{ id: string; content: string; tags: string[] }>>([]);
  const [newNote, setNewNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load recent memories on mount
  useEffect(() => {
    loadMemories();
  }, []);
  
  async function loadMemories() {
    const results = await recall(searchQuery || 'recent', 10);
    setMemories(results.map(r => ({
      id: r.id,
      content: r.content,
      tags: r.tags,
    })));
  }
  
  async function handleSave() {
    if (!newNote.trim()) return;
    
    await store(newNote, ['note', 'ui']);
    notify('Note Saved', 'Your note has been stored in memory');
    setNewNote('');
    loadMemories();
  }
  
  async function handleSearch() {
    loadMemories();
  }
  
  const isDark = theme === 'dark';
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
      color: isDark ? '#e0e0e0' : '#333333',
      minHeight: '100%',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ 
        margin: '0 0 20px 0',
        fontSize: '24px',
        color: '#06b6d4',
      }}>
        {ctx.id}
      </h1>
      
      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories..."
          style={{
            width: '70%',
            padding: '10px',
            backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
            color: isDark ? '#e0e0e0' : '#333',
            border: `1px solid ${isDark ? '#333' : '#ccc'}`,
            borderRadius: '4px',
            marginRight: '10px',
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '10px 20px',
            backgroundColor: '#06b6d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </div>
      
      {/* Add new note */}
      <div style={{ marginBottom: '20px' }}>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a new note..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
            color: isDark ? '#e0e0e0' : '#333',
            border: `1px solid ${isDark ? '#333' : '#ccc'}`,
            borderRadius: '4px',
            marginBottom: '10px',
            resize: 'vertical',
          }}
        />
        <button
          onClick={handleSave}
          disabled={isLoading || !newNote.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: newNote.trim() ? '#10b981' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: newNote.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Save Note
        </button>
      </div>
      
      {/* Memories list */}
      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>
          Memories ({memories.length})
        </h2>
        
        {isLoading ? (
          <p>Loading...</p>
        ) : memories.length === 0 ? (
          <p style={{ color: isDark ? '#666' : '#999' }}>
            No memories found. Create your first note above!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {memories.map((memory) => (
              <div
                key={memory.id}
                style={{
                  padding: '15px',
                  backgroundColor: isDark ? '#111' : '#f5f5f5',
                  borderRadius: '4px',
                  border: `1px solid ${isDark ? '#222' : '#e0e0e0'}`,
                }}
              >
                <p style={{ margin: '0 0 8px 0' }}>{memory.content}</p>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {memory.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        backgroundColor: '#06b6d420',
                        color: '#06b6d4',
                        borderRadius: '10px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
