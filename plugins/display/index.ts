import { DisplayPlugin } from './DisplayPlugin';
import { DisplayPluginConfig } from './types';

// Export the main plugin class
export { DisplayPlugin };

// Export types
export type { DisplayPluginConfig };

// Export the plugin factory function
export const createDisplayPlugin = (config?: Partial<DisplayPluginConfig>): DisplayPlugin => {
  return new DisplayPlugin(config);
};

// Export individual components for advanced usage
export { DisplayManager } from './DisplayManager';
export { ContentPipeline } from './ContentPipeline';
export { ModelRouter } from './ModelRouter';

// Export renderers
export { BaseRenderer } from './renderers/BaseRenderer';
export { TextRenderer } from './renderers/TextRenderer';
export { ImageRenderer } from './renderers/ImageRenderer';
export { SvgRenderer } from './renderers/SvgRenderer';
export { PdfRenderer } from './renderers/PdfRenderer';
export { InteractiveRenderer } from './renderers/InteractiveRenderer';
export { WebRenderer } from './renderers/WebRenderer';

// Export utilities
export { ModelSelector } from './utils/ModelSelector';
export { ContentValidator } from './utils/ContentValidator';
export { FormatDetector } from './utils/FormatDetector';
export { NotificationService } from './utils/NotificationService';