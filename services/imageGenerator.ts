import { logger } from './logger';
import { apiKeyManager } from './apiKeyManager';
import { cacheService } from './cacheService';

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp' | 'svg';
  style?: 'vivid' | 'natural';
  quality?: 'standard' | 'hd';
}

export interface GeneratedImage {
  url: string;
  base64?: string;
  svg?: string;
  format: string;
  prompt: string;
  created: number;
}

/**
 * Service for generating images using AI providers
 * Supports: OpenAI DALL-E 3, SVG fallbacks
 */
export class ImageGeneratorService {
  private static instance: ImageGeneratorService;
  private readonly cachePrefix = 'img_gen_';

  public static getInstance(): ImageGeneratorService {
    if (!ImageGeneratorService.instance) {
      ImageGeneratorService.instance = new ImageGeneratorService();
    }
    return ImageGeneratorService.instance;
  }

  /**
   * Generate an image based on the provided prompt
   * Tries DALL-E first, falls back to SVG on failure
   */
  async generateImage(
    prompt: string, 
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage> {
    const { format = 'png', width = 1024, height = 1024 } = options;
    
    // Check cache first
    const cacheKey = this.getCacheKey(prompt, options);
    const cached = cacheService.get<GeneratedImage>(cacheKey);
    if (cached) {
      logger.log('IMAGE_GENERATOR', `Cache hit for: "${prompt}"`, 'info');
      return cached;
    }

    try {
      logger.log('IMAGE_GENERATOR', `Generating image for: "${prompt}"`, 'info');

      // Try AI generation if API key available and not SVG
      if (format !== 'svg') {
        const apiKey = await apiKeyManager.getKey('openai');
        if (apiKey) {
          const result = await this.generateWithDALLE(prompt, options);
          cacheService.set(cacheKey, result, 3600000); // 1 hour cache
          return result;
        }
      }

      // Fallback to SVG
      logger.log('IMAGE_GENERATOR', 'Using SVG generation (no API key)', 'info');
      const svg = this.generateFallbackSVG(prompt, width, height);
      const result: GeneratedImage = {
        url: `data:image/svg+xml;base64,${btoa(svg)}`,
        svg,
        format: 'svg',
        prompt,
        created: Date.now()
      };
      cacheService.set(cacheKey, result, 3600000);
      return result;

    } catch (error) {
      logger.log('IMAGE_GENERATOR', `Failed to generate image: ${(error as Error).message}`, 'error');
      // Always return SVG fallback on error
      const svg = this.generateFallbackSVG(prompt, width, height);
      return {
        url: `data:image/svg+xml;base64,${btoa(svg)}`,
        svg,
        format: 'svg',
        prompt,
        created: Date.now()
      };
    }
  }

  /**
   * Generate image using OpenAI DALL-E 3
   */
  private async generateWithDALLE(
    prompt: string,
    options: ImageGenerationOptions
  ): Promise<GeneratedImage> {
    const apiKey = await apiKeyManager.getKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { width = 1024, height = 1024, quality = 'standard', style = 'vivid' } = options;
    
    // DALL-E 3 only supports specific sizes
    const size = this.getClosestSize(width, height);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality,
        style,
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DALL-E API error: ${error}`);
    }

    const data = await response.json();
    const base64 = data.data[0].b64_json;
    const revisedPrompt = data.data[0].revised_prompt;

    logger.log('IMAGE_GENERATOR', 'DALL-E image generated successfully', 'success');

    return {
      url: `data:image/png;base64,${base64}`,
      base64,
      format: 'png',
      prompt: revisedPrompt || prompt,
      created: Date.now()
    };
  }

  /**
   * Get closest DALL-E supported size
   */
  private getClosestSize(width: number, height: number): string {
    const sizes = ['1024x1024', '1792x1024', '1024x1792'];
    const aspectRatio = width / height;
    
    if (aspectRatio > 1.3) return '1792x1024';
    if (aspectRatio < 0.8) return '1024x1792';
    return '1024x1024';
  }

  /**
   * Generate cache key for image
   */
  private getCacheKey(prompt: string, options: ImageGenerationOptions): string {
    const optString = JSON.stringify(options);
    return `${this.cachePrefix}${btoa(prompt + optString).slice(0, 32)}`;
  }

  /**
   * Generate an SVG illustration based on the prompt
   */
  private generateFallbackSVG(prompt: string, width: number, height: number): string {
    const lowerPrompt = prompt.toLowerCase();
    
    // Extract key concepts from prompt
    const concepts = this.extractConcepts(lowerPrompt);
    
    if (concepts.includes('person') || concepts.includes('human') || concepts.includes('portrait')) {
      return this.generatePortraitSVG(width, height);
    }
    if (concepts.includes('landscape') || concepts.includes('nature') || concepts.includes('scene')) {
      return this.generateLandscapeSVG(width, height, prompt);
    }
    if (concepts.includes('abstract') || concepts.includes('pattern')) {
      return this.generateAbstractSVG(width, height);
    }
    if (concepts.includes('animal')) {
      return this.generateAnimalSVG(width, height, concepts);
    }
    if (concepts.includes('building') || concepts.includes('architecture')) {
      return this.generateBuildingSVG(width, height);
    }
    
    // Default generic illustration
    return this.generateGenericSVG(width, height, prompt);
  }

  /**
   * Extract key concepts from prompt
   */
  private extractConcepts(prompt: string): string[] {
    const conceptMap: Record<string, string[]> = {
      person: ['person', 'human', 'man', 'woman', 'portrait', 'face', 'people'],
      landscape: ['landscape', 'nature', 'mountain', 'forest', 'ocean', 'sky', 'scene'],
      animal: ['bird', 'cat', 'dog', 'animal', 'creature', 'pet'],
      abstract: ['abstract', 'pattern', 'geometric', 'art', 'design'],
      building: ['building', 'house', 'architecture', 'city', 'structure']
    };

    const concepts: string[] = [];
    for (const [concept, keywords] of Object.entries(conceptMap)) {
      if (keywords.some(k => prompt.includes(k))) {
        concepts.push(concept);
      }
    }
    return concepts;
  }

  private generatePortraitSVG(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
      <defs>
        <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.4"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="${w/2}" cy="${h/2 - 30}" r="80" fill="url(#faceGrad)" filter="url(#glow)" opacity="0.8"/>
      <ellipse cx="${w/2 - 25}" cy="${h/2 - 40}" rx="12" ry="15" fill="#000" opacity="0.6"/>
      <ellipse cx="${w/2 + 25}" cy="${h/2 - 40}" rx="12" ry="15" fill="#000" opacity="0.6"/>
      <path d="M ${w/2 - 20} ${h/2 - 10} Q ${w/2} ${h/2 + 10} ${w/2 + 20} ${h/2 - 10}" stroke="#000" stroke-width="2" fill="none" opacity="0.5"/>
      <path d="M ${w/2 - 60} ${h/2 + 50} Q ${w/2} ${h/2 + 150} ${w/2 + 60} ${h/2 + 50}" fill="url(#faceGrad)" opacity="0.4"/>
    </svg>`;
  }

  private generateLandscapeSVG(w: number, h: number, prompt: string): string {
    const hasMountains = prompt.toLowerCase().includes('mountain');
    const hasWater = prompt.toLowerCase().includes('water') || prompt.toLowerCase().includes('ocean') || prompt.toLowerCase().includes('lake');
    
    let elements = '';
    
    if (hasMountains) {
      elements += `<path d="M 0 ${h} L ${w*0.2} ${h*0.5} L ${w*0.4} ${h*0.7} L ${w*0.6} ${h*0.4} L ${w*0.8} ${h*0.6} L ${w} ${h*0.3} L ${w} ${h} Z" fill="#1e3a5f" opacity="0.8"/>`;
      elements += `<path d="M 0 ${h} L ${w*0.15} ${h*0.6} L ${w*0.35} ${h*0.8} L ${w*0.55} ${h*0.5} L ${w} ${h*0.7} L ${w} ${h} Z" fill="#2d4a6f" opacity="0.6"/>`;
    }
    
    if (hasWater) {
      elements += `<rect x="0" y="${h*0.7}" width="${w}" height="${h*0.3}" fill="url(#waterGrad)" opacity="0.5"/>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#skyGrad)"/>
      ${elements}
    </svg>`;
  }

  private generateAbstractSVG(w: number, h: number): string {
    const shapes: string[] = [];
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 20 + Math.random() * 100;
      const opacity = 0.2 + Math.random() * 0.5;
      const hue = Math.floor(Math.random() * 60) + 180; // Blue-cyan range
      shapes.push(`<circle cx="${x}" cy="${y}" r="${size}" fill="hsl(${hue}, 70%, 50%)" opacity="${opacity}"/>`);
    }
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="background: #0f172a;">
      ${shapes.join('')}
    </svg>`;
  }

  private generateAnimalSVG(w: number, h: number, concepts: string[]): string {
    const lower = concepts.join(' ');
    
    if (lower.includes('bird')) {
      return this.generateBirdSVG(w, h);
    }
    if (lower.includes('cat')) {
      return this.generateCatSVG(w, h);
    }
    
    return this.generateGenericSVG(w, h, 'animal');
  }

  private generateBirdSVG(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);">
      <defs>
        <linearGradient id="birdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#3b82f6"/>
        </linearGradient>
      </defs>
      <ellipse cx="${w/2}" cy="${h/2}" rx="60" ry="40" fill="url(#birdGrad)" opacity="0.8"/>
      <circle cx="${w/2 + 40}" cy="${h/2 - 20}" r="25" fill="url(#birdGrad)" opacity="0.9"/>
      <circle cx="${w/2 + 45}" cy="${h/2 - 25}" r="5" fill="#000"/>
      <polygon points="${w/2 + 65},${h/2 - 20} ${w/2 + 85},${h/2 - 10} ${w/2 + 65},${h/2 - 10}" fill="#f59e0b"/>
      <path d="M ${w/2 - 30} ${h/2} Q ${w/2 - 80} ${h/2 - 40} ${w/2 - 50} ${h/2 + 30}" fill="url(#birdGrad)" opacity="0.6"/>
      <path d="M ${w/2 - 40} ${h/2 + 10} L ${w/2 - 40} ${h/2 + 60}" stroke="#f59e0b" stroke-width="4"/>
      <path d="M ${w/2 + 10} ${h/2 + 10} L ${w/2 + 10} ${h/2 + 60}" stroke="#f59e0b" stroke-width="4"/>
    </svg>`;
  }

  private generateCatSVG(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
      <defs>
        <linearGradient id="catGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <ellipse cx="${w/2}" cy="${h/2 + 20}" rx="70" ry="45" fill="url(#catGrad)" opacity="0.8"/>
      <circle cx="${w/2}" cy="${h/2 - 30}" r="40" fill="url(#catGrad)" opacity="0.9"/>
      <polygon points="${w/2 - 30},${h/2 - 60} ${w/2 - 45},${h/2 - 90} ${w/2 - 10},${h/2 - 70}" fill="url(#catGrad)"/>
      <polygon points="${w/2 + 30},${h/2 - 60} ${w/2 + 45},${h/2 - 90} ${w/2 + 10},${h/2 - 70}" fill="url(#catGrad)"/>
      <ellipse cx="${w/2 - 15}" cy="${h/2 - 35}" rx="8" ry="12" fill="#000"/>
      <ellipse cx="${w/2 + 15}" cy="${h/2 - 35}" rx="8" ry="12" fill="#000"/>
      <ellipse cx="${w/2 - 13}" cy="${h/2 - 38}" rx="3" ry="4" fill="#fff"/>
      <ellipse cx="${w/2 + 17}" cy="${h/2 - 38}" rx="3" ry="4" fill="#fff"/>
      <polygon points="${w/2},${h/2 - 20} ${w/2 - 5},${h/2 - 10} ${w/2 + 5},${h/2 - 10}" fill="#f43f5e"/>
    </svg>`;
  }

  private generateBuildingSVG(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);">
      <rect x="${w/2 - 80}" y="${h/2 - 100}" width="160" height="200" fill="#334155" opacity="0.8"/>
      <rect x="${w/2 - 70}" y="${h/2 - 80}" width="30" height="30" fill="#06b6d4" opacity="0.6"/>
      <rect x="${w/2 - 20}" y="${h/2 - 80}" width="30" height="30" fill="#06b6d4" opacity="0.6"/>
      <rect x="${w/2 + 30}" y="${h/2 - 80}" width="30" height="30" fill="#06b6d4" opacity="0.6"/>
      <rect x="${w/2 - 70}" y="${h/2 - 30}" width="30" height="30" fill="#06b6d4" opacity="0.6"/>
      <rect x="${w/2 - 20}" y="${h/2 - 30}" width="30" height="30" fill="#06b6d4" opacity="0.6"/>
      <rect x="${w/2 + 30}" y="${h/2 - 30}" width="30" height="30" fill="#06b6d4" opacity="0.6"/>
      <rect x="${w/2 - 40}" y="${h/2 + 50}" width="80" height="50" fill="#1e293b" stroke="#475569" stroke-width="2"/>
      <polygon points="${w/2 - 90},${h/2 - 100} ${w/2},${h/2 - 160} ${w/2 + 90},${h/2 - 100}" fill="#475569"/>
    </svg>`;
  }

  private generateGenericSVG(w: number, h: number, prompt: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);">
      <defs>
        <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#ec4899" stop-opacity="0.3"/>
        </linearGradient>
      </defs>
      <circle cx="${w/2}" cy="${h/2}" r="120" fill="url(#mainGrad)" opacity="0.3"/>
      <circle cx="${w/2}" cy="${h/2}" r="80" fill="url(#mainGrad)" opacity="0.5"/>
      <circle cx="${w/2}" cy="${h/2}" r="40" fill="url(#mainGrad)" opacity="0.7"/>
      <text x="${w/2}" y="${h - 40}" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="14">${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}</text>
    </svg>`;
  }
}

export const imageGenerator = ImageGeneratorService.getInstance();
