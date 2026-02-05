import { ContentRequest, RenderResult } from './types';
import { BaseRenderer } from './renderers/BaseRenderer';
import { TextRenderer } from './renderers/TextRenderer';
import { ImageRenderer } from './renderers/ImageRenderer';
import { SvgRenderer } from './renderers/SvgRenderer';
import { PdfRenderer } from './renderers/PdfRenderer';
import { InteractiveRenderer } from './renderers/InteractiveRenderer';
import { WebRenderer } from './renderers/WebRenderer';

export class DisplayManager {
  private renderers: BaseRenderer[];
  private currentContent: ContentRequest | null = null;
  private currentElement: HTMLElement | null = null;
  
  constructor() {
    this.renderers = [
      new TextRenderer(),
      new ImageRenderer(),
      new SvgRenderer(),
      new PdfRenderer(),
      new InteractiveRenderer(),
      new WebRenderer()
    ];
  }
  
  async displayContent(content: ContentRequest, container: HTMLElement): Promise<RenderResult> {
    try {
      // Find appropriate renderer
      const renderer = this.renderers.find(r => r.canRender(content));
      
      if (!renderer) {
        return {
          success: false,
          error: `No suitable renderer found for content type: ${content.type}`
        };
      }
      
      // Clear previous content
      this.clearDisplay();
      
      // Render the content
      const result = await renderer.render(content);
      
      if (result.success && result.element) {
        // Store current content and element
        this.currentContent = content;
        if (result.element instanceof HTMLElement) {
          this.currentElement = result.element;
          container.appendChild(this.currentElement);
        } else {
          // If it's a React element, we'll need to render it differently
          // For now, we'll just store the content
          this.currentElement = null;
        }
        
        return result;
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        error: `DisplayManager error: ${(error as Error).message}`
      };
    }
  }
  
  clearDisplay(): void {
    if (this.currentElement && this.currentElement.parentNode) {
      this.currentElement.parentNode.removeChild(this.currentElement);
    }
    this.currentContent = null;
    this.currentElement = null;
  }
  
  getCurrentContent(): ContentRequest | null {
    return this.currentContent;
  }
  
  isDisplaying(): boolean {
    return this.currentContent !== null;
  }
}