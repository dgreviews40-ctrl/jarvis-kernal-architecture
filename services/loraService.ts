/**
 * LoRA Service - Interface to LoRA Training Server
 * 
 * Provides:
 * - Adapter management (create, delete, list)
 * - Training job control
 * - Inference with personalized adapters
 * - Integration with conversation history
 */

import { EventEmitter } from './eventEmitter';
import { logger } from './logger';

// Server configuration
const LORA_SERVER_URL = 'http://localhost:5005';
const OLLAMA_URL = 'http://localhost:11434';
const REQUEST_TIMEOUT = 30000;

// Types
export interface LoRAAdapter {
  id: string;
  name: string;
  baseModel: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  trainingExamples: number;
  status: 'initialized' | 'training' | 'ready' | 'error';
  loss?: number;
  adapterPath?: string;
  metadata?: Record<string, unknown>;
}

export interface TrainingJob {
  id: string;
  adapterId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  currentLoss?: number;
  startTime?: string;
  endTime?: string;
  errorMessage?: string;
  // Extended status fields
  phase?: 'initializing' | 'downloading' | 'loading' | 'training' | 'saving' | 'completed';
  phaseMessage?: string;
  downloadProgress?: number;
  downloadTotalMb?: number;
  downloadCurrentMb?: number;
}

export interface TrainingConfig {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  loraR?: number;
  loraAlpha?: number;
}

export interface TrainingExample {
  input: string;
  output: string;
}

export interface GPUInfo {
  name: string;
  totalMemoryGb: number;
  allocatedGb: number;
  reservedGb: number;
}

export interface ServerHealth {
  status: string;
  device: string;
  gpu?: GPUInfo;
  adaptersCount: number;
  currentJob?: TrainingJob;
  avgRequestTimeMs: number;
}

export interface CreateAdapterRequest {
  name: string;
  description?: string;
  baseModel?: string;
}

export interface StartTrainingRequest {
  adapterId: string;
  trainingData: TrainingExample[];
  config?: TrainingConfig;
}

export interface GenerateRequest {
  adapterId: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResponse {
  text: string;
  timeMs: number;
}

/**
 * Map snake_case job data from server to camelCase TrainingJob
 */
function mapJobFromServer(j: any): TrainingJob {
  return {
    id: j.id ?? '',
    adapterId: j.adapter_id ?? '',
    status: j.status ?? 'pending',
    progress: j.progress ?? 0,
    currentEpoch: j.current_epoch ?? 0,
    totalEpochs: j.total_epochs ?? 0,
    currentLoss: j.current_loss,
    startTime: j.start_time,
    endTime: j.end_time,
    errorMessage: typeof j.error_message === 'string' ? j.error_message : (j.error_message ? String(j.error_message) : undefined),
    phase: j.phase,
    phaseMessage: typeof j.phase_message === 'string' ? j.phase_message : String(j.phase_message ?? ''),
    downloadProgress: j.download_progress,
    downloadTotalMb: j.download_total_mb,
    downloadCurrentMb: j.download_current_mb
  };
}

/**
 * LoRA Service for managing fine-tuning
 */
class LoRAService extends EventEmitter {
  private adapters: Map<string, LoRAAdapter> = new Map();
  private jobs: Map<string, TrainingJob> = new Map();
  private currentJob: TrainingJob | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isServerAvailable = false;

  constructor() {
    super();
    this.startHealthPolling();
  }

  /**
   * Check if LoRA server is available
   */
  async checkHealth(): Promise<ServerHealth | null> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        this.isServerAvailable = false;
        return null;
      }

      const data = await response.json();
      this.isServerAvailable = data.status === 'ok';
      
      if (data.current_job) {
        this.currentJob = mapJobFromServer(data.current_job);
      }

      // Map GPU info
      const gpu = data.gpu ? {
        name: data.gpu.name,
        totalMemoryGb: data.gpu.total_memory_gb,
        allocatedGb: data.gpu.allocated_gb,
        reservedGb: data.gpu.reserved_gb
      } : undefined;

