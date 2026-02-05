import { BaseRenderer } from './BaseRenderer';
import { ContentRequest, RenderResult } from '../types';

export class ImageRenderer extends BaseRenderer {
  canRender(content: ContentRequest): boolean {
    return content.type === 'image';
  }

  async render(content: ContentRequest): Promise<RenderResult> {
    try {
      if (!this.canRender(content)) {
        return { success: false, error: 'Invalid content type for ImageRenderer' };
      }

      // Create a DOM element for the image content
      const container = document.createElement('div');
      container.className = 'display-image-content flex items-center justify-center';
      
      const img = document.createElement('img');
      img.className = 'max-w-full max-h-full object-contain';
      
      // Handle different content types (URL string or data URL)
      if (typeof content.content === 'string') {
        img.src = content.content;
      } else if (content.content instanceof ArrayBuffer) {
        const blob = new Blob([content.content], { type: 'image/*' });
        img.src = URL.createObjectURL(blob);
      }
      
      img.alt = content.title || 'Image Content';
      
      container.appendChild(img);
      
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
        error: `ImageRenderer error: ${(error as Error).message}` 
      };
    }
  }
}