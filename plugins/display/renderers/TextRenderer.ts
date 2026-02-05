import { BaseRenderer } from './BaseRenderer';
import { ContentRequest, RenderResult } from '../types';

export class TextRenderer extends BaseRenderer {
  canRender(content: ContentRequest): boolean {
    return content.type === 'text';
  }

  async render(content: ContentRequest): Promise<RenderResult> {
    try {
      if (!this.canRender(content)) {
        return { success: false, error: 'Invalid content type for TextRenderer' };
      }

      const sanitizedContent = this.sanitizeContent(content.content as string);

      // Create a DOM element for the text content
      const container = document.createElement('div');
      container.className = 'display-text-content';

      const titleEl = document.createElement('h3');
      titleEl.className = 'text-lg font-bold mb-2';
      titleEl.textContent = content.title || 'Text Content';
      container.appendChild(titleEl);

      const contentEl = document.createElement('div');
      contentEl.className = 'whitespace-pre-wrap text-sm';
      contentEl.innerHTML = sanitizedContent;
      container.appendChild(contentEl);

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
        error: `TextRenderer error: ${(error as Error).message}`
      };
    }
  }
}