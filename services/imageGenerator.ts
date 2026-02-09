import { logger } from './logger';

/**
 * Service for generating images using SVG fallbacks
 * TODO: Integrate with Gemini API for AI image generation
 */
export class ImageGeneratorService {
  private static instance: ImageGeneratorService;

  public static getInstance(): ImageGeneratorService {
    if (!ImageGeneratorService.instance) {
      ImageGeneratorService.instance = new ImageGeneratorService();
    }
    return ImageGeneratorService.instance;
  }

  /**
   * Generate an image based on the provided prompt
   * Currently uses SVG fallbacks. Future: integrate with Gemini API
   */
  async generateImage(prompt: string, format: 'png' | 'jpeg' | 'svg' = 'svg'): Promise<string> {
    try {
      logger.log('IMAGE_GENERATOR', `Generating image for: "${prompt}"`, 'info');
      
      // Use SVG generation as primary method
      logger.log('IMAGE_GENERATOR', 'Using SVG generation', 'info');
      return this.generateFallbackSVG(prompt);
    } catch (error) {
      logger.log('IMAGE_GENERATOR', `Failed to generate image: ${(error as Error).message}`, 'error');
      return this.generateFallbackSVG(prompt);
    }
  }

  /**
   * Generate an SVG illustration based on the prompt
   */
  private generateFallbackSVG(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Generate different SVGs based on the content requested
    if (lowerPrompt.includes('bird')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" style="background: #0a0a0a;">
        <defs>
          <linearGradient id="birdGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.4"/>
          </linearGradient>
        </defs>
        <!-- Bird body -->
        <ellipse cx="200" cy="180" rx="50" ry="30" fill="url(#birdGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Bird head -->
        <circle cx="240" cy="160" r="20" fill="url(#birdGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Bird eye -->
        <circle cx="245" cy="155" r="4" fill="#000"/>
        <circle cx="245" cy="155" r="2" fill="#fff"/>
        <!-- Bird beak -->
        <polygon points="260,160 275,155 260,165" fill="#ff6b6b" stroke="#ff6b6b" stroke-width="1"/>
        <!-- Bird wing -->
        <path d="M 180 170 Q 140 150 160 190" fill="url(#birdGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Bird tail -->
        <path d="M 150 180 Q 120 170 140 200" fill="url(#birdGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Bird legs -->
        <line x1="190" y1="210" x2="190" y2="230" stroke="#ff6b6b" stroke-width="3"/>
        <line x1="210" y1="210" x2="210" y2="230" stroke="#ff6b6b" stroke-width="3"/>
        <text x="200" y="40" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="14">Bird Image</text>
        <text x="200" y="270" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">AI-Generated Bird Illustration</text>
      </svg>`;
    } else if (lowerPrompt.includes('cat')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" style="background: #0a0a0a;">
        <defs>
          <radialGradient id="catGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.4"/>
          </radialGradient>
        </defs>
        <!-- Cat body -->
        <ellipse cx="200" cy="180" rx="65" ry="35" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Cat head -->
        <circle cx="200" cy="140" r="30" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Cat ears -->
        <polygon points="180,115 170,95 190,105" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="1"/>
        <polygon points="220,115 230,95 210,105" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="1"/>
        <!-- Cat eyes -->
        <circle cx="188" cy="135" r="4" fill="#000"/>
        <circle cx="212" cy="135" r="4" fill="#000"/>
        <circle cx="188" cy="135" r="2" fill="#fff"/>
        <circle cx="212" cy="135" r="2" fill="#fff"/>
        <!-- Cat nose -->
        <polygon points="200,145 195,150 205,150" fill="#ff6b6b"/>
        <!-- Cat mouth -->
        <path d="M 200 150 Q 205 155 200 160 Q 195 155 200 150" stroke="#000" fill="none"/>
        <!-- Cat whiskers -->
        <line x1="180" y1="145" x2="160" y2="140" stroke="#fff" stroke-width="1"/>
        <line x1="180" y1="150" x2="160" y2="150" stroke="#fff" stroke-width="1"/>
        <line x1="180" y1="155" x2="160" y2="160" stroke="#fff" stroke-width="1"/>
        <line x1="220" y1="145" x2="240" y2="140" stroke="#fff" stroke-width="1"/>
        <line x1="220" y1="150" x2="240" y2="150" stroke="#fff" stroke-width="1"/>
        <line x1="220" y1="155" x2="240" y2="160" stroke="#fff" stroke-width="1"/>
        <!-- Cat legs -->
        <rect x="170" y="210" width="10" height="25" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="1"/>
        <rect x="190" y="210" width="10" height="25" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="1"/>
        <rect x="210" y="210" width="10" height="25" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="1"/>
        <rect x="230" y="210" width="10" height="25" fill="url(#catGradient)" stroke="#06b6d4" stroke-width="1"/>
        <!-- Cat tail -->
        <path d="M 260 180 Q 300 160 290 130 Q 280 100 250 120" stroke="#06b6d4" stroke-width="8" stroke-linecap="round" fill="none"/>
        <text x="200" y="40" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="14">Cat Image</text>
        <text x="200" y="270" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">AI-Generated Cat Illustration</text>
      </svg>`;
    } else if (lowerPrompt.includes('dog')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" style="background: #0a0a0a;">
        <defs>
          <linearGradient id="dogGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.4"/>
          </linearGradient>
        </defs>
        <!-- Dog body -->
        <ellipse cx="200" cy="180" rx="70" ry="40" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Dog head -->
        <circle cx="180" cy="140" r="30" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="2"/>
        <!-- Dog ears -->
        <ellipse cx="165" cy="120" rx="12" ry="20" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="1"/>
        <ellipse cx="195" cy="120" rx="12" ry="20" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="1"/>
        <!-- Dog eyes -->
        <circle cx="170" cy="135" r="4" fill="#000"/>
        <circle cx="190" cy="135" r="4" fill="#000"/>
        <circle cx="170" cy="135" r="2" fill="#fff"/>
        <circle cx="190" cy="135" r="2" fill="#fff"/>
        <!-- Dog nose -->
        <circle cx="175" cy="150" r="5" fill="#000"/>
        <!-- Dog mouth -->
        <path d="M 175 155 Q 180 160 185 155" stroke="#000" fill="none" stroke-width="2"/>
        <!-- Dog legs -->
        <rect x="160" y="210" width="12" height="30" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="1"/>
        <rect x="180" y="210" width="12" height="30" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="1"/>
        <rect x="210" y="210" width="12" height="30" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="1"/>
        <rect x="230" y="210" width="12" height="30" fill="url(#dogGradient)" stroke="#06b6d4" stroke-width="1"/>
        <!-- Dog tail -->
        <path d="M 260 170 Q 290 150 280 120" stroke="#06b6d4" stroke-width="6" stroke-linecap="round" fill="none"/>
        <text x="200" y="40" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="14">Dog Image</text>
        <text x="200" y="270" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">AI-Generated Dog Illustration</text>
      </svg>`;
    } else if (lowerPrompt.includes('3d printer') || lowerPrompt.includes('printer')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" style="background: #0a0a0a;">
        <defs>
          <linearGradient id="printerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.7"/>
          </linearGradient>
        </defs>
        <!-- Printer frame -->
        <rect x="50" y="100" width="300" height="150" rx="10" ry="10" fill="none" stroke="#06b6d4" stroke-width="2"/>
        <!-- Print bed -->
        <rect x="70" y="120" width="260" height="100" fill="url(#printerGradient)" stroke="#06b6d4" stroke-width="1"/>
        <!-- Extruder head -->
        <rect x="180" y="80" width="40" height="20" fill="#06b6d4" stroke="#06b6d4" stroke-width="1"/>
        <!-- Vertical rod -->
        <line x1="200" y1="80" x2="200" y2="120" stroke="#06b6d4" stroke-width="2" stroke-dasharray="4"/>
        <!-- Filament path -->
        <rect x="90" y="140" width="220" height="5" fill="#06b6d4" opacity="0.3"/>
        <rect x="95" y="150" width="210" height="5" fill="#06b6d4" opacity="0.3"/>
        <rect x="100" y="160" width="200" height="5" fill="#06b6d4" opacity="0.3"/>
        <!-- LCD screen -->
        <rect x="80" y="220" width="80" height="20" fill="#1a1a1a" stroke="#06b6d4" stroke-width="1"/>
        <text x="120" y="235" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">LCD</text>
        <!-- Status lights -->
        <circle cx="320" cy="110" r="5" fill="#00ff00" stroke="#06b6d4" stroke-width="1"/>
        <circle cx="320" cy="130" r="5" fill="#ffff00" stroke="#06b6d4" stroke-width="1"/>
        <text x="200" y="40" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="14">3D Printer</text>
        <text x="200" y="270" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">3D Printer Visualization</text>
      </svg>`;
    } else {
      // Generic image based on prompt
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" style="background: #0a0a0a;">
        <defs>
          <radialGradient id="genericGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.4"/>
          </radialGradient>
        </defs>
        <rect x="50" y="50" width="300" height="200" fill="none" stroke="#06b6d4" stroke-width="2"/>
        <circle cx="100" cy="100" r="25" fill="url(#genericGradient)" stroke="#06b6d4" stroke-width="1"/>
        <circle cx="200" cy="100" r="25" fill="url(#genericGradient)" stroke="#06b6d4" stroke-width="1"/>
        <circle cx="300" cy="100" r="25" fill="url(#genericGradient)" stroke="#06b6d4" stroke-width="1"/>
        <line x1="125" y1="100" x2="175" y2="100" stroke="#06b6d4" stroke-width="2"/>
        <line x1="225" y1="100" x2="275" y2="100" stroke="#06b6d4" stroke-width="2"/>
        <text x="200" y="20" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="14">Generated Image</text>
        <text x="200" y="270" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">Based on: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}</text>
      </svg>`;
    }
  }
}

export const imageGeneratorService = ImageGeneratorService.getInstance();