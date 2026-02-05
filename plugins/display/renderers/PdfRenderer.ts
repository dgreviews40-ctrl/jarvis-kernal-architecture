import { BaseRenderer } from './BaseRenderer';
import { ContentRequest, RenderResult } from '../types';

export class PdfRenderer extends BaseRenderer {
  canRender(content: ContentRequest): boolean {
    return content.type === 'pdf';
  }

  async render(content: ContentRequest): Promise<RenderResult> {
    try {
      if (!this.canRender(content)) {
        return { success: false, error: 'Invalid content type for PdfRenderer' };
      }

      // Create a DOM element for the PDF content
      const container = document.createElement('div');
      container.className = 'display-pdf-content flex flex-col items-center justify-center';
      
      // Create an iframe for the PDF
      const iframe = document.createElement('iframe');
      iframe.className = 'w-full h-full border-0';
      
      // Handle different content types (URL string or data URL)
      if (typeof content.content === 'string') {
        iframe.src = content.content;
      } else if (content.content instanceof ArrayBuffer) {
        const blob = new Blob([content.content], { type: 'application/pdf' });
        iframe.src = URL.createObjectURL(blob);
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
        error: `PdfRenderer error: ${(error as Error).message}` 
      };
    }
  }
}