import { BaseRenderer } from './BaseRenderer';
import { ContentRequest, RenderResult } from '../types';

export class SvgRenderer extends BaseRenderer {
  canRender(content: ContentRequest): boolean {
    return content.type === 'svg' || content.type === 'diagram';
  }

  async render(content: ContentRequest): Promise<RenderResult> {
    try {
      if (!this.canRender(content)) {
        return { success: false, error: 'Invalid content type for SvgRenderer' };
      }

      const sanitizedContent = this.sanitizeContent(content.content as string);
      
      // Create a DOM element for the SVG content
      const container = document.createElement('div');
      container.className = 'display-svg-content flex items-center justify-center';
      
      // Create a div to hold the SVG
      const svgContainer = document.createElement('div');
      svgContainer.className = 'svg-container';
      svgContainer.innerHTML = sanitizedContent;
      
      container.appendChild(svgContainer);
      
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
        error: `SvgRenderer error: ${(error as Error).message}` 
      };
    }
  }
}