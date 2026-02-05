import { ContentRequest } from '../types';

export class ContentValidator {
  private maxSize: number;
  
  constructor(maxSize: number = 10 * 1024 * 1024) { // 10MB default
    this.maxSize = maxSize;
  }
  
  validate(content: ContentRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check content size if it's a string
    if (typeof content.content === 'string') {
      const size = new Blob([content.content]).size;
      if (size > this.maxSize) {
        errors.push(`Content size (${size} bytes) exceeds maximum allowed size (${this.maxSize} bytes)`);
      }
    } 
    // Check content size if it's an ArrayBuffer
    else if (content.content instanceof ArrayBuffer) {
      if (content.content.byteLength > this.maxSize) {
        errors.push(`Content size (${content.content.byteLength} bytes) exceeds maximum allowed size (${this.maxSize} bytes)`);
      }
    }
    
    // Check for potentially dangerous content
    if (typeof content.content === 'string') {
      if (this.containsDangerousContent(content.content)) {
        errors.push('Content contains potentially dangerous elements (scripts, etc.)');
      }
    }
    
    // Validate content type
    const validTypes = ['text', 'image', 'svg', 'pdf', 'diagram', 'interactive', 'web'];
    if (!validTypes.includes(content.type)) {
      errors.push(`Invalid content type: ${content.type}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private containsDangerousContent(content: string): boolean {
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+="[^"]*"/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(content));
  }
  
  sanitize(content: string): string {
    // Remove dangerous elements
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/<iframe/gi, '&lt;iframe')
      .replace(/<object/gi, '&lt;object')
      .replace(/<embed/gi, '&lt;embed');
  }
}