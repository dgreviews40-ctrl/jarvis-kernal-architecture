# Agent Orchestrator Service

Autonomous multi-step task execution with planning, tool selection, and self-correction.

## Overview

The Agent Orchestrator enables JARVIS to execute complex tasks autonomously:

```
User Request → Decompose → Plan → Execute → Verify → Respond
                    ↓          ↓         ↓
                 Sub-tasks   Tools    Progress updates
```

## Key Features

- **Task Decomposition** - Break complex requests into sub-tasks
- **Tool Selection** - Automatically choose appropriate tools
- **Parallel Execution** - Run independent tasks concurrently
- **Self-Correction** - Retry failed tasks with adjusted parameters
- **Progress Tracking** - Real-time updates on task status
- **Dependency Management** - Ensure tasks execute in correct order

## Core Concepts

### Goal

A high-level user request broken into tasks:

```typescript
interface AgentGoal {
  id: string;
  description: string;
  tasks: AgentTask[];
  status: TaskStatus;
  progress: number;  // 0-100
  createdAt: number;
  completedAt?: number;
  userId: string;
  sessionId: string;
}
```

### Task

An individual unit of work:

```typescript
interface AgentTask {
  id: string;
  parentId?: string;           // For sub-tasks
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  
  // Execution
  tool?: string;
  toolParams?: Record<string, unknown>;
  dependencies: string[];      // Task IDs that must complete first
  
  // State
  result?: unknown;
  error?: string;
  retryCount: number;
  maxRetries: number;
  
  // Timing
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}
```

### Task Status

| Status | Description |
|--------|-------------|
| `pending` | Waiting to start |
| `planning` | Creating execution plan |
| `executing` | Currently running |
| `waiting` | Waiting for user input/external event |
| `retrying` | Attempting again after failure |
| `completed` | Success |
| `failed` | Exhausted retries |
| `cancelled` | User cancelled |

### Tool

Executable capability:

```typescript
interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params, context) => Promise<unknown>;
  estimateDuration: (params) => number;
}
```

## Usage

```typescript
import { agentOrchestrator } from './services/agentOrchestrator';

// Create and execute a goal
const goal = await agentOrchestrator.createGoal(
  'Find the weather in New York and send a summary to my email',
  { priority: 'medium' }
);

// Subscribe to events
agentOrchestrator.onEvent((event) => {
  console.log(`${event.type}: ${event.goalId}`);
});

// Get goal status
const status = agentOrchestrator.getGoalStatus(goal.id);
console.log(`Progress: ${status.progress}%`);

// Cancel if needed
agentOrchestrator.cancelGoal(goal.id);
```

## Configuration

```typescript
interface AgentConfig {
  maxConcurrentTasks: number;        // Default: 3
  defaultMaxRetries: number;         // Default: 3
  retryDelayMs: number;              // Default: 1000
  maxRetryDelayMs: number;           // Default: 30000
  enableParallelExecution: boolean;  // Default: true
  progressUpdateIntervalMs: number;  // Default: 2000
  requireConfirmationFor: TaskPriority[]; // Default: ['high', 'critical']
}
```

## Task Execution Flow

### 1. Goal Creation

```typescript
const goal = await agentOrchestrator.createGoal(
  'Research AI trends and create a presentation',
  { 
    priority: 'high',
    requireConfirmation: true,
    context: {
      userPreferences: ['detailed', 'technical'],
      constraints: ['use only open source tools']
    }
  }
);
```

### 2. Task Decomposition

The orchestrator breaks the goal into tasks:

```typescript
// Example decomposition for "Research AI trends"
[
  {
    id: 'task_1',
    description: 'Search for latest AI trends',
    tool: 'web_search',
    dependencies: [],
    priority: 'high'
  },
  {
    id: 'task_2', 
    description: 'Summarize findings',
    tool: 'text_summarization',
    dependencies: ['task_1'],
    priority: 'medium'
  },
  {
    id: 'task_3',
    description: 'Create presentation slides',
    tool: 'file_generator',
    dependencies: ['task_2'],
    priority: 'medium'
  }
]
```

### 3. Execution Plan

Tasks are grouped for parallel execution:

```typescript
interface ExecutionPlan {
  goalId: string;
  tasks: AgentTask[];
  parallelGroups: string[][];  // Tasks that can run together
  estimatedTotalDuration: number;
  requiredTools: string[];
}

// Example plan
{
  parallelGroups: [
    ['task_1'],           // First: search
    ['task_2'],           // Then: summarize (depends on task_1)
    ['task_3', 'task_4']  // Finally: create slides and notes (can be parallel)
  ]
}
```

### 4. Execution

```typescript
// Execute with retry logic
try {
  const result = await tool.execute(task.toolParams, context);
  task.result = result;
  task.status = 'completed';
} catch (error) {
  if (task.retryCount < task.maxRetries) {
    task.status = 'retrying';
    task.retryCount++;
    await delay(calculateBackoff(task.retryCount));
    // Retry...
  } else {
    task.status = 'failed';
    task.error = error.message;
  }
}
```

## Event System

Subscribe to orchestration events:

