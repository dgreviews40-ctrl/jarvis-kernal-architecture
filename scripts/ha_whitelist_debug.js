/**
 * Home Assistant Whitelist Debug Script
 * Run this in browser console to diagnose whitelist persistence issues
 */

(function debugWhitelist() {
  const STORAGE_KEY = 'jarvis_ha_entity_whitelist';
  
  console.log('=== HA Whitelist Debug ===');
  
  // 1. Check if data exists in localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  console.log('Raw localStorage data:', stored);
  
  if (stored) {
    try {
      const state = JSON.parse(stored);
      console.log('Parsed state:', state);
      console.log('Mode:', state.mode);
      console.log('Entity count:', state.entities?.length || 0);
      console.log('Enabled entities:', state.entities?.filter(e => e.enabled).length || 0);
      console.log('Last updated:', state.lastUpdated);
      
      // Show some sample entities
      if (state.entities?.length > 0) {
        console.log('Sample entities (first 5):', state.entities.slice(0, 5));
      }
    } catch (e) {
      console.error('Failed to parse whitelist:', e);
    }
  } else {
    console.warn('No whitelist data found in localStorage!');
  }
  
  // 2. Check all jarvis-* keys in localStorage
  console.log('\n=== All jarvis-* localStorage keys ===');
  const jarvisKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('jarvis')) {
      const size = new Blob([localStorage.getItem(key) || '']).size;
      jarvisKeys.push({ key, size: `${(size/1024).toFixed(2)} KB` });
    }
  }
  console.table(jarvisKeys);
  
  // 3. Check storage version
  const version = localStorage.getItem('jarvis-store-version');
  console.log('\nStorage version:', version);
  
  // 4. Helper to export whitelist for backup
  window.exportWhitelist = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whitelist-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('Whitelist exported!');
    }
  };
  
  // 5. Helper to import whitelist
  window.importWhitelist = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.entities && data.mode) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('Whitelist imported! Refresh the page to see changes.');
      } else {
        console.error('Invalid whitelist format');
      }
    } catch (e) {
      console.error('Failed to import:', e);
    }
  };
  
  console.log('\n=== Helper Functions ===');
  console.log('exportWhitelist() - Download whitelist as JSON file');
  console.log('importWhitelist(file) - Import whitelist from JSON file');
  
})();
