import { Plugin, PluginManifest, PluginContext } from '../types';
import { DisplayPluginConfig, ContentRequest } from './types';
import { DEFAULT_DISPLAY_PLUGIN_CONFIG } from './config';
import { DisplayManager } from './DisplayManager';
import { ContentPipeline } from './ContentPipeline';
import { ModelRouter } from './ModelRouter';
import { ModelSelector } from './utils/ModelSelector';
import { ContentValidator } from './utils/ContentValidator';
import { FormatDetector } from './utils/FormatDetector';
import { NotificationService } from './utils/NotificationService';

export class DisplayPlugin implements Plugin {
  public readonly manifest: PluginManifest = {
    id: 'display.core',
    name: 'Display Core',
    version: '1.0.0',
    description: 'Core display functionality for JARVIS',
    author: 'JARVIS Kernel Architect',
    license: 'MIT',
    capabilities: ['display.content', 'display.render', 'model.selection'],
    dependencies: [],
    category: 'core'
  };

  private config: DisplayPluginConfig;
  private displayManager: DisplayManager;
  private contentPipeline: ContentPipeline;
  private modelRouter: ModelRouter;
  private notificationService: NotificationService;
  private container: HTMLElement | null = null;

  constructor(config?: Partial<DisplayPluginConfig>) {
    this.config = { ...DEFAULT_DISPLAY_PLUGIN_CONFIG, ...config };
    this.notificationService = new NotificationService();
    
    const modelSelector = new ModelSelector();
    const contentValidator = new ContentValidator(this.config.maxContentSize);
    const formatDetector = new FormatDetector();
    
    this.displayManager = new DisplayManager();
    this.modelRouter = new ModelRouter(modelSelector, this.notificationService);
    this.contentPipeline = new ContentPipeline(
      contentValidator,
      formatDetector,
      modelSelector,
      this.notificationService
    );
  }

  async initialize(context: PluginContext): Promise<void> {
    // Initialize the display plugin
    console.log('Initializing Display Plugin...');
    
    // Update available models
    await this.modelRouter.updateAvailableModels();
    
    // Set up the display container
    this.container = document.getElementById('jarvis-display-container') || 
                    document.createElement('div');
    this.container.id = 'jarvis-display-container';
    
    // Add CSS classes for styling
    this.container.classList.add('jarvis-display');
    
    // Subscribe to notifications
    this.notificationService.subscribe((message, type) => {
      console.log(`[DisplayPlugin ${type}] ${message}`);
    });
    
    console.log('Display Plugin initialized successfully');
  }

