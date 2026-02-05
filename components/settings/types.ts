/**
 * Settings Tab Component Types
 */

import { AIConfig, VoiceConfig, OllamaConfig, RuntimePlugin } from '../../types';

export type SettingsTab = 'GENERAL' | 'AI' | 'DEVICES' | 'PLUGINS' | 'ARCHIVE' | 'DISTRIBUTION' | 'DOCS' | 'SECURITY' | 'BACKUP';

export interface GeneralTabProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

export interface AITabProps {
  aiConfig: AIConfig;
  setAiConfig: (config: AIConfig) => void;
  ollamaConfig: OllamaConfig;
  setOllamaConfig: (config: OllamaConfig) => void;
  voiceConfig: VoiceConfig;
  setVoiceConfig: (config: VoiceConfig) => void;
  geminiStats: {
    used: number;
    remaining: number;
    limit: number;
    perMinuteUsed: number;
    perMinuteRemaining: number;
    isRateLimited: boolean;
  };
}

export interface DevicesTabProps {
  cameras: MediaDeviceInfo[];
  selectedCam: string;
  setSelectedCam: (id: string) => void;
  systemVoices: SpeechSynthesisVoice[];
  voiceConfig: VoiceConfig;
  setVoiceConfig: (config: VoiceConfig) => void;
}

export interface PluginsTabProps {
  plugins: RuntimePlugin[];
}

export interface ArchiveTabProps {
  exportDest: 'LOCAL' | 'NETWORK';
  setExportDest: (dest: 'LOCAL' | 'NETWORK') => void;
  networkPath: string;
  setNetworkPath: (path: string) => void;
  isExporting: boolean;
  setIsExporting: (v: boolean) => void;
  isRestoring: boolean;
  setIsRestoring: (v: boolean) => void;
  onExport: () => void;
  onRestore: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export interface DistributionTabProps {
  installPrompt: any;
  targetUrl: string;
  setTargetUrl: (url: string) => void;
  hostingMode: 'CLOUD' | 'LOCAL';
  urlWarning: boolean;
  onCreateLauncher: () => void;
}

export interface SecurityTabProps {
  encryptionEnabled: boolean;
  setShowEncryptionSetup: (show: boolean) => void;
}

export interface BackupTabProps {
  // Backup specific props if needed
}
