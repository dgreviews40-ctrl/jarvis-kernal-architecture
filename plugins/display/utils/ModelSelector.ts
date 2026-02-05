import { ModelSelection } from './types';

export class ModelSelector {
  private availableModels: string[] = [];
  
  constructor(availableModels: string[] = []) {
    this.availableModels = availableModels;
  }
  
  updateAvailableModels(models: string[]): void {
    this.availableModels = models;
  }
  
  selectModel(contentType: string, content: string): ModelSelection {
    // Determine content characteristics
    const hasImages = /image|photo|picture|visual|vision/.test(content.toLowerCase());
    const hasDiagrams = /diagram|schematic|flowchart|graph|chart|map/.test(content.toLowerCase());
    const hasText = /text|document|article|summary|explanation/.test(content.toLowerCase());
    
    // Determine the best model based on content
    if (hasImages || hasDiagrams) {
      // Look for vision-capable models
      const visionModels = ['llava', 'bakllava', 'moondream', 'cogvlm', 'fuyu'];
      const availableVisionModels = this.availableModels.filter(model => 
        visionModels.some(visionModel => model.includes(visionModel))
      );
      
      if (availableVisionModels.length > 0) {
        return {
          model: availableVisionModels[0],
          reason: 'Content requires vision capabilities',
          confidence: 0.9
        };
      } else {
        return {
          model: 'llama3', // fallback
          reason: 'Vision model not available, using default',
          confidence: 0.6
        };
      }
    } else if (hasText) {
      // Use text-focused model
      const textModels = this.availableModels.filter(model => 
        model.includes('llama') || model.includes('mistral') || model.includes('phi')
      );
      
      if (textModels.length > 0) {
        return {
          model: textModels[0],
          reason: 'Content is text-focused',
          confidence: 0.8
        };
      }
    }
    
    // Default to llama3 if no specific requirements
    return {
      model: 'llama3',
      reason: 'Using default model',
      confidence: 0.7
    };
  }
  
  async checkModelAvailability(modelName: string): Promise<boolean> {
    try {
      // This would connect to the Ollama API to check if the model is available
      // For now, we'll just check if it's in our available models list
      return this.availableModels.includes(modelName);
    } catch (error) {
      console.error(`Error checking model availability for ${modelName}:`, error);
      return false;
    }
  }
}