
import { MemoryNode, MemoryType, MemorySearchResult } from "../types";

// Simulated "Pre-existing" Long Term Memory
const INITIAL_MEMORY: MemoryNode[] = [
  {
    id: 'mem_001',
    content: "User prefers dark mode interfaces.",
    type: 'PREFERENCE',
    tags: ['ui', 'theme', 'user_preference'],
    created: Date.now() - 1000000
  },
  {
    id: 'mem_002',
    content: "Project 'Iron Legion' deadline is October 15th.",
    type: 'FACT',
    tags: ['work', 'deadlines', 'project'],
    created: Date.now() - 500000
  }
];

class MemoryCore {
  private nodes: MemoryNode[];
  private storageKey = 'jarvis_memory_banks';

  constructor() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.nodes = JSON.parse(saved);
      } catch (e) {
        this.nodes = [...INITIAL_MEMORY];
      }
    } else {
      this.nodes = [...INITIAL_MEMORY];
    }
  }

  private persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.nodes));
  }

  private generateId(): string {
    return 'mem_' + Math.random().toString(36).substring(2, 11);
  }

  public getAll(): MemoryNode[] {
    return this.nodes.sort((a, b) => b.created - a.created);
  }

  public async store(content: string, type: MemoryType = 'FACT', tags: string[] = []): Promise<MemoryNode> {
    const newNode: MemoryNode = {
      id: this.generateId(),
      content,
      type,
      tags,
      created: Date.now()
    };
    this.nodes.unshift(newNode);
    this.persist();
    return newNode;
  }

  public async recall(query: string, limit: number = 5): Promise<MemorySearchResult[]> {
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(' ').filter(t => t.length > 3);

    const results = this.nodes.map(node => {
      let score = 0;
      const contentLower = node.content.toLowerCase();
      if (contentLower.includes(queryLower)) score += 1.0;
      queryTokens.forEach(token => {
        if (contentLower.includes(token)) score += 0.3;
        if (node.tags.some(t => t.includes(token))) score += 0.4;
      });
      const ageHours = (Date.now() - node.created) / (1000 * 60 * 60);
      score += Math.max(0, 0.1 - (ageHours * 0.001));
      return { node, score };
    });

    return results
      .filter(r => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  public async forget(id: string): Promise<boolean> {
    const initialLen = this.nodes.length;
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.persist();
    return this.nodes.length < initialLen;
  }

  public restore(nodes: MemoryNode[]) {
    this.nodes = nodes;
    this.persist();
  }
}

export const memory = new MemoryCore();
