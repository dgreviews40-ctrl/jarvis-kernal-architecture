import { logger } from './logger';
import { providerManager } from './providers';
import { AIProvider } from '../types';

export type FileFormat = 'png' | 'jpeg' | 'svg' | 'pdf' | 'txt' | 'md';

export interface GeneratedFile {
  content: string | Blob;
  format: FileFormat;
  mimeType: string;
  filename: string;
  dataUrl?: string;
  downloadUrl?: string;
}

/**
 * Service for generating various file types using AI models
 * - Images: PNG/JPEG via Gemini native image generation, SVG via AI-generated code
 * - Documents: PDF, TXT, MD (via text generation)
 */
export class FileGeneratorService {
  private static instance: FileGeneratorService;
  private generationCache: Map<string, GeneratedFile> = new Map();

  public static getInstance(): FileGeneratorService {
    if (!FileGeneratorService.instance) {
      FileGeneratorService.instance = new FileGeneratorService();
    }
    return FileGeneratorService.instance;
  }

  /**
   * Generate a file based on the prompt and desired format
   */
  async generateFile(
    prompt: string, 
    format: FileFormat,
    options?: {
      width?: number;
      height?: number;
      style?: 'realistic' | 'artistic' | 'diagram' | 'schematic';
    }
  ): Promise<GeneratedFile> {
    logger.log('FILE_GENERATOR', `Generating ${format} for: "${prompt}"`, 'info');

    // Check cache for identical requests
    const cacheKey = `${prompt}-${format}-${JSON.stringify(options)}`;
    if (this.generationCache.has(cacheKey)) {
      logger.log('FILE_GENERATOR', 'Returning cached result', 'info');
      return this.generationCache.get(cacheKey)!;
    }

    let result: GeneratedFile;

    switch (format) {
      case 'png':
      case 'jpeg':
        // Use Gemini's native image generation for photorealistic images
        result = await this.generateImageNative(prompt, format, options);
        break;
      case 'svg':
        // Use AI-generated SVG code
        result = await this.generateSVGWithAI(prompt, options);
        break;
      case 'pdf':
        result = await this.generatePDF(prompt, options);
        break;
      case 'txt':
      case 'md':
        result = await this.generateTextDocument(prompt, format);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Cache the result
    this.generationCache.set(cacheKey, result);
    
    // Limit cache size
    if (this.generationCache.size > 20) {
      const firstKey = this.generationCache.keys().next().value;
      this.generationCache.delete(firstKey);
    }

    return result;
  }

  /**
   * Generate a photorealistic image using Google's Imagen 4 API
   * This is for PNG/JPEG formats only - produces high-quality images like DALL-E 3
   */
  private async generateImageNative(
    prompt: string, 
    format: 'png' | 'jpeg',
    options?: { style?: string; width?: number; height?: number; }
  ): Promise<GeneratedFile> {
    const width = options?.width || 1024;
    const height = options?.height || 1024;
    const style = options?.style || 'realistic';
    const cleanPrompt = this.extractImagePrompt(prompt);

    try {
      // Get API key from providerManager
      const geminiProvider = providerManager.getProvider(AIProvider.GEMINI) as any;
      const apiKey = geminiProvider?.getApiKey?.() || localStorage.getItem('GEMINI_API_KEY');
      
      if (!apiKey) {
        logger.log('FILE_GENERATOR', 'No API key available for Imagen, falling back to SVG', 'warning');
        return this.generateSVGWithAI(prompt, options);
      }

      logger.log('FILE_GENERATOR', `Using Imagen 4 for high-quality ${format} generation`, 'info');

      // Build the image generation prompt with quality modifiers based on style
      let imagePrompt: string;
      
      if (style === 'diagram' || style === 'schematic') {
        // For diagrams/schematics, use a specific prompt format for technical illustrations
        imagePrompt = `Detailed technical schematic diagram of ${cleanPrompt} with labeled components, clean engineering drawing style, isometric or orthographic view, professional CAD-style rendering, white or light background, clear labels pointing to parts, high resolution, technical illustration`;
      } else {
        const styleHint = style === 'realistic' ? 'photorealistic, 4K, HDR, highly detailed, professional photography' :
                          style === 'artistic' ? 'artistic, creative, stylized, detailed illustration' :
                          'detailed, high quality';
        imagePrompt = `${styleHint} of ${cleanPrompt}. High quality, detailed, no watermarks.`;
      }

      // Call Imagen 4 API directly
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            { prompt: imagePrompt }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: width > height ? "16:9" : width < height ? "9:16" : "1:1"
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
        
        // Check if this is a permission/model access issue
        if (response.status === 404 || response.status === 403) {
          logger.log('FILE_GENERATOR', `Imagen 4 not available: ${errorMsg}. Falling back to SVG.`, 'warning');
          return this.generateSVGWithAI(prompt, options);
        }
        
        throw new Error(`Imagen API error: ${errorMsg}`);
      }

      const data = await response.json();
      
      // Extract image data from response
      // Imagen returns base64 in predictions array
      const imageData = data.predictions?.[0]?.bytesBase64Encoded || 
                       data.generatedImages?.[0]?.image?.imageBytes;
      
      if (imageData) {
        // Convert base64 to blob
        const byteCharacters = atob(imageData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `image/${format}` });
        
        const dataUrl = `data:image/${format};base64,${imageData}`;
        
        logger.log('FILE_GENERATOR', `Successfully generated ${format} image using Imagen 4`, 'success');

        return {
          content: blob,
          format,
          mimeType: `image/${format}`,
          filename: `generated-${this.sanitizeFilename(cleanPrompt)}-${Date.now()}.${format}`,
          dataUrl,
          downloadUrl: dataUrl
        };
      }

      // If no image data returned, fall back to SVG
      logger.log('FILE_GENERATOR', 'No image data in Imagen response, falling back to SVG', 'warning');
      return this.generateSVGWithAI(prompt, options);

    } catch (error: any) {
      logger.log('FILE_GENERATOR', `Imagen 4 generation failed: ${error.message}`, 'error');
      // Fall back to SVG generation
      return this.generateSVGWithAI(prompt, options);
    }
  }

  /**
   * Extract base64 image data from AI response
   */
  private extractImageData(text: string): string | null {
    // Look for base64 image data
    // Gemini might return it in various formats
    
    // Try to find base64 data URI
    const dataUriMatch = text.match(/data:image\/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)/);
    if (dataUriMatch) {
      return dataUriMatch[1];
    }
    
    // Try to find raw base64 string (long string of base64 chars)
    const base64Match = text.match(/^[A-Za-z0-9+/]{100,}={0,2}$/m);
    if (base64Match) {
      return base64Match[0];
    }
    
    // Look for base64 in markdown image syntax
    const markdownMatch = text.match(/!\[.*?\]\(data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)\)/);
    if (markdownMatch) {
      return markdownMatch[1];
    }
    
    return null;
  }

  /**
   * Generate an SVG using AI-generated code
   */
  private async generateSVGWithAI(
    prompt: string, 
    options?: { style?: string; width?: number; height?: number; }
  ): Promise<GeneratedFile> {
    const width = options?.width || 800;
    const height = options?.height || 600;
    const style = options?.style || 'artistic';

    try {
      // Check which AI provider is available
      const geminiProvider = providerManager.getProvider(AIProvider.GEMINI);
      const ollamaProvider = providerManager.getProvider(AIProvider.OLLAMA);
      
      const geminiAvailable = geminiProvider && await geminiProvider.isAvailable();
      const ollamaAvailable = ollamaProvider && await ollamaProvider.isAvailable();

      if (!geminiAvailable && !ollamaAvailable) {
        logger.log('FILE_GENERATOR', 'No AI provider available, using fallback', 'warning');
        return this.generateFallbackSVG(prompt, width, height);
      }

      const provider = geminiAvailable ? AIProvider.GEMINI : AIProvider.OLLAMA;
      
      logger.log('FILE_GENERATOR', `Using ${provider} to generate SVG`, 'info');

      // Extract just the subject description from the prompt
      const cleanPrompt = this.extractImagePrompt(prompt);

      // Very explicit prompt for SVG generation
      const userPrompt = `You are an SVG graphics expert. Create an SVG image of: ${cleanPrompt}

REQUIREMENTS:
- Canvas size: ${width}x${height} pixels
- Style: ${style}
- Dark background that complements the subject
- Use gradients, shadows, and details to make it visually appealing

CRITICAL: Your entire response must be ONLY valid SVG code. NOTHING else.

The SVG MUST start with:
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">

And end with:
</svg>

Do not include:
- Markdown code blocks (no \`\`\`)
- Explanations or descriptions
- Any text outside the SVG tags

Generate the complete SVG now:`;

      logger.log('FILE_GENERATOR', `Sending prompt to ${provider}: "${cleanPrompt}"`, 'info');

      const response = await providerManager.route({
        prompt: userPrompt,
        timeout: 120000 // 2 minutes for SVG generation
      }, provider);

      logger.log('FILE_GENERATOR', `Received ${response.text.length} chars from ${provider}`, 'info');
      
      // Log full response for debugging (first 500 chars)
      const preview = response.text.substring(0, 500).replace(/\n/g, '\\n');
      logger.log('FILE_GENERATOR', `Full response: ${preview}${response.text.length > 500 ? '...' : ''}`, 'info');

      // Extract SVG from response
      let svgContent = this.extractSVG(response.text);
      
      if (!svgContent) {
        logger.log('FILE_GENERATOR', `AI did not return valid SVG. Response length: ${response.text.length}`, 'warning');
        // Try to salvage anything that looks like SVG
        svgContent = this.salvageSVG(response.text, width, height);
        if (!svgContent) {
          return this.generateFallbackSVG(prompt, width, height);
        }
      }

      // Validate and fix SVG if needed
      svgContent = this.validateAndFixSVG(svgContent, width, height);

      logger.log('FILE_GENERATOR', `Successfully generated SVG using ${provider}`, 'success');

      const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
      
      const result: GeneratedFile = {
        content: svgContent,
        format: 'svg',
        mimeType: 'image/svg+xml',
        filename: `generated-${this.sanitizeFilename(cleanPrompt)}-${Date.now()}.svg`,
        dataUrl,
        downloadUrl: dataUrl
      };

      return result;

    } catch (error: any) {
      logger.log('FILE_GENERATOR', `AI generation failed: ${error.message}`, 'error');
      return this.generateFallbackSVG(prompt, width, height);
    }
  }

  /**
   * Extract the image description from the full user prompt
   */
  private extractImagePrompt(prompt: string): string {
    const lower = prompt.toLowerCase();
    
    // Remove common command words
    const wordsToRemove = [
      'create', 'crete', 'draw', 'make', 'generate', 
      'an', 'a', 'the', 'image', 'picture', 'photo', 'of',
      'realistic', 'artistic', 'diagram', 'schematic',
      'svg', 'png', 'jpeg', 'jpg', 'please', 'can you',
      'for me'
    ];
    
    let cleaned = lower;
    for (const word of wordsToRemove) {
      cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
    }
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // If we stripped too much, return original without common prefixes
    if (cleaned.length < 3) {
      return prompt.replace(/^(create|draw|make|generate)\s+(an?|the)?\s*(image|picture|photo)?\s*(of)?\s*/i, '').trim();
    }
    
    return cleaned;
  }

  /**
   * Try to salvage SVG from messy AI responses
   */
  private salvageSVG(text: string, width: number, height: number): string | null {
    // Look for anything that resembles SVG elements
    const hasSVGElement = text.includes('<svg') || text.includes('<rect') || text.includes('<circle') || 
                          text.includes('<path') || text.includes('<ellipse') || text.includes('<polygon');
    
    if (!hasSVGElement) {
      return null;
    }
    
    // Try to extract just the SVG element content
    const svgStart = text.indexOf('<svg');
    const svgEnd = text.lastIndexOf('</svg>');
    
    if (svgStart !== -1 && svgEnd !== -1 && svgEnd > svgStart) {
      let svg = text.substring(svgStart, svgEnd + 6);
      // Add XML declaration
      return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
    }
    
    // If no proper SVG tags but has SVG elements, wrap them
    if (hasSVGElement) {
      // Extract common SVG elements
      const elements: string[] = [];
      const elementRegex = /<(rect|circle|ellipse|path|polygon|polyline|line|text|g|defs|gradient)[^>]*\/?>|<\/(rect|circle|ellipse|path|polygon|polyline|line|text|g|defs|gradient)>/gi;
      let match;
      while ((match = elementRegex.exec(text)) !== null) {
        elements.push(match[0]);
      }
      
      if (elements.length > 0) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#1a1a2e"/>
  ${elements.join('\n  ')}
</svg>`;
      }
    }
    
    return null;
  }

  /**
   * Extract SVG code from AI response
   */
  private extractSVG(text: string): string | null {
    // Remove markdown code blocks first
    let cleaned = text.replace(/```svg\n?/g, '').replace(/```\n?/g, '');
    cleaned = cleaned.replace(/```xml\n?/g, '').replace(/```\n?/g, '');
    cleaned = cleaned.trim();
    
    // Look for SVG with XML declaration (preferred)
    const xmlMatch = cleaned.match(/<\?xml[\s\S]*?<svg[\s\S]*?<\/svg>/i);
    if (xmlMatch) {
      return xmlMatch[0];
    }
    
    // Look for SVG tags alone
    const svgMatch = cleaned.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      // Add XML declaration if missing
      return `<?xml version="1.0" encoding="UTF-8"?>\n${svgMatch[0]}`;
    }
    
    // If text contains escaped HTML entities
    if (cleaned.includes('&lt;svg') || cleaned.includes('&lt;?xml')) {
      const unescaped = cleaned
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
      return this.extractSVG(unescaped);
    }
    
    // Sometimes AI wraps in quotes or other formatting
    const quotedMatch = cleaned.match(/"<svg[\s\S]*?<\/svg>"/i);
    if (quotedMatch) {
      return quotedMatch[0].replace(/^"|"$/g, '');
    }
    
    return null;
  }

  /**
   * Validate and fix common SVG issues
   */
  private validateAndFixSVG(svg: string, width: number, height: number): string {
    let fixed = svg;
    
    // Ensure XML declaration
    if (!fixed.includes('<?xml')) {
      fixed = `<?xml version="1.0" encoding="UTF-8"?>\n${fixed}`;
    }
    
    // Ensure proper namespace
    if (!fixed.includes('xmlns=')) {
      fixed = fixed.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // Ensure viewBox
    if (!fixed.includes('viewBox')) {
      fixed = fixed.replace(/<svg/i, `<svg viewBox="0 0 ${width} ${height}"`);
    }
    
    // Ensure width/height
    if (!fixed.match(/width="/)) {
      fixed = fixed.replace(/<svg/i, `<svg width="${width}" height="${height}"`);
    }
    
    // Remove any markdown code block markers
    fixed = fixed.replace(/```svg?\n?/g, '').replace(/```\n?/g, '');
    
    return fixed;
  }

  /**
   * Generate fallback SVG when AI fails
   */
  private generateFallbackSVG(prompt: string, width: number, height: number): GeneratedFile {
    const cleanPrompt = this.extractImagePrompt(prompt);
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a365d" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#2c5282" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3182ce" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="#0a0a0a"/>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="${width * 0.5}" cy="${height * 0.5}" r="${Math.min(width, height) * 0.35}" fill="url(#glow)"/>
  
  <!-- Placeholder shapes -->
  <g transform="translate(${width * 0.5}, ${height * 0.45})" opacity="0.6">
    <circle cx="-40" cy="-30" r="35" fill="#3182ce" opacity="0.5"/>
    <circle cx="40" cy="-30" r="35" fill="#38a169" opacity="0.5"/>
    <circle cx="0" cy="30" r="35" fill="#d69e2e" opacity="0.5"/>
  </g>
  
  <!-- Text -->
  <text x="${width * 0.5}" y="${height * 0.15}" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="18" font-weight="bold">
    ${this.escapeXml(cleanPrompt.substring(0, 30))}${cleanPrompt.length > 30 ? '...' : ''}
  </text>
  <text x="${width * 0.5}" y="${height * 0.92}" text-anchor="middle" fill="#888" font-family="system-ui, sans-serif" font-size="12">
    AI Image Generation
  </text>
</svg>`;
    
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    
    return {
      content: svg,
      format: 'svg',
      mimeType: 'image/svg+xml',
      filename: `generated-${Date.now()}.svg`,
      dataUrl,
      downloadUrl: dataUrl
    };
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(prompt: string): string {
    return prompt.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 30)
      .replace(/-+$/, '');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate a PDF document
   */
  private async generatePDF(prompt: string, options?: any): Promise<GeneratedFile> {
    const content = `<!DOCTYPE html>
<html>
<head>
  <title>${prompt}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #2d3748; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; }
    .meta { color: #718096; font-size: 14px; margin-bottom: 30px; }
    .content { line-height: 1.6; }
  </style>
</head>
<body>
  <h1>${prompt}</h1>
  <div class="meta">Generated by JARVIS on ${new Date().toLocaleString()}</div>
  <div class="content">
    <p>This document was generated based on your request: "${prompt}"</p>
    <p>Future versions will include AI-generated content here.</p>
  </div>
</body>
</html>`;

    const blob = new Blob([content], { type: 'text/html' });
    const dataUrl = URL.createObjectURL(blob);

    return {
      content: blob,
      format: 'pdf',
      mimeType: 'text/html',
      filename: `document-${Date.now()}.html`,
      dataUrl,
      downloadUrl: dataUrl
    };
  }

  /**
   * Generate a text document
   */
  private async generateTextDocument(prompt: string, format: 'txt' | 'md'): Promise<GeneratedFile> {
    const timestamp = new Date().toLocaleString();
    let content = '';
    let mimeType = '';
    let extension = '';

    if (format === 'md') {
      content = `# ${prompt}\n\n*Generated by JARVIS on ${timestamp}*\n\n## Overview\n\nThis document was generated based on your request.\n\n## Content\n\nFuture versions will include AI-generated content based on: "${prompt}"\n`;
      mimeType = 'text/markdown';
      extension = 'md';
    } else {
      content = `${prompt}\n\nGenerated by JARVIS on ${timestamp}\n\nThis document was generated based on your request.\n\nFuture versions will include AI-generated content based on: "${prompt}"\n`;
      mimeType = 'text/plain';
      extension = 'txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const dataUrl = URL.createObjectURL(blob);

    return {
      content: blob,
      format,
      mimeType,
      filename: `document-${Date.now()}.${extension}`,
      dataUrl,
      downloadUrl: dataUrl
    };
  }

  /**
   * Download a generated file
   */
  downloadFile(file: GeneratedFile): void {
    const link = document.createElement('a');
    link.href = file.downloadUrl || file.dataUrl || '';
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.log('FILE_GENERATOR', `Downloaded file: ${file.filename}`, 'success');
  }
}

export const fileGeneratorService = FileGeneratorService.getInstance();
