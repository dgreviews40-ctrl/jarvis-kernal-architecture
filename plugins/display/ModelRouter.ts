import { providerManager } from '../../services/providers';
import { AIRequest, AIResponse, AIProvider } from '../types';
import { ModelSelector } from './utils/ModelSelector';
import { NotificationService } from './utils/NotificationService';

export class ModelRouter {
  private modelSelector: ModelSelector;
  private notificationService: NotificationService;
  private currentModel: string;
  
  constructor(modelSelector: ModelSelector, notificationService: NotificationService) {
    this.modelSelector = modelSelector;
    this.notificationService = notificationService;
    this.currentModel = 'llama3'; // Default model
  }
  
  async routeRequest(
    prompt: string, 
    images?: string[],
    preferredModel?: string
  ): Promise<AIResponse> {
    try {
      // Determine the appropriate model for this request
      let targetModel = preferredModel;
      
      if (!targetModel) {
        const modelSelection = this.modelSelector.selectModel('text', prompt);
        targetModel = modelSelection.model;
      }
      
      // Check if we need to switch models
      if (targetModel !== this.currentModel) {
        this.notificationService.modelSwitchNotification(this.currentModel, targetModel, 'Content requirements changed');
        this.currentModel = targetModel;
      }
      
      // Prepare the AI request
      const request: AIRequest = {
        prompt,
        images,
        systemInstruction: 'You are JARVIS, an intelligent assistant. Generate appropriate content based on the user request.',
        temperature: 0.7
      };
      
      // Update Ollama config to use the selected model
      const currentConfig = providerManager.getOllamaConfig();
      providerManager.setOllamaConfig({
        ...currentConfig,
        model: targetModel
      });
      
      // Route the request through the provider manager
      const response = await providerManager.route(request, AIProvider.OLLAMA);
      
      return response;
    } catch (error) {
      // Fallback to default model if there's an error
      const currentConfig = providerManager.getOllamaConfig();
      providerManager.setOllamaConfig({
        ...currentConfig,
        model: 'llama3'
      });
      
      this.notificationService.error(`Model routing error: ${(error as Error).message}. Falling back to default model.`);
      
      // Retry with default model
      const request: AIRequest = {
        prompt,
        images,
        systemInstruction: 'You are JARVIS, an intelligent assistant. Generate appropriate content based on the user request.',
        temperature: 0.7
      };
      
      return await providerManager.route(request, AIProvider.OLLAMA);
    }
  }
  
  getCurrentModel(): string {
    return this.currentModel;
  }
  
  async updateAvailableModels(): Promise<void> {
    try {
      const models = await providerManager.getOllamaModels();
      this.modelSelector.updateAvailableModels(models);
    } catch (error) {
      console.error('Error updating available models:', error);
    }
  }
}