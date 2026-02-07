/**
 * Agent Orchestrator Service for JARVIS Kernel v1.5.0
 * 
 * Enables autonomous multi-step task execution:
 * - Task decomposition into sub-tasks
 * - Tool selection and planning
 * - Self-correction and retry logic
 * - Progress tracking and user updates
 * - Parallel execution for independent tasks
 * 
 * Architecture:
 * User Request → Decompose → Plan → Execute → Verify → Respond
 *                      ↓          ↓         ↓
 *                   Sub-tasks   Tools    Progress updates
 */

import { AIProvider } from '../types';
import { logger } from './logger';
import { providerManager } from './providers';
import { eventBus } from './eventBus';
import { updateKernelHealth } from '../stores';

// ==================== TYPES ====================

export type TaskStatus = 
  | 'pending'      // Waiting to start
  | 'planning'     // Creating execution plan
  | 'executing'    // Running
  | 'waiting'      // Waiting for user input/external event
  | 'retrying'     // Attempting again after failure
  | 'completed'    // Success
  | 'failed'       // Exhausted retries
  | 'cancelled';   // User cancelled

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentTask {
  id: string;
  parentId?: string;           // For sub-tasks
  description: string;         // What to do
  status: TaskStatus;
  priority: TaskPriority;
  
  // Execution
  tool?: string;               // Tool to use
  toolParams?: Record<string, any>;
  dependencies: string[];      // Task IDs that must complete first
  
  // State
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  
  // Timing
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number;  // ms
  
  // Context
  context: TaskContext;
}

export interface TaskContext {
  originalRequest: string;
  accumulatedData: Record<string, any>;
  userPreferences: string[];
  constraints: string[];
}

export interface AgentGoal {
  id: string;
  description: string;
  tasks: AgentTask[];
  status: TaskStatus;
  progress: number;            // 0-100
  createdAt: number;
  completedAt?: number;
  
  // Metadata
  userId: string;
  sessionId: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>, context: TaskContext) => Promise<any>;
  estimateDuration: (params: Record<string, any>) => number;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

export interface ExecutionPlan {
  goalId: string;
  tasks: AgentTask[];
  parallelGroups: string[][];  // Tasks that can run in parallel
  estimatedTotalDuration: number;
  requiredTools: string[];
}

export interface AgentEvent {
  type: 'goal_created' | 'task_started' | 'task_completed' | 'task_failed' | 
        'task_retrying' | 'progress_update' | 'goal_completed' | 'goal_failed';
  goalId: string;
  taskId?: string;
  data?: any;
  timestamp: number;
}

// ==================== CONFIGURATION ====================

interface AgentConfig {
  maxConcurrentTasks: number;
  defaultMaxRetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  enableParallelExecution: boolean;
  progressUpdateIntervalMs: number;
  requireConfirmationFor: TaskPriority[];
}

const DEFAULT_CONFIG: AgentConfig = {
  maxConcurrentTasks: 3,
  defaultMaxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  enableParallelExecution: true,
  progressUpdateIntervalMs: 2000,
  requireConfirmationFor: ['high', 'critical'],
};

