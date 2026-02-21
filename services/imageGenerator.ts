import { logger } from './logger';
import { cacheService } from './cacheService';
import { localImageGenerator, ImageGenerationOptions, GeneratedImage } from './localImageGenerator';

export type { ImageGenerationOptions, GeneratedImage } from './localImageGenerator';

/**
 * Service for generating images using AI providers
 * 
 * PURELY LOCAL - No cloud APIs
 * Supports:
 * - ComfyUI (recommended) - Best quality, FLUX, SD3.5, custom workflows
 * - AUTOMATIC1111 - Stable Diffusion WebUI
 * - Ollama (experimental, macOS only currently) - Native when available
 * - SVG Fallback - High-quality vector diagrams when no local provider available
 * 
 * For high-quality photorealistic images, install ComfyUI with FLUX or SD3.5 models.
 */
export class ImageGeneratorService {
  private static instance: ImageGeneratorService;
  private initialized: boolean = false;

  public static getInstance(): ImageGeneratorService {
    if (!ImageGeneratorService.instance) {
      ImageGeneratorService.instance = new ImageGeneratorService();
    }
    return ImageGeneratorService.instance;
  }

  /**
   * Initialize the image generator service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await localImageGenerator.initialize();
    this.initialized = true;
  }

  /**
   * Generate an image based on the provided prompt
   * 
   * PURELY LOCAL - Uses ComfyUI, AUTOMATIC1111, or Ollama for generation.
   * Falls back to high-quality SVG if no local provider is available.
   * 
   * Optimized for 11GB VRAM cards (GTX 1080 Ti, RTX 3060, etc.)
   * 
   * @param prompt Text description of the image to generate
   * @param options Generation options (width, height, model, etc.)
   * @returns Generated image data
   */
  async generateImage(
    prompt: string, 
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage> {
    await this.initialize();
    
    // Set conservative defaults for 11GB VRAM if not specified
    const safeOptions = {
      width: 1024,   // Safe for SDXL/SD 3.5 Medium on 11GB
      height: 1024,  // Higher may cause OOM
      steps: 20,     // Good quality/speed balance
      ...options
    };
    
    logger.log('IMAGE_GENERATOR', 
      `Generating image (${safeOptions.width}x${safeOptions.height}): "${prompt.slice(0, 50)}..."`, 
      'info');
    
    // Use local image generator (no cloud APIs)
    return localImageGenerator.generateImage(prompt, safeOptions);
  }

  /**
   * Generate a technical diagram/schematic
   * Optimized for architectural, workshop, electrical diagrams
   * 
   * Uses ComfyUI for photorealistic images if available, falls back to SVG
   */
  async generateDiagram(
    prompt: string,
    options: Omit<ImageGenerationOptions, 'style'> = {}
  ): Promise<GeneratedImage> {
    await this.initialize();
    
    // Check if ComfyUI is available for high-quality generation
    const hasComfyUI = this.getProviders().some(p => p.type === 'comfyui' && p.available);
    
    if (hasComfyUI) {
      // Use ComfyUI for photorealistic technical diagrams
      logger.log('IMAGE_GENERATOR', 'Using ComfyUI for technical diagram', 'info');
      return this.generateImage(prompt, {
        ...options,
        style: 'technical',
        format: 'png' // Get high-quality PNG from ComfyUI
      });
    }
    
    // Fall back to SVG if no ComfyUI
    logger.log('IMAGE_GENERATOR', 'No ComfyUI available, using SVG fallback', 'warning');
    return localImageGenerator.generateImage(prompt, {
      ...options,
      style: 'technical',
      format: 'svg'
    });
  }

  /**
   * Generate workshop layout visualization
   */
  async generateWorkshopLayout(
    description: string,
    options: Partial<ImageGenerationOptions> = {}
  ): Promise<GeneratedImage> {
    const prompt = `Technical workshop layout diagram: ${description}. ` +
      `Top-down floor plan view with measurements, workbench placement, ` +
      `tool storage, dust collection, lumber storage, pegboard wall. ` +
      `Professional architectural schematic style, grid lines, dimensions.`;
    
    return this.generateDiagram(prompt, {
      width: 1024,
      height: 768,
      ...options
    });
  }

  /**
   * Generate electrical schematic
   */
  async generateElectricalSchematic(
    description: string,
    options: Partial<ImageGenerationOptions> = {}
  ): Promise<GeneratedImage> {
    const prompt = `Electrical schematic diagram: ${description}. ` +
      `Professional circuit diagram with standard symbols, wire connections, ` +
      `components labeled, clear layout.`;
    
    return this.generateDiagram(prompt, {
      width: 1024,
      height: 768,
      ...options
    });
  }

  /**
   * Generate architectural floor plan
   */
  async generateFloorPlan(
    description: string,
    options: Partial<ImageGenerationOptions> = {}
  ): Promise<GeneratedImage> {
    const prompt = `Architectural floor plan: ${description}. ` +
      `Professional blueprint style, room dimensions, door/window placements, ` +
      `furniture layout, wall thickness indicated.`;
    
    return this.generateDiagram(prompt, {
      width: 1024,
      height: 1024,
      ...options
    });
  }

  /**
   * Check if any image generation provider is available
   */
  hasProvider(): boolean {
    return localImageGenerator.hasProvider();
  }

  /**
   * Get available providers
   */
  getProviders() {
    return localImageGenerator.getProviders();
  }

  /**
   * Quick check if local generation is available
   */
  isLocalGenerationAvailable(): boolean {
    return this.hasProvider();
  }

  /**
   * Clear the image generation cache
   */
  clearCache(): void {
    localImageGenerator.clearCache();
  }
}

export const imageGenerator = ImageGeneratorService.getInstance();

// Legacy export for backward compatibility
export default imageGenerator;
