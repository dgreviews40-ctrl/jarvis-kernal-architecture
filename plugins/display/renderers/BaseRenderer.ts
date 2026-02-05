import { ContentRequest, RenderResult } from './types';

export abstract class BaseRenderer {
  abstract canRender(content: ContentRequest): boolean;
  abstract render(content: ContentRequest): Promise<RenderResult>;
  
  protected sanitizeContent(content: string): string {
    // Basic sanitization to prevent XSS
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');
  }
  
  protected validateContentType(content: ContentRequest, allowedTypes: string[]): boolean {
    return allowedTypes.includes(content.type);
  }
}