```typescript
agentOrchestrator.onEvent((event: AgentEvent) => {
  switch (event.type) {
    case 'goal_created':
      showNotification('New task started');
      break;
    case 'task_completed':
      updateProgress(event.goalId);
      break;
    case 'task_failed':
      showError(event.data.error);
      break;
    case 'progress_update':
      updateProgressBar(event.data.progress);
      break;
  }
});
```

### Event Types

| Event | Trigger | Data |
|-------|---------|------|
| `goal_created` | New goal created | goalId |
| `task_started` | Task begins execution | goalId, taskId |
| `task_completed` | Task succeeds | goalId, taskId, result |
| `task_failed` | Task fails | goalId, taskId, error |
| `task_retrying` | Task retrying | goalId, taskId, attempt |
| `progress_update` | Progress change | goalId, progress |
| `goal_completed` | All tasks done | goalId |
| `goal_failed` | Goal failed | goalId, failedTasks |

## Default Tools

The orchestrator includes built-in tools:

| Tool | Purpose | Example |
|------|---------|---------|
| `web_search` | Search the web | Find information |
| `file_read` | Read file content | Load data |
| `file_write` | Write to file | Save results |
| `api_call` | HTTP requests | Call external APIs |
| `text_analysis` | Analyze text | Extract entities |
| `code_execution` | Run code | Process data |

### Registering Custom Tools

```typescript
agentOrchestrator.registerTool({
  id: 'my_custom_tool',
  name: 'Custom Data Processor',
  description: 'Processes data in custom format',
  parameters: [
    { name: 'data', type: 'string', required: true },
    { name: 'format', type: 'string', required: false, default: 'json' }
  ],
  execute: async (params, context) => {
    // Implementation
    return processedData;
  },
  estimateDuration: (params) => {
    return params.data.length * 0.1; // 0.1ms per char
  }
});
```

## Error Handling

### Retry Strategies

| Failure Type | Strategy |
|--------------|----------|
| Network timeout | Exponential backoff, max 3 retries |
| Rate limit | Wait for retry-after, max 2 retries |
| Validation error | No retry (fatal) |
| Unknown error | 2 retries with linear backoff |

### Recovery

```typescript
// Automatic retry with adjusted parameters
if (task.retryCount === 1) {
  // First retry: same parameters
  return retry(task);
} else if (task.retryCount === 2) {
  // Second retry: reduce batch size
  task.toolParams.batchSize = task.toolParams.batchSize / 2;
  return retry(task);
} else {
  // Final retry: fallback tool
  task.tool = 'fallback_tool';
  return retry(task);
}
```

## Best Practices

### 1. Set Appropriate Priorities

```typescript
// ✅ Good - urgent user request
{ priority: 'critical' }

// ✅ Good - background processing
{ priority: 'low' }

// ❌ Bad - everything critical
{ priority: 'critical' }  // For everything
```

### 2. Use Dependencies Correctly

```typescript
// ✅ Good - explicit dependencies
{
  id: 'analyze',
  dependencies: ['fetch_data'],
  tool: 'analyzer'
}

// ❌ Bad - implicit dependencies (assumes order)
{
  id: 'analyze',
  dependencies: [],  // Should depend on fetch_data
  tool: 'analyzer'
}
```

### 3. Handle Long-Running Tasks

```typescript
// ✅ Good - progress updates
agentOrchestrator.onEvent((event) => {
  if (event.type === 'progress_update') {
    updateUI(event.data.progress);
  }
});

// ✅ Good - cancellation support
const controller = new AbortController();
agentOrchestrator.createGoal('Long task', {
  signal: controller.signal
});

// Cancel if user requests
controller.abort();
```

### 4. Limit Concurrent Tasks

```typescript
// ✅ Good - prevent overwhelming resources
const config = {
  maxConcurrentTasks: 3  // Reasonable limit
};

// ❌ Bad - too many concurrent tasks
const badConfig = {
  maxConcurrentTasks: 100  // Will exhaust resources
};
```

### 5. Clean Up Completed Goals

```typescript
// ✅ Good - periodic cleanup
setInterval(() => {
  agentOrchestrator.cleanupCompletedGoals(24 * 60 * 60 * 1000); // 24h
}, 60 * 60 * 1000); // Every hour
```

## Integration with Kernel Store

The orchestrator updates kernel store for UI visibility:

```typescript
// Stats automatically updated
kernelStore.setAgentStats({
  totalGoals: 10,
  activeGoals: 2,
  completedGoals: 7,
  failedGoals: 1,
  totalTasks: 45,
  isInitialized: true
});
```

## Security Considerations

1. **Tool Validation** - All tools validated before execution
2. **Sandboxing** - Tool execution in isolated context
3. **Confirmation** - High/critical priority tasks require confirmation
4. **Timeout** - All tasks have execution timeout
5. **Quota** - Rate limiting on tool calls

## Future Enhancements

- [ ] Human-in-the-loop for ambiguous tasks
- [ ] Learning from successful task patterns
- [ ] Multi-agent collaboration
- [ ] Visual task flow editor
- [ ] Natural language goal creation
