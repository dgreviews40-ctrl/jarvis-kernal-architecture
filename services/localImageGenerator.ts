import { logger } from './logger';
import { cacheService } from './cacheService';

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp' | 'svg';
  style?: 'vivid' | 'natural' | 'photorealistic' | 'technical';
  quality?: 'standard' | 'hd' | 'ultra';
  negativePrompt?: string;
  steps?: number;
  seed?: number;
  /** Model to use - 'sd35', 'flux', 'illustrious', or custom */
  model?: string;
  /** Base64 image data for img2img generation */
  imageInput?: string;
}

export interface GeneratedImage {
  url: string;
  base64?: string;
  svg?: string;
  format: string;
  prompt: string;
  created: number;
  metadata?: {
    model?: string;
    steps?: number;
    seed?: number;
    width?: number;
    height?: number;
    generationTime?: number;
  };
}

export interface LocalImageProvider {
  name: string;
  type: 'comfyui' | 'automatic1111' | 'ollama' | 'lmstudio';
  url: string;
  available: boolean;
  models: string[];
}

/**
 * Local Image Generation Service
 * 
 * Supports multiple local image generation backends:
 * - ComfyUI (recommended) - Best quality, supports FLUX, SD3.5, custom workflows
 * - AUTOMATIC1111 - Stable Diffusion WebUI, well established
 * - Ollama (experimental, macOS only for now) - Native integration when available
 * 
 * NO cloud APIs - strictly local generation
 */
export class LocalImageGeneratorService {
  private static instance: LocalImageGeneratorService;
  private readonly cachePrefix = 'local_img_';
  
  private providers: Map<string, LocalImageProvider> = new Map();
  private defaultProvider: string = 'comfyui';
  private isInitialized: boolean = false;

  // Default endpoints for local services
  // Use proxy in browser to avoid CORS issues
  // Proxy configured in vite.config.ts routes /comfyui to localhost:8188
  private getComfyUIEndpoint(): string {
    if (typeof window === 'undefined') return 'http://127.0.0.1:8188';
    // Use relative URL to go through Vite proxy
    return '/comfyui';
  }
  
  private readonly DEFAULT_ENDPOINTS = {
    comfyui: 'http://127.0.0.1:8188',
    automatic1111: 'http://127.0.0.1:7860',
    ollama: 'http://127.0.0.1:11434',
  };

  public static getInstance(): LocalImageGeneratorService {
    if (!LocalImageGeneratorService.instance) {
      LocalImageGeneratorService.instance = new LocalImageGeneratorService();
    }
    return LocalImageGeneratorService.instance;
  }

  /**
   * Clear the image generation cache
   */
  clearCache(): void {
    logger.log('IMAGE_GENERATOR', 'Clearing image cache', 'info');
    cacheService.clear();
  }

  /**
   * Initialize and detect available local image generation providers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.log('IMAGE_GENERATOR', 'Initializing local image generation service...', 'info');

    // Detect ComfyUI
    await this.detectComfyUI();
    
    // Detect AUTOMATIC1111
    await this.detectAutomatic1111();
    
    // Detect Ollama image generation (experimental, macOS only currently)
    await this.detectOllamaImageGen();

    const availableProviders = Array.from(this.providers.values()).filter(p => p.available);
    
    if (availableProviders.length === 0) {
      logger.log('IMAGE_GENERATOR', 
        'No local image generation providers detected. ' +
        'Install ComfyUI or AUTOMATIC1111 for high-quality image generation.', 'warning');
    } else {
      logger.log('IMAGE_GENERATOR', 
        `Detected ${availableProviders.length} provider(s): ${availableProviders.map(p => p.name).join(', ')}`, 
        'success');
    }

    this.isInitialized = true;
  }

  /**
   * Detect ComfyUI instance
   */
  private async detectComfyUI(): Promise<void> {
    // Use proxy URL in browser to avoid CORS, direct URL in Node/non-browser
    const url = this.getSetting('comfyui_url') || this.getComfyUIEndpoint();
    
    try {
      logger.log('IMAGE_GENERATOR', `Detecting ComfyUI at ${url}...`, 'info');
      
      const response = await fetch(`${url}/system_stats`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = await this.getComfyUIModels(url);
        
        this.providers.set('comfyui', {
          name: 'ComfyUI',
          type: 'comfyui',
          url,
          available: true,
          models
        });
        
        logger.log('IMAGE_GENERATOR', 
          `ComfyUI detected at ${url} with ${models.length} model(s): ${models.join(', ')}`, 
          'success');
      } else {
        logger.log('IMAGE_GENERATOR', 
          `ComfyUI returned status ${response.status}`, 'warning');
        this.providers.set('comfyui', {
          name: 'ComfyUI',
          type: 'comfyui',
          url,
          available: false,
          models: []
        });
      }
    } catch (error) {
      logger.log('IMAGE_GENERATOR', 
        `ComfyUI not detected at ${url}: ${(error as Error).message}. ` +
        `Make sure ComfyUI is running with --cors-header`, 'warning');
      this.providers.set('comfyui', {
        name: 'ComfyUI',
        type: 'comfyui',
        url,
        available: false,
        models: []
      });
    }
  }

