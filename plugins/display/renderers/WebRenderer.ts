import { BaseRenderer } from './BaseRenderer';
import { ContentRequest, RenderResult } from '../types';

export class WebRenderer extends BaseRenderer {
  canRender(content: ContentRequest): boolean {
    return content.type === 'web';
  }

  async render(content: ContentRequest): Promise<RenderResult> {
    try {
      if (!this.canRender(content)) {
        return { success: false, error: 'Invalid content type for WebRenderer' };
      }

      // Create a DOM element for the web content
      const container = document.createElement('div');
      container.className = 'display-web-content';
      
      // Create an iframe for the web content with security sandboxing
      const iframe = document.createElement('iframe');
      iframe.className = 'w-full h-full border-0';
      iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms';
      
      // Validate and set the source
      if (typeof content.content === 'string') {
        try {
          // Validate URL
          const url = new URL(content.content);
          iframe.src = url.href;
        } catch (e) {
          return { success: false, error: 'Invalid URL for web content' };
        }
      } else {
        return { success: false, error: 'Web content must be a URL string' };
      }
      
      container.appendChild(iframe);
      
      if (content.title) {
        const titleEl = document.createElement('h3');
        titleEl.className = 'text-lg font-bold mb-2';
        titleEl.textContent = content.title;
        container.appendChild(titleEl);
      }
      
      if (content.description) {
        const descEl = document.createElement('div');
        descEl.className = 'text-xs text-cyan-700 mt-2';
        descEl.textContent = content.description;
        container.appendChild(descEl);
      }

      return { 
        success: true, 
        element: container 
      };
    } catch (error) {
      return { 
        success: false, 
        error: `WebRenderer error: ${(error as Error).message}` 
      };
    }
  }
}