/**
 * Reasoning Service
 * 
 * Consolidated from:
 * - multiTurnReasoning.ts (complex reasoning chains)
 * - knowledgeGraph.ts (entity relationships)
 * 
 * Provides: Multi-turn reasoning, knowledge extraction, entity tracking
 */

// ==================== TYPES ====================

interface ReasoningChain {
  id: string;
  originalQuestion: string;
  steps: ReasoningStep[];
  status: 'active' | 'completed' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

interface ReasoningStep {
  id: string;
  question: string;
  answer?: string;
  subQuestions: string[];
  status: 'pending' | 'answered' | 'blocked';
}

interface Entity {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships: Relationship[];
  confidence: number;
}

interface Relationship {
  targetId: string;
  type: string;
  strength: number; // 0 to 1
}

// ==================== STATE ====================

class ReasoningService {
  private chains: Map<string, ReasoningChain> = new Map();
  private entities: Map<string, Entity> = new Map();
  private entityNameIndex: Map<string, string> = new Map(); // name -> entityId

  // ==================== REASONING CHAINS ====================

  requiresReasoning(input: string): { required: boolean; complexity: number } {
    const complexityIndicators = [
      'why', 'how', 'explain', 'compare', 'analyze',
      'what if', 'difference between', 'relationship',
      'cause', 'effect', 'reason', 'consequence'
    ];
    
    const lowerInput = input.toLowerCase();
    const complexity = complexityIndicators.reduce((score, indicator) => {
      return lowerInput.includes(indicator) ? score + 1 : score;
    }, 0);
    
    // Also check for multiple questions
    const questionCount = (input.match(/\?/g) || []).length;
    
    return {
      required: complexity >= 2 || questionCount > 1,
      complexity: complexity + questionCount
    };
  }