  /**
   * Get available models from ComfyUI
   * Prefers SDXL models over SD 3.5 for better compatibility
   */
  private async getComfyUIModels(url: string): Promise<string[]> {
    try {
      const response = await fetch(`${url}/object_info/CheckpointLoaderSimple`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
        
        // Sort models to prefer SDXL over SD 3.5 (better out-of-box compatibility)
        return models.sort((a: string, b: string) => {
          const aIsSD3 = a.toLowerCase().includes('sd3');
          const bIsSD3 = b.toLowerCase().includes('sd3');
          const aIsSDXL = a.toLowerCase().includes('xl') || a.toLowerCase().includes('sdxl');
          const bIsSDXL = b.toLowerCase().includes('xl') || b.toLowerCase().includes('sdxl');
          
          // Prefer SDXL over SD 3.5
          if (aIsSDXL && bIsSD3) return -1;
          if (aIsSD3 && bIsSDXL) return 1;
          return 0;
        });
      }
    } catch (error) {
      logger.log('IMAGE_GENERATOR', `Failed to get ComfyUI models: ${error}`, 'warning');
    }
    return [];
  }

  /**
   * Detect AUTOMATIC1111 WebUI
   */
  private async detectAutomatic1111(): Promise<void> {
    const url = this.getSetting('automatic1111_url') || this.DEFAULT_ENDPOINTS.automatic1111;
    
    try {
      const response = await fetch(`${url}/sdapi/v1/sd-models`, { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const models = await response.json();
        this.providers.set('automatic1111', {
          name: 'AUTOMATIC1111',
          type: 'automatic1111',
          url,
          available: true,
          models: models.map((m: any) => m.model_name) || []
        });
        logger.log('IMAGE_GENERATOR', `AUTOMATIC1111 detected at ${url} with ${models.length} models`, 'success');
      }
    } catch (error) {
      this.providers.set('automatic1111', {
        name: 'AUTOMATIC1111',
        type: 'automatic1111',
        url,
        available: false,
        models: []
      });
    }
  }

  /**
   * Detect Ollama image generation capability (experimental)
   */
  private async detectOllamaImageGen(): Promise<void> {
    const url = this.getSetting('ollama_url') || this.DEFAULT_ENDPOINTS.ollama;
    
    try {
      // Check if Ollama has image generation models
      const response = await fetch(`${url}/api/tags`, { 
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const imageModels = data.models?.filter((m: any) => 
          m.name.includes('z-image') || 
          m.name.includes('flux') ||
          m.name.includes('gemma3') // Gemma 3 has image gen
        ) || [];
        
        if (imageModels.length > 0) {
          this.providers.set('ollama', {
            name: 'Ollama (Image Gen)',
            type: 'ollama',
            url,
            available: true,
            models: imageModels.map((m: any) => m.name)
          });
          logger.log('IMAGE_GENERATOR', `Ollama image generation available with ${imageModels.length} models`, 'success');
        }
      }
    } catch (error) {
      // Ollama not available or no image models
    }
  }

  /**
   * Generate an image using local providers
   */
  async generateImage(
    prompt: string, 
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage> {
    await this.initialize();

    const { 
      format = 'png', 
      width = 1024, 
      height = 1024,
      model = 'default',
      steps = 20,
      seed,  // Allow user to specify seed for reproducibility
      imageInput // For img2img - base64 of input image
    } = options as any;
    
    // ALWAYS skip cache for img2img or when user explicitly wants new image (seed=0)
    // For txt2img, only use cache if seed is explicitly provided
    const skipCache = imageInput !== undefined || seed === 0 || seed === undefined;
    const cacheKey = this.getCacheKey(prompt, options);
    
    if (!skipCache) {
      const cached = cacheService.get<GeneratedImage>(cacheKey);
      if (cached) {
        logger.log('IMAGE_GENERATOR', `Cache hit for: "${prompt.slice(0, 50)}..."`, 'info');
        return cached;
      }
    }
    
    // Ensure random seed for unique generations unless specified
    if (seed === undefined) {
      (options as any).seed = Math.floor(Math.random() * 2147483647);
      logger.log('IMAGE_GENERATOR', `Using random seed: ${(options as any).seed}`);
    }

    // Get available provider
    const provider = this.getBestAvailableProvider();
    logger.log('IMAGE_GENERATOR', `Selected provider: ${provider?.name || 'NONE'}`);
    
    if (!provider) {
      logger.log('IMAGE_GENERATOR', 'No local image providers available, using SVG fallback', 'warning');
      return this.generateSVGFallback(prompt, width, height, options);
    }

    try {
      logger.log('IMAGE_GENERATOR', 
        `Generating image with ${provider.name}: "${prompt.slice(0, 50)}..."`, 'info');
      
      const startTime = Date.now();
      let result: GeneratedImage;

      switch (provider.type) {
        case 'comfyui':
          result = await this.generateWithComfyUI(prompt, options, provider);
          break;
        case 'automatic1111':
          result = await this.generateWithAutomatic1111(prompt, options, provider);
          break;
        case 'ollama':
          result = await this.generateWithOllama(prompt, options, provider);
          break;
        default:
          throw new Error(`Unknown provider type: ${provider.type}`);
      }

      // Add metadata
      result.metadata = {
        ...result.metadata,
        generationTime: Date.now() - startTime,
        model: model !== 'default' ? model : provider.models[0]
      };

      // Cache the result
      cacheService.set(cacheKey, result, 3600000); // 1 hour cache
      
      logger.log('IMAGE_GENERATOR', 
        `Image generated in ${result.metadata.generationTime}ms`, 'success');
      
      return result;

    } catch (error) {
      logger.log('IMAGE_GENERATOR', 
        `Generation failed: ${(error as Error).message}, using fallback`, 'error');
      logger.log('IMAGE_GENERATOR', 
        `Error stack: ${(error as Error).stack}`, 'error');
      return this.generateSVGFallback(prompt, width, height, options);
    }
  }

  /**
   * Generate image using ComfyUI
   */
  private async generateWithComfyUI(
    prompt: string,
    options: ImageGenerationOptions,
    provider: LocalImageProvider
  ): Promise<GeneratedImage> {
    try {
      // Check if img2img was requested
      const isImg2Img = !!(options as any).imageInput;
      logger.log('IMAGE_GENERATOR', `generateWithComfyUI started: isImg2Img=${isImg2Img}`);
      
      // Use proxy URL in browser to avoid CORS
      const baseUrl = typeof window !== 'undefined' ? '/comfyui' : provider.url;
      logger.log('IMAGE_GENERATOR', `Using baseUrl: ${baseUrl}`);
    
    // For img2img, we need to upload the image first
    let uploadedImageName: string | null = null;
    if (isImg2Img && (options as any).imageInput) {
      try {
        logger.log('IMAGE_GENERATOR', `Attempting to upload image for img2img to ${baseUrl}...`);
        uploadedImageName = await this.uploadImageToComfyUI(baseUrl, (options as any).imageInput);
        logger.log('IMAGE_GENERATOR', `Successfully uploaded image for img2img: ${uploadedImageName}`);
      } catch (uploadError) {
        logger.log('IMAGE_GENERATOR', `Failed to upload image for img2img: ${(uploadError as Error).message}`, 'error');
        logger.log('IMAGE_GENERATOR', `Upload error stack: ${(uploadError as Error).stack}`, 'error');
        // Fall back to txt2img if upload fails
      }
    } else {
      logger.log('IMAGE_GENERATOR', `Skipping upload: isImg2Img=${isImg2Img}, hasImageInput=${!!(options as any).imageInput}`);
    }
    
    // ComfyUI requires a workflow - build appropriate workflow (txt2img or img2img)
    const workflow = this.buildComfyUIWorkflow(prompt, options, uploadedImageName);
    
    // Determine output node based on workflow type
    const outputNode = isImg2Img && uploadedImageName ? "8" : "7";  // img2img uses node 8, txt2img uses node 7
    
    // Queue the prompt
    // ComfyUI requires explicit output specification
    const requestBody = {
      prompt: workflow,
      outputs: {
        [outputNode]: ["images"]  // Node 7 or 8 (SaveImage) outputs images
      }
    };
    
    const queueResponse = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!queueResponse.ok) {
      throw new Error(`ComfyUI queue failed: ${await queueResponse.text()}`);
    }

    const { prompt_id } = await queueResponse.json();
    logger.log('IMAGE_GENERATOR', `Queued prompt with ID: ${prompt_id}`);
    
    // Poll for completion (use same baseUrl for proxy)
    logger.log('IMAGE_GENERATOR', `Starting to poll for result from ${baseUrl}...`);
    const imageData = await this.pollComfyUIResult(baseUrl, prompt_id, 180, outputNode);
    logger.log('IMAGE_GENERATOR', `Poll complete, got image data: ${imageData.length} chars`);
    
    return {
      url: `data:image/png;base64,${imageData}`,
      base64: imageData,
      format: 'png',
      prompt,
      created: Date.now(),
      metadata: {
        width: options.width,
        height: options.height,
        steps: options.steps
      }
    };
    } catch (error) {
      logger.log('IMAGE_GENERATOR', `generateWithComfyUI failed: ${(error as Error).message}`, 'error');
      logger.log('IMAGE_GENERATOR', `Stack: ${(error as Error).stack}`, 'error');
      throw error;
    }
  }

  /**
   * Upload an image to ComfyUI for use in workflows
   */
  private async uploadImageToComfyUI(baseUrl: string, base64Image: string): Promise<string> {
    try {
      logger.log('IMAGE_GENERATOR', `Starting image upload to ${baseUrl}/upload/image, base64 length: ${base64Image.length}`);
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      logger.log('IMAGE_GENERATOR', `Created blob: ${blob.size} bytes`);
      
      // Create form data
      const formData = new FormData();
      formData.append('image', blob, 'input_image.png');
      formData.append('type', 'input');
      
      // Upload to ComfyUI
      logger.log('IMAGE_GENERATOR', `Sending POST request to ${baseUrl}/upload/image...`);
      const response = await fetch(`${baseUrl}/upload/image`, {
        method: 'POST',
        body: formData
      });
      
      logger.log('IMAGE_GENERATOR', `Upload response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      logger.log('IMAGE_GENERATOR', `Upload response data: ${JSON.stringify(data)}`);
      return data.name || 'input_image.png';
    } catch (error) {
      logger.log('IMAGE_GENERATOR', `Upload exception: ${(error as Error).message}`, 'error');
      throw error;
    }
  }

  /**
   * Build a ComfyUI workflow for text2img or img2img
   * Optimized for 11GB VRAM (GTX 1080 Ti and similar cards)
   * Supports SD 3.5 Medium and standard SDXL/SD 1.5 models
   */
  private buildComfyUIWorkflow(prompt: string, options: ImageGenerationOptions & { imageInput?: string }, uploadedImageName?: string | null): any {
    // Default to 768x768 for better stability on GTX 1080 Ti
    // 1024x1024 can work but may have VAE issues with some models
    // 768x768 is safer and faster
    let { width = 768, height = 768, steps = 20, seed } = options;
    
    // Clamp to maximum safe resolution for 11GB VRAM
    const MAX_SAFE_SIZE = 1024;
    if (width > MAX_SAFE_SIZE || height > MAX_SAFE_SIZE) {
      logger.log('IMAGE_GENERATOR', 
        `Clamping resolution ${width}x${height} to ${MAX_SAFE_SIZE}x${MAX_SAFE_SIZE} for 11GB VRAM safety`, 
        'warning');
      width = Math.min(width, MAX_SAFE_SIZE);
      height = Math.min(height, MAX_SAFE_SIZE);
    }
    
    // Warn if using 1024x1024 - may have VAE issues
    if (width >= 1024 && height >= 1024) {
      logger.log('IMAGE_GENERATOR', 'Using 1024x1024 - if black images occur, try 768x768', 'warning');
    }
    
    // Get available models from provider
    const comfyProvider = this.providers.get('comfyui');
    const availableModels = comfyProvider?.models || [];
    
    // Model priority order (most reliable first)
    // SD 1.5-based models are smaller and more reliable than SDXL
    const preferredModels = [
      'dreamshaper_8.safetensors',               // SD 1.5, 4GB, excellent quality
      'realisticVisionV51_v51VAE.safetensors',   // SD 1.5, 2GB, very reliable
      'v1-5-pruned-emaonly.safetensors',         // Standard SD 1.5
      'sd_xl_base_1.0.safetensors',              // SDXL Base, 6.5GB
    ];
    
    // Default model selection - prefer smaller, more reliable models
    let modelName = options.model;
    
    if (!modelName) {
      // Auto-select best available model
      for (const preferred of preferredModels) {
        if (availableModels.some(m => m.toLowerCase() === preferred.toLowerCase())) {
          modelName = preferred;
          break;
        }
      }
      // Fallback to first available if none of preferred found
      if (!modelName && availableModels.length > 0) {
        modelName = availableModels[0];
      }
      // Ultimate fallback
      if (!modelName) {
        modelName = 'sd_xl_base_1.0.safetensors';
      }
    }
    
    // Auto-fallback from SD 3.5 to SDXL/SD1.5 (SD 3.5 requires CLIP models that cause hangs)
    if (modelName.toLowerCase().includes('sd3') && !modelName.toLowerCase().includes('xl')) {
      const hasReliable = availableModels.some(m => 
        m.toLowerCase().includes('vision') || 
        m.toLowerCase().includes('1-5') ||
        m.toLowerCase().includes('xl')
      );
      if (hasReliable) {
        logger.log('IMAGE_GENERATOR', `SD 3.5 requires CLIP models - using alternative`, 'warning');
        // Prefer smaller models
        modelName = availableModels.find(m => m.toLowerCase().includes('vision')) ||
                   availableModels.find(m => m.toLowerCase().includes('xl')) ||
                   'sd_xl_base_1.0.safetensors';
      }
    }
    
    // Detect model type for workflow tuning
    const isSDXL = modelName.toLowerCase().includes('xl') || modelName.toLowerCase().includes('xl_base');
    const isSD15 = modelName.toLowerCase().includes('1-5') || 
                   modelName.toLowerCase().includes('vision') ||
                   modelName.toLowerCase().includes('dreamshaper') ||
                   modelName.toLowerCase().includes('shaper');
    
    // Check if this is img2img (has uploaded image)
    const isImg2Img = !!uploadedImageName;
    
    if (isImg2Img) {
      logger.log('IMAGE_GENERATOR', `Using img2img workflow for ${modelName} with ${uploadedImageName}`, 'info');
    } else if (isSDXL) {
      logger.log('IMAGE_GENERATOR', `Using SDXL txt2img workflow for ${modelName}`, 'info');
    } else if (isSD15) {
      logger.log('IMAGE_GENERATOR', `Using SD 1.5 txt2img workflow for ${modelName} (recommended for reliability)`, 'info');
    } else {
      logger.log('IMAGE_GENERATOR', `Using model: ${modelName}`, 'info');
    }
    
    // For img2img, we need to use VAEEncode with the input image
    // For txt2img, we use EmptyLatentImage
    if (isImg2Img) {
      // img2img workflow - transform existing image
      return {
        "1": {
          "inputs": { "ckpt_name": modelName },
          "class_type": "CheckpointLoaderSimple"
        },
        "2": {
          "inputs": { 
            "text": prompt,
            "clip": ["1", 1]
          },
          "class_type": "CLIPTextEncode"
        },
        "3": {
          "inputs": {
            "text": options.negativePrompt || "low quality, blurry, distorted, messy, cluttered",
            "clip": ["1", 1]
          },
          "class_type": "CLIPTextEncode"
        },
        "4": {
          "inputs": { 
            "image": uploadedImageName  // Use uploaded image filename
          },
          "class_type": "LoadImage"
        },
        "5": {
          "inputs": {
            "pixels": ["4", 0],
            "vae": ["1", 2]
          },
          "class_type": "VAEEncode"
        },
        "6": {
          "inputs": {
            "seed": seed || Math.floor(Math.random() * 2147483647),
            "steps": isSD15 ? Math.min(steps, 25) : steps,
            "cfg": isSD15 ? 7 : 8,
            "sampler_name": "dpmpp_2m",
            "scheduler": "karras",
            "denoise": 0.75,  // Partial denoise for img2img (0.75 = keep 25% of original)
            "model": ["1", 0],
            "positive": ["2", 0],
            "negative": ["3", 0],
            "latent_image": ["5", 0]
          },
          "class_type": "KSampler"
        },
        "7": {
          "inputs": { 
            "samples": ["6", 0], 
            "vae": ["1", 2]
          },
          "class_type": "VAEDecode"
        },
        "8": {
          "inputs": { 
            "filename_prefix": "JARVIS_img2img", 
            "images": ["7", 0] 
          },
          "class_type": "SaveImage"
        }
      };
    }
    
    // txt2img workflow - generate from scratch
    return {
      "1": {
        "inputs": { 
          "ckpt_name": modelName 
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "2": {
        "inputs": { 
          "text": prompt,
          "clip": ["1", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "3": {
        "inputs": {
          "text": options.negativePrompt || "low quality, blurry, distorted",
          "clip": ["1", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "4": {
        "inputs": {
          "width": width,
          "height": height,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "5": {
        "inputs": {
          "seed": seed || Math.floor(Math.random() * 2147483647),
          "steps": isSD15 ? Math.min(steps, 25) : steps,  // SD 1.5 converges faster
          "cfg": isSD15 ? 7 : 8,  // SD 1.5 works better with CFG 7
          "sampler_name": "dpmpp_2m",
          "scheduler": "karras",
          "denoise": 1.0,
          "model": ["1", 0],
          "positive": ["2", 0],
          "negative": ["3", 0],
          "latent_image": ["4", 0]
        },
        "class_type": "KSampler"
      },
      "6": {
        "inputs": { 
          "samples": ["5", 0], 
          "vae": ["1", 2]
        },
        "class_type": "VAEDecode"
      },
      "7": {
        "inputs": { 
          "filename_prefix": "JARVIS", 
          "images": ["6", 0] 
        },
        "class_type": "SaveImage"
      }
    };
  }

  /**
   * Poll ComfyUI for generation result
   * Extended timeout for GTX 1080 Ti and similar GPUs (can take 60-120 seconds for 1024x1024)
   */
  private async pollComfyUIResult(url: string, promptId: string, maxAttempts = 180, outputNode: string = "7"): Promise<string> {
    let lastProgress = 0;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 1000));
      
      try {
        // Check queue status first
        const queueResponse = await fetch(`${url}/queue`);
        const queueData = await queueResponse.json();
        
        // Check if our job is still running
        const isRunning = queueData.queue_running?.some((job: any) => job[1] === promptId);
        const isPending = queueData.queue_pending?.some((job: any) => job[1] === promptId);
        
        if (isRunning && attempt > 30 && attempt % 10 === 0) {
          logger.log('IMAGE_GENERATOR', `Generation in progress... (${attempt}s elapsed)`, 'info');
        }
        
        // Check history for completion
        const historyResponse = await fetch(`${url}/history/${promptId}`);
        const history = await historyResponse.json();
        
        if (history[promptId]?.outputs) {
          // Get the image from outputs
          const outputs = history[promptId].outputs;
          logger.log('IMAGE_GENERATOR', `Found outputs in history: ${Object.keys(outputs).join(', ')} (looking for node ${outputNode})`);
          
          // Try to get image from specified output node first
          let imageInfo = null;
          let outputNodeId = '';
          
          // First check the specified output node
          if (outputs[outputNode]?.images?.[0]) {
            imageInfo = outputs[outputNode].images[0];
            outputNodeId = outputNode;
            logger.log('IMAGE_GENERATOR', `Found image in specified node ${outputNode}`);
          } else {
            // Fallback: find any node with images
            for (const [nodeId, nodeData] of Object.entries(outputs)) {
              const node = nodeData as any;
              if (node?.images?.[0]) {
                imageInfo = node.images[0];
                outputNodeId = nodeId;
                logger.log('IMAGE_GENERATOR', `Found image in fallback node ${nodeId}`);
                break;
              }
            }
          }
          
          if (imageInfo) {
            logger.log('IMAGE_GENERATOR', `Found image in node ${outputNodeId}: ${JSON.stringify(imageInfo)}`);
            logger.log('IMAGE_GENERATOR', `Image generated in ${attempt} seconds`, 'success');
            
            // Small delay to ensure file is fully written to disk
            logger.log('IMAGE_GENERATOR', `Waiting 500ms for file to be fully written...`);
            await new Promise(r => setTimeout(r, 500));
            
            const imageUrl = `${url}/view?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=${encodeURIComponent(imageInfo.subfolder || '')}&type=output`;
            logger.log('IMAGE_GENERATOR', `Fetching image from: ${imageUrl.substring(0, 100)}...`);
            
            try {
              const imageResponse = await fetch(imageUrl);
              
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
              }
              
              const blob = await imageResponse.blob();
              logger.log('IMAGE_GENERATOR', `Got blob: ${blob.size} bytes, type: ${blob.type}`);
              
              // Convert blob to base64 using FileReader (more reliable for large files)
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64data = (reader.result as string).split(',')[1];
                  resolve(base64data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              
              const imageSizeKB = base64.length * 0.75 / 1024; // Approximate size
              logger.log('IMAGE_GENERATOR', `Image fetched: ${imageSizeKB.toFixed(1)} KB`);
              
              // Detect black/empty images (typically < 15 KB for 768x768)
              if (imageSizeKB < 10) {
                logger.log('IMAGE_GENERATOR', `WARNING: Image appears to be black/empty (${imageSizeKB.toFixed(1)} KB). This may indicate a VAE issue.`, 'warning');
              }
              
              return base64;
            } catch (fetchError) {
              logger.log('IMAGE_GENERATOR', `Failed to fetch image: ${(fetchError as Error).message}`, 'error');
              throw fetchError;
            }
          } else {
            logger.log('IMAGE_GENERATOR', `Output node has no images: ${JSON.stringify(outputNode)}`, 'warning');
          }
        }
        
        // Check for errors
        if (history[promptId]?.status?.status_str === 'error') {
          throw new Error(`ComfyUI generation failed: ${JSON.stringify(history[promptId].status)}`);
        }
        
        // If job is neither running, pending, nor in history with output, something went wrong
        if (!isRunning && !isPending && !history[promptId]) {
          throw new Error('Job lost from queue - may have crashed');
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('failed')) {
          throw error;
        }
        // Continue polling on other errors
      }
    }
    
    throw new Error(`ComfyUI generation timed out after ${maxAttempts} seconds. Your GPU may be too slow for this model/resolution.`);
  }

  /**
   * Generate image using AUTOMATIC1111
   */
  private async generateWithAutomatic1111(
    prompt: string,
    options: ImageGenerationOptions,
    provider: LocalImageProvider
  ): Promise<GeneratedImage> {
    // Default to 768x768 for 11GB VRAM safety
    // SDXL/SD 3.5 Medium: 1024x1024 works but may be slower
    // SD 1.5: 768x768 is a good balance of quality/speed
    let { width = 768, height = 768, steps = 20, seed } = options;
    
    // Clamp to safe resolution for 11GB VRAM
    // SDXL can do 1024x1024 on 11GB with --medvram flag
    // But 768x768 is safer and faster
    const MAX_SAFE_SIZE = 1024;
    if (width > MAX_SAFE_SIZE || height > MAX_SAFE_SIZE) {
      logger.log('IMAGE_GENERATOR', 
        `Clamping A1111 resolution to ${MAX_SAFE_SIZE} for 11GB VRAM safety`, 
        'warning');
      width = Math.min(width, MAX_SAFE_SIZE);
      height = Math.min(height, MAX_SAFE_SIZE);
    }
    
    // A1111 works best with multiples of 64
    const adjustedWidth = Math.floor(width / 64) * 64;
    const adjustedHeight = Math.floor(height / 64) * 64;

    const response = await fetch(`${provider.url}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: options.negativePrompt || '',
        width: adjustedWidth,
        height: adjustedHeight,
        steps,
        seed: seed || -1,
        cfg_scale: 7,
        sampler_name: 'DPM++ 2M Karras',
        batch_size: 1,
        n_iter: 1
      })
    });

    if (!response.ok) {
      throw new Error(`A1111 generation failed: ${await response.text()}`);
    }

    const data = await response.json();
    const base64Image = data.images[0];

    return {
      url: `data:image/png;base64,${base64Image}`,
      base64: base64Image,
      format: 'png',
      prompt,
      created: Date.now(),
      metadata: { width: adjustedWidth, height: adjustedHeight, steps, seed }
    };
  }

