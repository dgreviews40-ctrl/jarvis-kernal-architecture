import { DisplayPluginConfig } from './types';

export const DEFAULT_DISPLAY_PLUGIN_CONFIG: DisplayPluginConfig = {
  defaultModel: 'llama3',
  visionModel: 'llava',
  textModel: 'llama3',
  maxContentSize: 10 * 1024 * 1024, // 10MB
  enableCaching: true,
  supportedFormats: [
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/json',
    'text/html'
  ]
};