  startReasoning(question: string): string {
    const chainId = `chain_${Date.now()}`;
    
    const chain: ReasoningChain = {
      id: chainId,
      originalQuestion: question,
      steps: [{
        id: `step_${Date.now()}`,
        question,
        subQuestions: this.generateSubQuestions(question),
        status: 'pending'
      }],
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.chains.set(chainId, chain);
    return chainId;
  }

  buildReasoningPrompt(userInput: string): string {
    const activeChain = this.getMostRecentActiveChain();
    if (!activeChain) return userInput;
    
    let prompt = `We are working through a complex question step by step.\n\n`;
    prompt += `Original question: "${activeChain.originalQuestion}"\n\n`;
    
    // Add completed steps
    const completedSteps = activeChain.steps.filter(s => s.status === 'answered');
    if (completedSteps.length > 0) {
      prompt += `What we've established so far:\n`;
      completedSteps.forEach((step, idx) => {
        prompt += `${idx + 1}. Q: ${step.question}\n   A: ${step.answer}\n`;
      });
      prompt += `\n`;
    }
    
    // Add current question
    const currentStep = activeChain.steps.find(s => s.status === 'pending');
    if (currentStep) {
      prompt += `Current focus: ${currentStep.question}\n\n`;
    }
    
    prompt += `User's follow-up: "${userInput}"\n\n`;
    prompt += `Please provide a focused answer that builds on our previous discussion.`;
    
    return prompt;
  }

  completeChain(chainId: string, answer: string): void {
    const chain = this.chains.get(chainId);
    if (!chain) return;
    
    chain.status = 'completed';
    chain.updatedAt = Date.now();
    
    // Mark current step as answered
    const currentStep = chain.steps.find(s => s.status === 'pending');
    if (currentStep) {
      currentStep.answer = answer;
      currentStep.status = 'answered';
    }
  }

  abandonChain(chainId: string, reason: string): void {
    const chain = this.chains.get(chainId);
    if (!chain) return;
    
    chain.status = 'abandoned';
    chain.updatedAt = Date.now();
  }

  getActiveChains(): ReasoningChain[] {
    return Array.from(this.chains.values())
      .filter(c => c.status === 'active');
  }

  private getMostRecentActiveChain(): ReasoningChain | undefined {
    return this.getActiveChains()
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  private generateSubQuestions(question: string): string[] {
    const subQuestions: string[] = [];
    const lowerQ = question.toLowerCase();
    
    // Generate sub-questions based on question type
    if (lowerQ.includes('compare') || lowerQ.includes('difference')) {
      subQuestions.push('What are the key characteristics of each?');
      subQuestions.push('What are the similarities?');
      subQuestions.push('What are the main differences?');
    }
    
    if (lowerQ.includes('why') || lowerQ.includes('cause')) {
      subQuestions.push('What are the contributing factors?');
      subQuestions.push('What is the immediate cause?');
      subQuestions.push('What is the root cause?');
    }
    
    if (lowerQ.includes('how')) {
      subQuestions.push('What are the steps involved?');
      subQuestions.push('What are the prerequisites?');
      subQuestions.push('What could go wrong?');
    }
    
    return subQuestions;
  }

  // ==================== KNOWLEDGE GRAPH ====================

  extractEntities(text: string): Entity[] {
    const extracted: Entity[] = [];
    
    // Simple pattern-based entity extraction
    const patterns: Record<string, RegExp[]> = {
      'PERSON': [/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g],
      'DEVICE': [/\b(light|switch|sensor|thermostat|camera|lock)\b/gi],
      'ROOM': [/\b(bedroom|kitchen|living room|bathroom|office|garage)\b/gi],
      'TIME': [/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/gi, /\b(tomorrow|today|yesterday|morning|evening)\b/gi]
    };
    
    Object.entries(patterns).forEach(([type, regexes]) => {
      regexes.forEach(regex => {
        const matches = text.match(regex) || [];
        matches.forEach(match => {
          const name = match.toLowerCase();
          
          // Check if we already know this entity
          if (this.entityNameIndex.has(name)) {
            const existingId = this.entityNameIndex.get(name)!;
            const existing = this.entities.get(existingId);
            if (existing) {
              existing.confidence = Math.min(1, existing.confidence + 0.1);
              extracted.push(existing);
            }
          } else {
            // Create new entity
            const entity: Entity = {
              id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: match,
              type,
              attributes: {},
              relationships: [],
              confidence: 0.5
            };
            
            this.entities.set(entity.id, entity);
            this.entityNameIndex.set(name, entity.id);
            extracted.push(entity);
          }
        });
      });
    });
    
    return extracted;
  }

  inferRelationships(text: string): void {
    const entities = this.extractEntities(text);
    const lowerText = text.toLowerCase();
    
    // Simple relationship inference based on proximity and keywords
    const relationshipIndicators = [
      { pattern: /\b(in|inside|within)\b/, type: 'LOCATED_IN' },
      { pattern: /\b(controls|manages|operates)\b/, type: 'CONTROLS' },
      { pattern: /\b(part of|belongs to)\b/, type: 'PART_OF' },
      { pattern: /\b(connected to|linked to)\b/, type: 'CONNECTED_TO' }
    ];
    
    // If we have multiple entities, try to find relationships
    if (entities.length >= 2) {
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entity1 = entities[i];
          const entity2 = entities[j];
          
          // Check for relationship indicators between them
          for (const indicator of relationshipIndicators) {
            if (indicator.pattern.test(lowerText)) {
              this.addRelationship(entity1.id, entity2.id, indicator.type);
              this.addRelationship(entity2.id, entity1.id, `REVERSE_${indicator.type}`);
              break;
            }
          }
        }
      }
    }
  }

  private addRelationship(fromId: string, toId: string, type: string): void {
    const entity = this.entities.get(fromId);
    if (!entity) return;
    
    // Check if relationship already exists
    const exists = entity.relationships.some(r => r.targetId === toId && r.type === type);
    if (!exists) {
      entity.relationships.push({
        targetId: toId,
        type,
        strength: 0.5
      });
    }
  }

  queryEntities(type?: string, minConfidence?: number): Entity[] {
    return Array.from(this.entities.values())
      .filter(e => !type || e.type === type)
      .filter(e => !minConfidence || e.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  getRelatedEntities(entityId: string): Array<{ entity: Entity; relationship: Relationship }> {
    const entity = this.entities.get(entityId);
    if (!entity) return [];
    
    return entity.relationships
      .map(r => ({
        entity: this.entities.get(r.targetId),
        relationship: r
      }))
      .filter((item): item is { entity: Entity; relationship: Relationship } => !!item.entity);
  }

  // ==================== LIFECYCLE ====================

  clear(): void {
    this.entities.clear();
    this.entityNameIndex.clear();
  }

  resetChains(): void {
    this.chains.clear();
  }

  getStats(): {
    chains: { total: number; active: number; completed: number };
    entities: { total: number; byType: Record<string, number> };
  } {
    const allChains = Array.from(this.chains.values());
    const allEntities = Array.from(this.entities.values());
    
    const byType: Record<string, number> = {};
    allEntities.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });
    
    return {
      chains: {
        total: allChains.length,
        active: allChains.filter(c => c.status === 'active').length,
        completed: allChains.filter(c => c.status === 'completed').length
      },
      entities: {
        total: allEntities.length,
        byType
      }
    };
  }
}

export const reasoningService = new ReasoningService();