  /**
   * Generate image using Ollama (experimental)
   */
  private async generateWithOllama(
    prompt: string,
    options: ImageGenerationOptions,
    provider: LocalImageProvider
  ): Promise<GeneratedImage> {
    const model = options.model || provider.models[0] || 'x/z-image-turbo';
    
    const response = await fetch(`${provider.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama generation failed: ${await response.text()}`);
    }

    // Ollama saves images to disk - we'd need to read them back
    // This is a simplified implementation
    const data = await response.json();
    
    // For now, return a placeholder - actual implementation would read the file
    throw new Error('Ollama image generation requires file system access - use ComfyUI or A1111 instead');
  }

  /**
   * Generate high-quality SVG fallback
   */
  private generateSVGFallback(
    prompt: string, 
    width: number, 
    height: number,
    options: ImageGenerationOptions
  ): GeneratedImage {
    const lowerPrompt = prompt.toLowerCase();
    const isTechnical = options.style === 'technical' || 
                       /diagram|schematic|blueprint|plan|layout/i.test(prompt);
    
    let svg: string;
    
    if (isTechnical) {
      svg = this.generateTechnicalDiagram(prompt, width, height);
    } else if (lowerPrompt.includes('portrait') || lowerPrompt.includes('person')) {
      svg = this.generatePortraitSVG(width, height, options);
    } else if (lowerPrompt.includes('landscape') || lowerPrompt.includes('nature')) {
      svg = this.generateLandscapeSVG(width, height, prompt, options);
    } else {
      svg = this.generateAbstractSVG(width, height, prompt, options);
    }

    return {
      url: `data:image/svg+xml;base64,${btoa(svg)}`,
      svg,
      format: 'svg',
      prompt,
      created: Date.now(),
      metadata: { width, height }
    };
  }

  /**
   * Generate technical diagram SVG
   */
  private generateTechnicalDiagram(prompt: string, w: number, h: number): string {
    const isWorkshop = /workshop|garage|woodworking/i.test(prompt);
    const isElectrical = /electrical|circuit|wiring/i.test(prompt);
    const isFloorPlan = /floor.?plan|layout|room/i.test(prompt);
    
    if (isWorkshop) {
      return this.generateWorkshopDiagram(w, h);
    }
    if (isElectrical) {
      return this.generateElectricalDiagram(w, h);
    }
    if (isFloorPlan) {
      return this.generateFloorPlan(w, h);
    }
    
    // Generic technical diagram
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e3a5f" stroke-width="0.5" opacity="0.3"/>
        </pattern>
      </defs>
      <rect width="${w}" height="${h}" fill="#0f172a"/>
      <rect width="${w}" height="${h}" fill="url(#grid)"/>
      <text x="${w/2}" y="40" text-anchor="middle" fill="#06b6d4" font-size="18" font-weight="bold">TECHNICAL DIAGRAM</text>
      <text x="${w/2}" y="70" text-anchor="middle" fill="#64748b" font-size="12">${prompt.slice(0, 60)}</text>
      <rect x="${w*0.2}" y="${h*0.3}" width="${w*0.6}" height="${h*0.4}" fill="none" stroke="#06b6d4" stroke-width="2" rx="4"/>
      <text x="${w/2}" y="${h/2}" text-anchor="middle" fill="#06b6d4" font-size="14">Diagram View</text>
    </svg>`;
  }

  private generateWorkshopDiagram(w: number, h: number): string {
    // ... (similar to existing workshop layout but enhanced)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e3a5f" stroke-width="0.5" opacity="0.3"/>
        </pattern>
        <linearGradient id="benchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8B4513"/>
          <stop offset="100%" stop-color="#654321"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="#0f172a"/>
      <rect width="${w}" height="${h}" fill="url(#grid)"/>
      
      <text x="${w/2}" y="35" text-anchor="middle" fill="#06b6d4" font-size="20" font-weight="bold">WORKSHOP LAYOUT PLAN</text>
      <text x="${w/2}" y="55" text-anchor="middle" fill="#64748b" font-size="11">Scale: 1:24 (1/2" = 1') | Typical 2-Car Garage (20' × 24')</text>
      
      <!-- Room outline -->
      <rect x="${w*0.1}" y="${h*0.15}" width="${w*0.8}" height="${h*0.7}" fill="none" stroke="#94a3b8" stroke-width="3"/>
      
      <!-- Workbench -->
      <rect x="${w*0.15}" y="${h*0.3}" width="${w*0.35}" height="${h*0.15}" fill="url(#benchGrad)" stroke="#d4a574" stroke-width="2" rx="2"/>
      <text x="${w*0.325}" y="${h*0.38}" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">MAIN WORKBENCH</text>
      <text x="${w*0.325}" y="${h*0.41}" text-anchor="middle" fill="#aaa" font-size="9">7' × 2.5'</text>
      
      <!-- Tool Cabinet -->
      <rect x="${w*0.55}" y="${h*0.3}" width="${w*0.12}" height="${h*0.25}" fill="#475569" stroke="#64748b" stroke-width="2"/>
      <text x="${w*0.61}" y="${h*0.43}" text-anchor="middle" fill="#94a3b8" font-size="9">TOOL CABINET</text>
      
      <!-- Pegboard -->
      <rect x="${w*0.72}" y="${h*0.25}" width="${w*0.15}" height="${h*0.3}" fill="#1e293b" stroke="#475569" stroke-width="2"/>
      <text x="${w*0.795}" y="${h*0.41}" text-anchor="middle" fill="#94a3b8" font-size="9">PEGBOARD</text>
      
      <!-- Lumber Storage -->
      <rect x="${w*0.15}" y="${h*0.55}" width="${w*0.4}" height="${h*0.08}" fill="#5c4033" stroke="#8b6914" stroke-width="2"/>
      <text x="${w*0.35}" y="${h*0.595}" text-anchor="middle" fill="#d4a574" font-size="9">LUMBER STORAGE RACK</text>
      
      <!-- Dust Collector -->
      <circle cx="${w*0.8}" cy="${h*0.7}" r="25" fill="#374151" stroke="#f59e0b" stroke-width="2"/>
      <text x="${w*0.8}" y="${h*0.705}" text-anchor="middle" fill="#f59e0b" font-size="8">DUST</text>
      
      <!-- Dimensions -->
      <line x1="${w*0.1}" y1="${h*0.87}" x2="${w*0.9}" y2="${h*0.87}" stroke="#64748b" stroke-width="1"/>
      <line x1="${w*0.1}" y1="${h*0.86}" x2="${w*0.1}" y2="${h*0.88}" stroke="#64748b"/>
      <line x1="${w*0.9}" y1="${h*0.86}" x2="${w*0.9}" y2="${h*0.88}" stroke="#64748b"/>
      <text x="${w/2}" y="${h*0.9}" text-anchor="middle" fill="#64748b" font-size="10">24 feet</text>
    </svg>`;
  }

  private generateElectricalDiagram(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#0f172a"/>
      <text x="${w/2}" y="40" text-anchor="middle" fill="#f59e0b" font-size="18" font-weight="bold">ELECTRICAL SCHEMATIC</text>
      <!-- Electrical symbols -->
      <circle cx="${w*0.3}" cy="${h*0.3}" r="20" fill="none" stroke="#f59e0b" stroke-width="2"/>
      <text x="${w*0.3}" y="${h*0.35}" text-anchor="middle" fill="#f59e0b" font-size="10">AC</text>
      <line x1="${w*0.3}" y1="${h*0.5}" x2="${w*0.3}" y2="${h*0.7}" stroke="#f59e0b" stroke-width="2"/>
      <rect x="${w*0.25}" y="${h*0.7}" width="${w*0.1}" height="30" fill="none" stroke="#f59e0b" stroke-width="2"/>
      <text x="${w*0.3}" y="${h*0.77}" text-anchor="middle" fill="#f59e0b" font-size="8">LOAD</text>
    </svg>`;
  }

  private generateFloorPlan(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#0f172a"/>
      <text x="${w/2}" y="40" text-anchor="middle" fill="#10b981" font-size="18" font-weight="bold">FLOOR PLAN</text>
      <rect x="${w*0.2}" y="${h*0.2}" width="${w*0.6}" height="${h*0.6}" fill="none" stroke="#10b981" stroke-width="3"/>
      <line x1="${w*0.5}" y1="${h*0.2}" x2="${w*0.5}" y2="${h*0.8}" stroke="#10b981" stroke-width="1"/>
      <line x1="${w*0.2}" y1="${h*0.5}" x2="${w*0.8}" y2="${h*0.5}" stroke="#10b981" stroke-width="1"/>
      <text x="${w*0.35}" y="${h*0.35}" text-anchor="middle" fill="#10b981" font-size="12">Room 1</text>
      <text x="${w*0.65}" y="${h*0.35}" text-anchor="middle" fill="#10b981" font-size="12">Room 2</text>
      <text x="${w*0.35}" y="${h*0.65}" text-anchor="middle" fill="#10b981" font-size="12">Room 3</text>
      <text x="${w*0.65}" y="${h*0.65}" text-anchor="middle" fill="#10b981" font-size="12">Room 4</text>
    </svg>`;
  }

  private generatePortraitSVG(w: number, h: number, options: ImageGenerationOptions): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#bgGrad)"/>
      <circle cx="${w/2}" cy="${h/2 - 50}" r="100" fill="url(#skinGrad)" opacity="0.8"/>
      <ellipse cx="${w/2 - 30}" cy="${h/2 - 60}" rx="15" ry="20" fill="#000" opacity="0.4"/>
      <ellipse cx="${w/2 + 30}" cy="${h/2 - 60}" rx="15" ry="20" fill="#000" opacity="0.4"/>
      <path d="M ${w/2 - 25} ${h/2 - 20} Q ${w/2} ${h/2 + 10} ${w/2 + 25} ${h/2 - 20}" stroke="#000" stroke-width="3" fill="none" opacity="0.3"/>
      <text x="${w/2}" y="${h - 40}" text-anchor="middle" fill="#64748b" font-size="12">AI Portrait (SVG Fallback)</text>
    </svg>`;
  }

  private generateLandscapeSVG(w: number, h: number, prompt: string, options: ImageGenerationOptions): string {
    const hasMountains = prompt.toLowerCase().includes('mountain');
    const hasWater = prompt.toLowerCase().includes('water') || prompt.toLowerCase().includes('ocean');
    
    let landscape = '';
    if (hasMountains) {
      landscape += `<path d="M 0 ${h} L ${w*0.25} ${h*0.4} L ${w*0.5} ${h*0.6} L ${w*0.75} ${h*0.3} L ${w} ${h*0.5} L ${w} ${h} Z" fill="#1e3a5f" opacity="0.8"/>`;
    }
    if (hasWater) {
      landscape += `<rect x="0" y="${h*0.7}" width="${w}" height="${h*0.3}" fill="#06b6d4" opacity="0.3"/>`;
    }
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#skyGrad)"/>
      ${landscape}
      <text x="${w/2}" y="${h - 30}" text-anchor="middle" fill="#64748b" font-size="12">AI Landscape (SVG Fallback)</text>
    </svg>`;
  }

  private generateAbstractSVG(w: number, h: number, prompt: string, options: ImageGenerationOptions): string {
    const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    let shapes = '';
    
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 30 + Math.random() * 120;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const opacity = 0.2 + Math.random() * 0.4;
      
      if (Math.random() > 0.5) {
        shapes += `<circle cx="${x}" cy="${y}" r="${size}" fill="${color}" opacity="${opacity}"/>`;
      } else {
        shapes += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="${opacity}" rx="${size/4}"/>`;
      }
    }
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#0f172a"/>
      ${shapes}
      <text x="${w/2}" y="${h - 30}" text-anchor="middle" fill="#64748b" font-size="12">AI Generated (SVG Fallback)</text>
    </svg>`;
  }

  /**
   * Get the best available provider
   */
  private getBestAvailableProvider(): LocalImageProvider | null {
    const providers = Array.from(this.providers.values()).filter(p => p.available);
    if (providers.length === 0) return null;
    
    // Prefer ComfyUI, then A1111, then Ollama
    const priority = ['comfyui', 'automatic1111', 'ollama'];
    for (const type of priority) {
      const provider = providers.find(p => p.type === type);
      if (provider) return provider;
    }
    
    return providers[0];
  }

  /**
   * Get all available providers
   */
  getProviders(): LocalImageProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if any image generation provider is available
   */
  hasProvider(): boolean {
    return Array.from(this.providers.values()).some(p => p.available);
  }

  /**
   * Get provider by type
   */
  getProvider(type: string): LocalImageProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get setting from localStorage
   */
  private getSetting(key: string): string | null {
    try {
      return localStorage.getItem(`jarvis_image_gen_${key}`);
    } catch {
      return null;
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(prompt: string, options: ImageGenerationOptions): string {
    const optString = JSON.stringify(options);
    return `${this.cachePrefix}${btoa(prompt + optString).slice(0, 32)}`;
  }
}

export const localImageGenerator = LocalImageGeneratorService.getInstance();
