# Settings Backup & Restore

## Overview

Export and import all JARVIS settings for backup, migration, or sharing between devices.

## Features

### Export Options

- **Settings**: UI preferences, AI config, log settings, plugin selections
- **API Keys**: Optional, encrypted if export is password-protected
- **Memory Data**: All stored memories
- **Logs**: Recent log entries
- **Encryption**: Password-protect exports with AES-GCM

### Import Options

- **Merge**: Combine with existing settings
- **Replace**: Clear existing settings first
- **Password**: Decrypt encrypted exports

## Access

Go to **Settings > BACKUP & RESTORE**

## Usage

### Export Settings

1. Select what to include:
   - ☑️ API keys
   - ☑️ Memory data
   - ☑️ Recent logs
   - ☑️ Encrypt with password (recommended)

2. Click **Export Settings**

3. File downloads automatically:
   - `.json` for unencrypted
   - `.jarvis` for encrypted

### Import Settings

1. Click **Choose File** and select backup

2. Choose import mode:
   - **Merge**: Keep existing, add from backup
   - **Replace**: Clear all, restore from backup

3. Enter password if file is encrypted

4. Click **Import Settings**

## File Format

```json
{
  "version": 1,
  "exportedAt": "2026-01-30T12:00:00Z",
  "appVersion": "1.0.0",
  "settings": {
    "jarvis-ui-store": { ... },
    "jarvis-kernel-store": { ... },
    ...
  },
  "apiKeys": {
    "gemini": "...",
    "ollama": "..."
  },
  "memory": [...],
  "logs": [...],
  "metadata": {
    "exportedBy": "JARVIS User",
    "system": "Win32",
    "userAgent": "..."
  }
}
```

## Security

- **Unencrypted exports**: Store API keys in plain text (not recommended)
- **Encrypted exports**: AES-GCM encryption with password-derived key
- **Password requirements**: Minimum 8 characters

## Migration Guide

### To New Device

1. On old device: Export with API keys, encrypt with password
2. Transfer file securely
3. On new device: Import file, enter password
4. Verify settings restored

### Backup Strategy

- **Daily**: Export settings only (small, quick)
- **Weekly**: Export with memory (complete backup)
- **Before updates**: Full export with everything

## API

```typescript
import { settingsManager } from './services/settingsManager';

// Export
const result = await settingsManager.exportSettings({
  includeApiKeys: true,
  includeMemory: false,
  includeLogs: false,
  password: 'my-secure-password' // Optional
});

if (result.success) {
  settingsManager.downloadExport(result.blob!, 'my-backup.jarvis');
}

// Import
const result = await settingsManager.importSettings(file, {
  merge: false, // Replace existing
  password: 'my-secure-password' // If encrypted
});

if (result.success) {
  console.log(`Imported ${result.imported.settings.length} settings`);
}

// Validate
const validation = await settingsManager.validateExport(file);
if (validation.valid) {
  console.log(`Export from ${validation.exportedAt}`);
}

// Get summary
const summary = settingsManager.getSettingsSummary();
console.log(`${summary.settings.length} settings, ${summary.totalSize} bytes`);
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Import fails | Check file isn't corrupted, try password again |
| Wrong password | Cannot recover encrypted export without password |
| Version mismatch | Update JARVIS to latest version |
| Settings not restored | Check "Replace" was selected, refresh page |

## File Structure

```
services/
  settingsManager.ts    # Core export/import logic
  
components/
  SettingsBackup.tsx    # UI component
  SettingsInterface.tsx # Integration (BACKUP tab)
```
