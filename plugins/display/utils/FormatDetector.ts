export class FormatDetector {
  detectFormat(content: string | ArrayBuffer): string {
    if (typeof content === 'string') {
      // Check for SVG
      if (content.includes('<svg') && content.includes('</svg>')) {
        return 'svg';
      }
      
      // Check for HTML
      if (content.includes('<html') || content.includes('<body') || content.includes('<div')) {
        return 'html';
      }
      
      // Check for JSON
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
          JSON.parse(content);
          return 'json';
        } catch (e) {
          // Not valid JSON
        }
      }
      
      // Check for URLs
      try {
        new URL(content.trim());
        return 'url';
      } catch (e) {
        // Not a valid URL
      }
      
      // Default to text
      return 'text';
    } else if (content instanceof ArrayBuffer) {
      // Check file signature (magic numbers) for binary formats
      const arr = new Uint8Array(content);
      if (arr.length < 4) return 'unknown';
      
      // PNG signature
      if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
        return 'png';
      }
      
      // JPEG signature
      if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
        return 'jpeg';
      }
      
      // PDF signature
      if (arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46) {
        return 'pdf';
      }
      
      // GIF signature
      if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) {
        return 'gif';
      }
      
      return 'binary';
    }
    
    return 'unknown';
  }
  
  detectContentType(description: string): 'text' | 'image' | 'svg' | 'pdf' | 'diagram' | 'interactive' | 'web' {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('image') || lowerDesc.includes('photo') || lowerDesc.includes('picture')) {
      return 'image';
    }
    
    if (lowerDesc.includes('svg') || lowerDesc.includes('vector') || lowerDesc.includes('graphic')) {
      return 'svg';
    }
    
    if (lowerDesc.includes('pdf') || lowerDesc.includes('document') || lowerDesc.includes('file')) {
      return 'pdf';
    }
    
    if (lowerDesc.includes('diagram') || lowerDesc.includes('schematic') || 
        lowerDesc.includes('flowchart') || lowerDesc.includes('chart') || 
        lowerDesc.includes('graph') || lowerDesc.includes('map')) {
      return 'diagram';
    }
    
    if (lowerDesc.includes('interactive') || lowerDesc.includes('recommendation') || 
        lowerDesc.includes('product') || lowerDesc.includes('tutorial') || 
        lowerDesc.includes('guide') || lowerDesc.includes('form')) {
      return 'interactive';
    }
    
    if (lowerDesc.includes('website') || lowerDesc.includes('web') || 
        lowerDesc.includes('page') || lowerDesc.includes('url') || 
        lowerDesc.includes('link')) {
      return 'web';
    }
    
    // Default to text
    return 'text';
  }
}