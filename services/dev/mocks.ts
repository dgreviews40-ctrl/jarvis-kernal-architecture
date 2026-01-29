import { AIRequest, AIResponse, AIProvider, SystemMetrics, MemoryNode, MemorySearchResult } from "../../types";

/**
 * MOCK AI PROVIDER
 * Returns deterministic, instant responses. No API calls.
 */
export class MockAIProvider {
  public id = "MOCK_AI";
  public name = "Dev Sandbox Neural Net";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    // Simulate processing time
    await new Promise(r => setTimeout(r, 200));

    // Deterministic Logic
    let output = "I am a mock response from the Developer Sandbox.";
    const lowerPrompt = request.prompt.toLowerCase();

    if (lowerPrompt.includes("hello")) output = "Hello, Developer. The sandbox is active.";
    if (lowerPrompt.includes("status")) output = "All systems nominal. Mock adapters engaged.";
    if (lowerPrompt.includes("error")) throw new Error("Simulated AI Provider Crash");
    if (request.images) output = "Visual input received. Mock analysis: [Object: 'Test Artifact']";

    return {
      text: output,
      provider: AIProvider.SYSTEM,
      model: "mock-v1-dev",
      latencyMs: 200,
      costEstimate: 0
    };
  }
}

/**
 * MOCK MEMORY CORE
 * Isolated in-memory array. Does not touch production DB.
 */
export class MockMemoryCore {
  private nodes: MemoryNode[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    this.nodes = [
      {
        id: 'dev_mem_001',
        content: "[DEV] User is testing the plugin system.",
        type: 'FACT',
        tags: ['dev', 'test'],
        created: Date.now()
      }
    ];
  }

  public async store(content: string, type: any, tags: string[] = []): Promise<MemoryNode> {
    const node = {
      id: `dev_mem_${Math.random().toString(36).substring(7)}`,
      content,
      type,
      tags,
      created: Date.now()
    };
    this.nodes.unshift(node);
    return node;
  }

  public async recall(query: string): Promise<MemorySearchResult[]> {
    return this.nodes
      .filter(n => n.content.toLowerCase().includes(query.toLowerCase()))
      .map(n => ({ node: n, score: 0.9 }));
  }

  public async forget(id: string) {
    this.nodes = this.nodes.filter(n => n.id !== id);
  }

  public reset() {
    this.seed();
  }

  public getAll() {
    return this.nodes;
  }
}

/**
 * MOCK HARDWARE
 * Controllable metrics for stress testing.
 */
export class MockHardwareMonitor {
  public metrics: SystemMetrics = {
    cpuLoad: 10,
    memoryUsage: 20,
    gpuLoad: 0,
    temperature: 30,
    uptime: 1000
  };

  public setMetric(key: keyof SystemMetrics, value: number) {
    this.metrics[key] = value;
  }

  public getMetrics() {
    return this.metrics;
  }
}

export const mockAI = new MockAIProvider();
export const mockMemory = new MockMemoryCore();
export const mockHardware = new MockHardwareMonitor();