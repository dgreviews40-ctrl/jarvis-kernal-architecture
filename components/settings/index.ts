/**
 * Settings Components
 * 
 * This module exports all settings-related components.
 * Tabs are split into separate files for better maintainability.
 */

// Types
export type { SettingsTab } from './types';
export type {
  GeneralTabProps,
  AITabProps,
  DevicesTabProps,
  PluginsTabProps,
  ArchiveTabProps,
  DistributionTabProps,
  SecurityTabProps,
  BackupTabProps,
} from './types';

// Tab Components
export { GeneralTab } from './GeneralTab';

// Note: Additional tabs will be extracted here in future refactoring
// - AITab
// - DevicesTab
// - PluginsTab
// - ArchiveTab
// - DistributionTab
// - SecurityTab
// - BackupTab