  async executeAction(action: string, params: any): Promise<any> {
    switch (action) {
      case 'DISPLAY_CONTENT':
        return this.displayContent(params.content);
      case 'CLEAR_DISPLAY':
        return this.clearDisplay();
      case 'GET_CURRENT_CONTENT':
        return this.displayManager.getCurrentContent();
      case 'IS_DISPLAYING':
        return this.displayManager.isDisplaying();
      case 'GENERATE_CONTENT':
        return this.generateContent(params.request);
      case 'SHOW_IMAGE':
        return this.showImage(params.src, params.title, params.alt);
      case 'SHOW_SCHEMATIC':
        return this.showSchematic(params.content, params.title, params.description);
      case 'SHOW_WEB_CONTENT':
        return this.showWebContent(params.url, params.title);
      case 'GENERATE_AND_DISPLAY':
        return this.generateAndDisplay(params.prompt, params.type);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async destroy(): Promise<void> {
    this.displayManager.clearDisplay();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    console.log('Display Plugin destroyed');
  }

  private async displayContent(content: ContentRequest): Promise<boolean> {
    try {
      // Process the content through the pipeline
      const { processedContent } = await this.contentPipeline.process(content);

      // Import and use the kernel store to update the display state
      const { useKernelStore } = await import('../../stores');

      // Map content type to display mode and update the store
      switch (processedContent.type) {
        case 'svg':
        case 'diagram':
          useKernelStore.getState().setDisplayMode('SCHEMATIC');
          useKernelStore.getState().setDisplayContent({
            schematic: {
              svgContent: processedContent.content as string,
              title: processedContent.title || 'Diagram',
              description: processedContent.description || 'Generated diagram'
            }
          });
          break;

        case 'image':
          useKernelStore.getState().setDisplayMode('IMAGE');
          useKernelStore.getState().setDisplayContent({
            image: {
              src: processedContent.content as string,
              title: processedContent.title || 'Image',
              description: processedContent.description || 'Generated image',
              fit: 'contain'
            }
          });
          break;

        case 'pdf':
          useKernelStore.getState().setDisplayMode('WEB');
          useKernelStore.getState().setDisplayContent({
            web: {
              url: processedContent.content as string,
              title: processedContent.title || 'PDF Document',
              description: processedContent.description || 'Generated PDF'
            }
          });
          break;

        case 'web':
          useKernelStore.getState().setDisplayMode('WEB');
          useKernelStore.getState().setDisplayContent({
            web: {
              url: processedContent.content as string,
              title: processedContent.title || 'Web Content',
              description: processedContent.description || 'Generated web content'
            }
          });
          break;

        case 'interactive':
          useKernelStore.getState().setDisplayMode('CUSTOM');
          useKernelStore.getState().setDisplayContent({
            custom: {
              component: processedContent.content,
              title: processedContent.title || 'Interactive Content',
              description: processedContent.description || 'Generated interactive content'
            }
          });
          break;

        case 'text':
        default:
          useKernelStore.getState().setDisplayMode('SCHEMATIC');
          useKernelStore.getState().setDisplayContent({
            schematic: {
              svgContent: `<div><h3>${processedContent.title || 'Text Content'}</h3><p>${processedContent.content}</p></div>`,
              title: processedContent.title || 'Text Content',
              description: processedContent.description || 'Generated text content'
            }
          });
          break;
      }

      return true;
    } catch (error) {
      console.error('Error displaying content:', error);
      throw error;
    }
  }

  private clearDisplay(): boolean {
    try {
      this.displayManager.clearDisplay();
      return true;
    } catch (error) {
      console.error('Error clearing display:', error);
      return false;
    }
  }

  private async generateContent(request: { prompt: string; type?: string }): Promise<any> {
    try {
      // Determine content type based on the request
      const contentType = request.type || 'text';

      // For SVG/diagram generation, we need to ask the model to generate SVG code
      let adjustedPrompt = request.prompt;
      if (contentType === 'svg' || contentType === 'diagram') {
        adjustedPrompt = `Generate SVG code for: ${request.prompt}. Use cyan (#06b6d4) as the primary color to match the JARVIS theme. Include appropriate labels and structure. Return only the SVG code without any additional text or explanation.`;
      } else if (contentType === 'image') {
        adjustedPrompt = `Describe an image that represents: ${request.prompt}. Describe it in detail with focus on visual elements, composition, and colors that match the JARVIS theme (cyans, dark backgrounds).`;
      } else if (contentType === 'web' || contentType === 'documentation') {
        adjustedPrompt = `Generate HTML/CSS content for: ${request.prompt}. Use a dark theme with cyan accents (#06b6d4) to match the JARVIS interface. Include proper structure and formatting.`;
      }

      // Route the request through the model router
      const response = await this.modelRouter.routeRequest(adjustedPrompt);

      // Return the generated content
      return {
        content: response.text,
        type: contentType,
        title: `Generated ${contentType}`,
        description: `Content generated based on request: ${request.prompt}`
      };
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }

  // Public API methods
  async setContent(content: ContentRequest): Promise<boolean> {
    return this.displayContent(content);
  }

  async generateAndDisplay(prompt: string, type?: string): Promise<boolean> {
    const content = await this.generateContent({ prompt, type });
    return this.displayContent(content);
  }

  getCurrentContent(): ContentRequest | null {
    return this.displayManager.getCurrentContent();
  }

  isDisplayActive(): boolean {
    return this.displayManager.isDisplaying();
  }

  clear(): boolean {
    return this.clearDisplay();
  }

  // Helper methods for different content types
  async showImage(src: string, title?: string, alt?: string): Promise<boolean> {
    const content: ContentRequest = {
      type: 'image',
      content: src,
      title: title || 'Image',
      description: alt || 'Generated image'
    };
    return this.displayContent(content);
  }

  async showSchematic(content: string, title?: string, description?: string): Promise<boolean> {
    const schematicContent: ContentRequest = {
      type: 'svg',
      content: content,
      title: title || 'Schematic',
      description: description || 'Generated schematic'
    };
    return this.displayContent(schematicContent);
  }

  async showWebContent(url: string, title?: string): Promise<boolean> {
    const webContent: ContentRequest = {
      type: 'web',
      content: url,
      title: title || 'Web Content',
      description: 'Generated web content'
    };
    return this.displayContent(webContent);
  }
}