// ==================== AGENT ORCHESTRATOR ====================

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;
  private config: AgentConfig;
  private goals: Map<string, AgentGoal> = new Map();
  private tools: Map<string, Tool> = new Map();
  private activeExecutions: Map<string, Promise<void>> = new Map();
  private eventListeners: ((event: AgentEvent) => void)[] = [];
  private progressTimers: Map<string, number> = new Map();

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.registerDefaultTools();
  }

  public static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  // ==================== GOAL MANAGEMENT ====================

  /**
   * Create and execute a new goal from user request
   */
  public async createGoal(
    userRequest: string,
    options: {
      priority?: TaskPriority;
      requireConfirmation?: boolean;
      context?: Partial<TaskContext>;
    } = {}
  ): Promise<AgentGoal> {
    const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.log('AGENT', `Creating goal: ${userRequest.substring(0, 50)}...`, 'info');

    // Step 1: Decompose into tasks
    const tasks = await this.decomposeRequest(userRequest, goalId);
    
    // Step 2: Create execution plan
    const plan = await this.createExecutionPlan(goalId, tasks, userRequest);
    
    // Step 3: Create goal
    const goal: AgentGoal = {
      id: goalId,
      description: userRequest,
      tasks: plan.tasks,
      status: 'planning',
      progress: 0,
      createdAt: Date.now(),
      userId: 'current_user',
      sessionId: this.getSessionId(),
    };

    this.goals.set(goalId, goal);
    this.emitEvent({ type: 'goal_created', goalId, timestamp: Date.now() });

    // Step 4: Start execution
    this.executeGoal(goalId);

    return goal;
  }

  /**
   * Decompose user request into sub-tasks using AI
   */
  private async decomposeRequest(request: string, goalId: string): Promise<string[]> {
    const prompt = `
You are JARVIS Agent Planner. Decompose the following user request into specific, actionable sub-tasks.
Each sub-task should be:
- Atomic (single responsibility)
- Actionable (clear what to do)
- Verifiable (clear when done)

User Request: "${request}"

Respond with a JSON array of task descriptions:
[
  "First specific sub-task",
  "Second specific sub-task",
  ...
]

Guidelines:
- Break complex requests into 3-10 sub-tasks
- Order by dependency (what must happen first)
- Include verification steps where needed
- Consider error cases and recovery
`;

    try {
      const response = await providerManager.route({
        prompt,
        systemInstruction: 'You are a task decomposition expert. Output only valid JSON.',
      }, AIProvider.GEMINI);

      const tasks = JSON.parse(response.text);
      logger.log('AGENT', `Decomposed into ${tasks.length} tasks`, 'info');
      return tasks;
    } catch (error) {
      logger.log('AGENT', `Decomposition failed: ${error.message}`, 'error');
      // Fallback: treat as single task
      return [request];
    }
  }

  /**
   * Create execution plan with tool assignments and parallel groups
   */
  private async createExecutionPlan(
    goalId: string,
    taskDescriptions: string[],
    originalRequest: string
  ): Promise<ExecutionPlan> {
    const tasks: AgentTask[] = [];
    const context: TaskContext = {
      originalRequest,
      accumulatedData: {},
      userPreferences: [],
      constraints: [],
    };

    // Create task objects
    for (let i = 0; i < taskDescriptions.length; i++) {
      const task: AgentTask = {
        id: `${goalId}_task_${i}`,
        description: taskDescriptions[i],
        status: 'pending',
        priority: 'medium',
        dependencies: i > 0 ? [`${goalId}_task_${i-1}`] : [],
        retryCount: 0,
        maxRetries: this.config.defaultMaxRetries,
        createdAt: Date.now(),
        context,
      };

      // Select appropriate tool
      const toolSelection = await this.selectTool(task);
      if (toolSelection) {
        task.tool = toolSelection.toolId;
        task.toolParams = toolSelection.params;
        task.estimatedDuration = this.tools.get(toolSelection.toolId)?.estimateDuration(task.toolParams) || 5000;
      }

      tasks.push(task);
    }

    // Identify parallel groups (tasks with no dependencies or same dependencies)
    const parallelGroups = this.identifyParallelGroups(tasks);

    // Calculate total duration
    const estimatedTotalDuration = this.calculateTotalDuration(tasks, parallelGroups);

    logger.log('AGENT', `Execution plan created: ${tasks.length} tasks, ${parallelGroups.length} parallel groups`, 'info');

    return {
      goalId,
      tasks,
      parallelGroups,
      estimatedTotalDuration,
      requiredTools: [...new Set(tasks.filter(t => t.tool).map(t => t.tool!))],
    };
  }

  /**
   * Select best tool for a task using AI
   */
  private async selectTool(task: AgentTask): Promise<{ toolId: string; params: Record<string, any> } | null> {
    const availableTools = Array.from(this.tools.values()).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const prompt = `
Select the best tool for this task and provide parameters.

Task: "${task.description}"

Available Tools:
${JSON.stringify(availableTools, null, 2)}

Respond with JSON:
{
  "toolId": "tool_id",
  "params": { "param1": "value1", ... },
  "reasoning": "why this tool"
}

Or {"toolId": null} if no tool matches.
`;

    try {
      const response = await providerManager.route({
        prompt,
        systemInstruction: 'You are a tool selection expert. Output only valid JSON.',
      }, AIProvider.GEMINI);

      const selection = JSON.parse(response.text);
      if (selection.toolId && this.tools.has(selection.toolId)) {
        return { toolId: selection.toolId, params: selection.params || {} };
      }
    } catch (error) {
      logger.log('AGENT', `Tool selection failed: ${error.message}`, 'warning');
    }

    return null;
  }

  /**
   * Identify which tasks can run in parallel
   */
  private identifyParallelGroups(tasks: AgentTask[]): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < tasks.length) {
      const group: string[] = [];
      
      for (const task of tasks) {
        if (processed.has(task.id)) continue;
        
        // Check if all dependencies are processed
        const depsSatisfied = task.dependencies.every(dep => processed.has(dep));
        if (depsSatisfied) {
          group.push(task.id);
        }
      }

      if (group.length > 0) {
        groups.push(group);
        group.forEach(id => processed.add(id));
      } else {
        // Circular dependency or error - break to avoid infinite loop
        break;
      }
    }

    return groups;
  }

  /**
   * Calculate estimated total duration considering parallel execution
   */
  private calculateTotalDuration(tasks: AgentTask[], parallelGroups: string[][]): number {
    let totalDuration = 0;
    
    for (const group of parallelGroups) {
      // Group duration = max duration in group
      const groupDuration = Math.max(...group.map(taskId => {
        const task = tasks.find(t => t.id === taskId);
        return task?.estimatedDuration || 5000;
      }));
      totalDuration += groupDuration;
    }

    return totalDuration;
  }

  // ==================== EXECUTION ====================

  /**
   * Execute a goal
   */
  private async executeGoal(goalId: string): Promise<void> {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.status = 'executing';
    logger.log('AGENT', `Executing goal: ${goalId}`, 'info');

    // Start progress updates
    this.startProgressUpdates(goalId);

    try {
      const plan = await this.createExecutionPlan(goalId, goal.tasks.map(t => t.description), goal.description);
      
      // Execute parallel groups sequentially
      for (const group of plan.parallelGroups) {
        if (this.config.enableParallelExecution && group.length > 1) {
          // Execute group in parallel
          await Promise.all(group.map(taskId => this.executeTask(goalId, taskId)));
        } else {
          // Execute sequentially
          for (const taskId of group) {
            await this.executeTask(goalId, taskId);
          }
        }

        // Check if goal should continue (status may be modified by executeTask)
        const currentStatus = goal.status as TaskStatus;
        if (currentStatus === 'cancelled' || currentStatus === 'failed') {
          break;
        }
      }

      // Update final status
      const failedTasks = goal.tasks.filter(t => t.status === 'failed');
      if (failedTasks.length === 0) {
        goal.status = 'completed';
        goal.completedAt = Date.now();
        goal.progress = 100;
        this.emitEvent({ type: 'goal_completed', goalId, timestamp: Date.now() });
        logger.log('AGENT', `Goal completed: ${goalId}`, 'success');
      } else {
        goal.status = 'failed';
        this.emitEvent({ type: 'goal_failed', goalId, data: { failedTasks: failedTasks.length }, timestamp: Date.now() });
        logger.log('AGENT', `Goal failed: ${goalId} (${failedTasks.length} tasks failed)`, 'error');
      }
    } catch (error) {
      goal.status = 'failed';
      this.emitEvent({ type: 'goal_failed', goalId, data: { error: error.message }, timestamp: Date.now() });
      logger.log('AGENT', `Goal execution error: ${error.message}`, 'error');
    } finally {
      this.stopProgressUpdates(goalId);
    }
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(goalId: string, taskId: string): Promise<void> {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const task = goal.tasks.find(t => t.id === taskId);
    if (!task || task.status === 'completed' || task.status === 'cancelled') return;

    // Check dependencies
    const depsCompleted = task.dependencies.every(depId => {
      const dep = goal.tasks.find(t => t.id === depId);
      return dep?.status === 'completed';
    });
    if (!depsCompleted) return;

    task.status = 'executing';
    task.startedAt = Date.now();
    this.emitEvent({ type: 'task_started', goalId, taskId, timestamp: Date.now() });

    try {
      let result: any;

      if (task.tool && this.tools.has(task.tool)) {
        // Execute tool
        const tool = this.tools.get(task.tool)!;
        result = await tool.execute(task.toolParams || {}, task.context);
      } else {
        // No tool - use AI to execute
        result = await this.executeWithAI(task);
      }

      task.result = result;
      task.status = 'completed';
      task.completedAt = Date.now();
      
      // Update context with result
      task.context.accumulatedData[taskId] = result;
      
      this.emitEvent({ type: 'task_completed', goalId, taskId, data: { result }, timestamp: Date.now() });
      logger.log('AGENT', `Task completed: ${taskId}`, 'success');
    } catch (error) {
      task.error = error.message;
      task.retryCount++;

      if (task.retryCount < task.maxRetries) {
        // Retry with exponential backoff
        task.status = 'retrying';
        const delay = Math.min(
          this.config.retryDelayMs * Math.pow(2, task.retryCount),
          this.config.maxRetryDelayMs
        );
        
        this.emitEvent({ 
          type: 'task_retrying', 
          goalId, 
          taskId, 
          data: { attempt: task.retryCount, delay }, 
          timestamp: Date.now() 
        });
        
        logger.log('AGENT', `Task retrying: ${taskId} (attempt ${task.retryCount})`, 'warning');
        await this.sleep(delay);
        return this.executeTask(goalId, taskId); // Retry
      } else {
        // Max retries exceeded
        task.status = 'failed';
        this.emitEvent({ type: 'task_failed', goalId, taskId, data: { error: error.message }, timestamp: Date.now() });
        logger.log('AGENT', `Task failed: ${taskId} - ${error.message}`, 'error');
      }
    }
  }

  /**
   * Execute task using AI when no tool is available
   */
  private async executeWithAI(task: AgentTask): Promise<any> {
    const context = Object.entries(task.context.accumulatedData)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    const prompt = `
Execute the following task and provide the result.

Task: ${task.description}

Context from previous tasks:
${context}

Provide a clear, actionable result.
`;

    const response = await providerManager.route({
      prompt,
      systemInstruction: 'You are JARVIS executing a task. Be concise and accurate.',
    }, AIProvider.GEMINI);

    return response.text;
  }

  // ==================== TOOL REGISTRY ====================

  /**
   * Register a new tool
   */
  public registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
    logger.log('AGENT', `Tool registered: ${tool.name}`, 'info');
  }

  /**
   * Get registered tool
   */
  public getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  /**
   * Get all registered tools
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Register default tools
   */
  private registerDefaultTools(): void {
    // Web search tool
    this.registerTool({
      id: 'web_search',
      name: 'Web Search',
      description: 'Search the internet for information',
      parameters: [
        { name: 'query', type: 'string', description: 'Search query', required: true },
        { name: 'maxResults', type: 'number', description: 'Maximum results', required: false, default: 5 },
      ],
      execute: async (params) => {
        // Implementation would use actual search API
        return { results: [`Simulated search for: ${params.query}`] };
      },
      estimateDuration: () => 3000,
    });

    // Memory store tool
    this.registerTool({
      id: 'store_memory',
      name: 'Store Memory',
      description: 'Store information in long-term memory',
      parameters: [
        { name: 'content', type: 'string', description: 'Content to store', required: true },
        { name: 'tags', type: 'array', description: 'Tags for organization', required: false },
      ],
      execute: async (params, context) => {
        const { localVectorDB } = await import('./localVectorDB');
        await localVectorDB.store({
          id: `memory_${Date.now()}`,
          content: params.content,
          type: 'FACT',
          tags: params.tags || ['agent_stored'],
          created: Date.now(),
          lastAccessed: Date.now(),
        });
        return { stored: true };
      },
      estimateDuration: () => 500,
    });

    // Memory recall tool
    this.registerTool({
      id: 'recall_memory',
      name: 'Recall Memory',
      description: 'Search long-term memory for information',
      parameters: [
        { name: 'query', type: 'string', description: 'Search query', required: true },
        { name: 'maxResults', type: 'number', description: 'Maximum results', required: false, default: 3 },
      ],
      execute: async (params) => {
        const { localVectorDB } = await import('./localVectorDB');
        const results = await localVectorDB.search(params.query, { maxResults: params.maxResults });
        return { memories: results.map(r => r.node.content) };
      },
      estimateDuration: () => 1000,
    });

    // Home Assistant tool
    this.registerTool({
      id: 'home_assistant',
      name: 'Home Assistant Control',
      description: 'Control smart home devices',
      parameters: [
        { name: 'entityId', type: 'string', description: 'Device entity ID', required: true },
        { name: 'action', type: 'string', description: 'Action to perform', required: true },
        { name: 'params', type: 'object', description: 'Additional parameters', required: false },
      ],
      execute: async (params) => {
        const { haService } = await import('./home_assistant');
        // Implementation would call HA service
        return { success: true, entity: params.entityId, action: params.action };
      },
      estimateDuration: () => 2000,
    });

    // Timer tool
    this.registerTool({
      id: 'set_timer',
      name: 'Set Timer',
      description: 'Set a timer or reminder',
      parameters: [
        { name: 'duration', type: 'number', description: 'Duration in minutes', required: true },
        { name: 'label', type: 'string', description: 'Timer label', required: true },
      ],
      execute: async (params) => {
        const { taskAutomation } = await import('./integrations/taskAutomation');
        const task = taskAutomation.createTask({
          title: params.label,
          dueDate: new Date(Date.now() + params.duration * 60000),
          status: 'pending',
        });
        return { timerId: task.id, duration: params.duration };
      },
      estimateDuration: () => 500,
    });
  }

  // ==================== PROGRESS TRACKING ====================

  private startProgressUpdates(goalId: string): void {
    const timer = window.setInterval(() => {
      this.updateProgress(goalId);
    }, this.config.progressUpdateIntervalMs);
    
    this.progressTimers.set(goalId, timer);
  }

  private stopProgressUpdates(goalId: string): void {
    const timer = this.progressTimers.get(goalId);
    if (timer) {
      clearInterval(timer);
      this.progressTimers.delete(goalId);
    }
  }

  private updateProgress(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (!goal || goal.status === 'completed' || goal.status === 'failed') return;

    const completed = goal.tasks.filter(t => t.status === 'completed').length;
    const total = goal.tasks.length;
    goal.progress = Math.round((completed / total) * 100);

    this.emitEvent({
      type: 'progress_update',
      goalId,
      data: { progress: goal.progress, completed, total },
      timestamp: Date.now(),
    });

    // Update store for UI
    updateKernelHealth({
      status: goal.progress < 100 ? 'healthy' : 'healthy',
    });
  }

  // ==================== EVENT HANDLING ====================

  public onEvent(listener: (event: AgentEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) this.eventListeners.splice(index, 1);
    };
  }

  private emitEvent(event: AgentEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Agent event listener error:', error);
      }
    });
  }

  // ==================== UTILITIES ====================

  public getGoal(goalId: string): AgentGoal | undefined {
    return this.goals.get(goalId);
  }

  public getAllGoals(): AgentGoal[] {
    return Array.from(this.goals.values());
  }

  public getActiveGoals(): AgentGoal[] {
    return this.getAllGoals().filter(g => 
      g.status === 'executing' || g.status === 'planning'
    );
  }

  public cancelGoal(goalId: string): boolean {
    const goal = this.goals.get(goalId);
    if (!goal) return false;

    goal.status = 'cancelled';
    goal.tasks.forEach(t => {
      if (t.status === 'pending' || t.status === 'executing') {
        t.status = 'cancelled';
      }
    });

    this.stopProgressUpdates(goalId);
    logger.log('AGENT', `Goal cancelled: ${goalId}`, 'warning');
    return true;
  }

  public updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  private getSessionId(): string {
    // Get from existing session or create new
    return `session_${Date.now()}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
export const agentOrchestrator = AgentOrchestrator.getInstance();