      return {
        status: data.status,
        device: data.device,
        gpu,
        adaptersCount: data.adapters_count,
        currentJob: this.currentJob ?? undefined,
        avgRequestTimeMs: data.avg_request_time_ms
      };
    } catch {
      this.isServerAvailable = false;
      return null;
    }
  }

  /**
   * Start health polling
   */
  private startHealthPolling(): void {
    // Check immediately
    this.checkHealth();

    // Poll every 10 seconds
    this.pollingInterval = setInterval(async () => {
      const health = await this.checkHealth();
      
      if (health?.currentJob) {
        this.jobs.set(health.currentJob.id, health.currentJob);
        this.emit('jobUpdate', health.currentJob);
        
        if (health.currentJob.status === 'completed') {
          this.emit('trainingCompleted', health.currentJob);
          // Refresh adapter list
          await this.listAdapters();
        } else if (health.currentJob.status === 'failed') {
          this.emit('trainingFailed', health.currentJob);
        }
      }
    }, 10000);
  }

  /**
   * Get all adapters
   */
  async listAdapters(): Promise<LoRAAdapter[]> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/adapters`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // Map snake_case to camelCase from Python server
      const adapters: LoRAAdapter[] = data.adapters.map((a: any) => ({
        id: a.id,
        name: a.name,
        baseModel: a.base_model,
        description: a.description,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        trainingExamples: a.training_examples || 0,
        status: a.status,
        loss: a.loss,
        adapterPath: a.adapter_path,
        metadata: a.metadata
      }));

      // Update local cache
      this.adapters.clear();
      adapters.forEach(adapter => {
        this.adapters.set(adapter.id, adapter);
      });

      this.emit('adaptersUpdated', adapters);
      return adapters;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to list adapters: ${error}`, 'error');
      return Array.from(this.adapters.values());
    }
  }

  /**
   * Create a new adapter
   */
  async createAdapter(request: CreateAdapterRequest): Promise<LoRAAdapter | null> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/adapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: request.name,
          description: request.description || '',
          base_model: request.baseModel || 'unsloth/Llama-3.2-1B-Instruct'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // Map snake_case to camelCase
      const a = data.adapter;
      const adapter: LoRAAdapter = {
        id: a.id,
        name: a.name,
        baseModel: a.base_model,
        description: a.description,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        trainingExamples: a.training_examples || 0,
        status: a.status,
        loss: a.loss,
        adapterPath: a.adapter_path,
        metadata: a.metadata
      };

      this.adapters.set(adapter.id, adapter);
      this.emit('adapterCreated', adapter);
      
      logger.log('LORA_SERVICE', `Created adapter: ${adapter.name}`, 'success');
      return adapter;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to create adapter: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Get adapter details
   */
  async getAdapter(adapterId: string): Promise<LoRAAdapter | null> {
    // Check cache first
    if (this.adapters.has(adapterId)) {
      return this.adapters.get(adapterId)!;
    }

    try {
      const response = await fetch(`${LORA_SERVER_URL}/adapters/${adapterId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // Map snake_case to camelCase
      const a = data.adapter;
      const adapter: LoRAAdapter = {
        id: a.id,
        name: a.name,
        baseModel: a.base_model,
        description: a.description,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        trainingExamples: a.training_examples || 0,
        status: a.status,
        loss: a.loss,
        adapterPath: a.adapter_path,
        metadata: a.metadata
      };

      this.adapters.set(adapter.id, adapter);
      return adapter;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to get adapter: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Delete an adapter
   */
  async deleteAdapter(adapterId: string): Promise<boolean> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/adapters/${adapterId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.adapters.delete(adapterId);
      this.emit('adapterDeleted', adapterId);
      
      logger.log('LORA_SERVICE', `Deleted adapter: ${adapterId}`, 'success');
      return true;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to delete adapter: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Start training a new adapter
   */
  async startTraining(request: StartTrainingRequest): Promise<TrainingJob | null> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adapter_id: request.adapterId,
          training_data: request.trainingData,
          config: {
            epochs: request.config?.epochs || 3,
            batch_size: request.config?.batchSize || 4,
            learning_rate: request.config?.learningRate || 0.0002,
            lora_r: request.config?.loraR || 16,
            lora_alpha: request.config?.loraAlpha || 32
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const job = mapJobFromServer(data.job);

      this.jobs.set(job.id, job);
      this.currentJob = job;
      this.emit('trainingStarted', job);

      logger.log('LORA_SERVICE', `Started training job: ${job.id}`, 'success');
      return job;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to start training: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Get training job status
   */
  async getJobStatus(jobId: string): Promise<TrainingJob | null> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/train/${jobId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const job = mapJobFromServer(data.job);

      this.jobs.set(job.id, job);
      return job;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to get job status: ${error}`, 'error');
      return this.jobs.get(jobId) || null;
    }
  }

  /**
   * Cancel a training job
   */
  async cancelTraining(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/train/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const job = mapJobFromServer(data.job);

      this.jobs.set(job.id, job);
      this.currentJob = null;
      this.emit('trainingCancelled', job);

      logger.log('LORA_SERVICE', `Cancelled training job: ${jobId}`, 'info');
      return true;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to cancel training: ${error}`, 'error');
      return false;
    }
  }

  /**
   * List all training jobs
   */
  async listJobs(): Promise<TrainingJob[]> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/jobs`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const jobs: TrainingJob[] = (data.jobs || []).map(mapJobFromServer);

      jobs.forEach(job => {
        this.jobs.set(job.id, job);
      });

      if (data.current_job) {
        this.currentJob = mapJobFromServer(data.current_job);
      }

      return jobs;
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to list jobs: ${error}`, 'error');
      return Array.from(this.jobs.values());
    }
  }

  /**
   * Generate text using a trained adapter
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse | null> {
    try {
      const response = await fetch(`${LORA_SERVER_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adapter_id: request.adapterId,
          prompt: request.prompt,
          max_tokens: request.maxTokens || 256,
          temperature: request.temperature || 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.text,
        timeMs: data.time_ms
      };
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to generate: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Get conversation history from memory for training
   */
  async extractTrainingDataFromMemory(
    memoryService: { getConversations: () => Promise<Array<{ input: string; output: string }>> },
    limit: number = 100
  ): Promise<TrainingExample[]> {
    try {
      const conversations = await memoryService.getConversations();
      return conversations.slice(-limit).map(conv => ({
        input: conv.input,
        output: conv.output
      }));
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to extract training data: ${error}`, 'error');
      return [];
    }
  }

  /**
   * Quick train on recent conversation history
   */
  async quickTrainOnConversations(
    adapterName: string,
    memoryService: { getConversations: () => Promise<Array<{ input: string; output: string }>> },
    config?: TrainingConfig
  ): Promise<{ adapter: LoRAAdapter | null; job: TrainingJob | null }> {
    // Create adapter
    const adapter = await this.createAdapter({
      name: adapterName,
      description: `Trained on conversations - ${new Date().toISOString()}`
    });

    if (!adapter) {
      return { adapter: null, job: null };
    }

    // Extract training data
    const trainingData = await this.extractTrainingDataFromMemory(memoryService, 50);

    if (trainingData.length === 0) {
      logger.log('LORA_SERVICE', 'No training data available', 'warning');
      return { adapter, job: null };
    }

    // Start training
    const job = await this.startTraining({
      adapterId: adapter.id,
      trainingData,
      config: {
        epochs: config?.epochs || 2,  // Quick training
        batchSize: config?.batchSize || 4,
        learningRate: config?.learningRate || 0.0002,
        loraR: config?.loraR || 8,  // Smaller for quick training
        loraAlpha: config?.loraAlpha || 16
      }
    });

    return { adapter, job };
  }

  /**
   * Check if server is available
   */
  isAvailable(): boolean {
    return this.isServerAvailable;
  }

  /**
   * Get cached adapters
   */
  getCachedAdapters(): LoRAAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get cached jobs
   */
  getCachedJobs(): TrainingJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get current training job
   */
  getCurrentJob(): TrainingJob | null {
    return this.currentJob;
  }

  /**
   * Get ready adapters (trained and available)
   */
  getReadyAdapters(): LoRAAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.status === 'ready');
  }

  /**
   * Fetch installed Ollama models
   * 
   * NOTE: Ollama models cannot be used directly for LoRA training because the
   * training server uses Hugging Face transformers which requires HF-compatible model IDs.
   * This function is kept for reference but LoRA training requires HF models like:
   * - unsloth/Llama-3.2-1B-Instruct
   * - unsloth/Llama-3.2-3B-Instruct
   * - NousResearch/Llama-2-7b-chat-hf
   */
  async fetchOllamaModels(): Promise<Array<{name: string; size: string; parameter_size?: string}>> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return (data.models || []).map((m: any) => ({
        name: m.name,
        size: m.size || 'unknown',
        parameter_size: m.details?.parameter_size
      }));
    } catch (error) {
      logger.log('LORA_SERVICE', `Failed to fetch Ollama models: ${error}`, 'error');
      return [];
    }
  }

  /**
   * Dispose service
   */
  dispose(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}

// Export singleton instance
export const loraService = new LoRAService();
export default loraService;
