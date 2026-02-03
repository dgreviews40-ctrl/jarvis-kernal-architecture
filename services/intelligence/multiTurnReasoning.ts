/**
 * Multi-Turn Reasoning Engine
 * 
 * Enables complex reasoning across multiple conversation turns:
 * - Step-by-step problem solving
 * - Clarification loops
 * - Assumption tracking
 * - Hypothesis testing
 * - Structured thinking
 */

import { memory as memoryOptimized } from "../memory";
import { conversationalContext } from "./conversationalContext";

interface ReasoningStep {
  id: string;
  type: 'assumption' | 'question' | 'inference' | 'conclusion' | 'clarification';
  content: string;
  confidence: number;
  dependencies: string[]; // IDs of steps this depends on
  verified: boolean;
  timestamp: number;
}

interface ReasoningChain {
  id: string;
  goal: string;
  steps: ReasoningStep[];
  currentStep: number;
  status: 'active' | 'completed' | 'stalled' | 'abandoned';
  createdAt: number;
  lastActive: number;
}

interface ClarificationRequest {
  id: string;
  question: string;
  context: string;
  importance: 'critical' | 'helpful' | 'optional';
  answered: boolean;
  answer?: string;
}

interface Hypothesis {
  id: string;
  statement: string;
  evidence: string[];
  confidence: number;
  tested: boolean;
  result?: 'confirmed' | 'rejected' | 'uncertain';
}

export class MultiTurnReasoningEngine {
  private activeChains: Map<string, ReasoningChain> = new Map();
  private clarificationQueue: Map<string, ClarificationRequest> = new Map();
  private hypotheses: Map<string, Hypothesis> = new Map();
  private currentChainId: string | null = null;

  private readonly MAX_CHAIN_LENGTH = 10;
  private readonly CHAIN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Start a new reasoning chain for complex queries
   */
  startReasoning(goal: string, initialContext: Record<string, unknown> = {}): ReasoningChain {
    const chainId = `reason_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const chain: ReasoningChain = {
      id: chainId,
      goal,
      steps: [],
      currentStep: 0,
      status: 'active',
      createdAt: Date.now(),
      lastActive: Date.now()
    };

    // Add initial assumption step
    this.addStep(chainId, {
      type: 'assumption',
      content: `Goal: ${goal}`,
      confidence: 1.0,
      dependencies: [],
      verified: true
    });

    this.activeChains.set(chainId, chain);
    this.currentChainId = chainId;

    return chain;
  }

  /**
   * Add a reasoning step to the current chain
   */
  addStep(chainId: string, stepData: Omit<ReasoningStep, 'id' | 'timestamp'>): ReasoningStep {
    const chain = this.activeChains.get(chainId);
    if (!chain) throw new Error(`Chain ${chainId} not found`);

    const step: ReasoningStep = {
      ...stepData,
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now()
    };

    chain.steps.push(step);
    chain.lastActive = Date.now();
    chain.currentStep = chain.steps.length - 1;

    // Check if chain is getting too long
    if (chain.steps.length >= this.MAX_CHAIN_LENGTH) {
      this.concludeChain(chainId, 'Chain reached maximum length without conclusion');
    }

    return step;
  }

  /**
   * Request clarification from user
   */
  requestClarification(
    question: string, 
    context: string, 
    importance: 'critical' | 'helpful' | 'optional' = 'helpful'
  ): ClarificationRequest {
    const id = `clarify_${Date.now()}`;
    
    const request: ClarificationRequest = {
      id,
      question,
      context,
      importance,
      answered: false
    };

    this.clarificationQueue.set(id, request);

    // Add to current chain if exists
    if (this.currentChainId) {
      this.addStep(this.currentChainId, {
        type: 'clarification',
        content: `Need clarification: ${question}`,
        confidence: 0.5,
        dependencies: [],
        verified: false
      });
    }

    return request;
  }

  /**
   * Record user clarification
   */
  recordClarification(clarificationId: string, answer: string): boolean {
    const request = this.clarificationQueue.get(clarificationId);
    if (!request) return false;

    request.answer = answer;
    request.answered = true;

    // Update the reasoning step
    if (this.currentChainId) {
      const chain = this.activeChains.get(this.currentChainId);
      if (chain) {
        const step = chain.steps.find(s => 
          s.type === 'clarification' && s.content.includes(request.question)
        );
        if (step) {
          step.verified = true;
          step.confidence = 0.9;
        }
      }
    }

    return true;
  }

  /**
   * Form a hypothesis based on available information
   */
  formHypothesis(statement: string, evidence: string[] = []): Hypothesis {
    const id = `hypo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const hypothesis: Hypothesis = {
      id,
      statement,
      evidence: [...evidence],
      confidence: this.calculateHypothesisConfidence(evidence),
      tested: false
    };

    this.hypotheses.set(id, hypothesis);

    // Add to current chain
    if (this.currentChainId) {
      this.addStep(this.currentChainId, {
        type: 'assumption',
        content: `Hypothesis: ${statement}`,
        confidence: hypothesis.confidence,
        dependencies: [],
        verified: false
      });
    }

    return hypothesis;
  }

  /**
   * Calculate confidence in a hypothesis
   */
  private calculateHypothesisConfidence(evidence: string[]): number {
    if (evidence.length === 0) return 0.3;
    if (evidence.length === 1) return 0.5;
    if (evidence.length >= 3) return 0.8;
    return 0.6;
  }

  /**
   * Test a hypothesis against new information
   */
  testHypothesis(hypothesisId: string, newEvidence: string, supports: boolean): void {
    const hypothesis = this.hypotheses.get(hypothesisId);
    if (!hypothesis) return;

    hypothesis.evidence.push(newEvidence);
    hypothesis.tested = true;

    if (supports) {
      hypothesis.confidence = Math.min(1, hypothesis.confidence + 0.15);
      if (hypothesis.confidence > 0.8) {
        hypothesis.result = 'confirmed';
      }
    } else {
      hypothesis.confidence = Math.max(0, hypothesis.confidence - 0.2);
      if (hypothesis.confidence < 0.3) {
        hypothesis.result = 'rejected';
      } else {
        hypothesis.result = 'uncertain';
      }
    }

    // Update reasoning step
    if (this.currentChainId) {
      const chain = this.activeChains.get(this.currentChainId);
      if (chain) {
        const step = chain.steps.find(s => s.content.includes(hypothesis.statement));
        if (step) {
          step.confidence = hypothesis.confidence;
          step.verified = hypothesis.result === 'confirmed';
        }
      }
    }
  }

  /**
   * Make an inference based on current reasoning
   */
  makeInference(inference: string, supportingSteps: string[]): ReasoningStep {
    if (!this.currentChainId) {
      throw new Error('No active reasoning chain');
    }

    // Calculate confidence based on supporting steps
    const chain = this.activeChains.get(this.currentChainId);
    let confidence = 0.5;
    
    if (chain) {
      const supportSteps = chain.steps.filter(s => supportingSteps.includes(s.id));
      const avgConfidence = supportSteps.reduce((sum, s) => sum + s.confidence, 0) / supportSteps.length;
      confidence = avgConfidence * 0.9; // Slight reduction for inference
    }

    return this.addStep(this.currentChainId, {
      type: 'inference',
      content: inference,
      confidence,
      dependencies: supportingSteps,
      verified: false
    });
  }

  /**
   * Draw a conclusion from the reasoning chain
   */
  concludeChain(chainId: string, conclusion: string): ReasoningChain | null {
    const chain = this.activeChains.get(chainId);
    if (!chain) return null;

    // Calculate overall confidence
    const verifiedSteps = chain.steps.filter(s => s.verified);
    const overallConfidence = verifiedSteps.length / chain.steps.length;

    this.addStep(chainId, {
      type: 'conclusion',
      content: conclusion,
      confidence: overallConfidence,
      dependencies: chain.steps.map(s => s.id),
      verified: overallConfidence > 0.6
    });

    chain.status = 'completed';

    // Store conclusion in memory
    this.storeConclusion(chain, conclusion);

    return chain;
  }

  /**
   * Store reasoning conclusion in memory
   */
  private async storeConclusion(chain: ReasoningChain, conclusion: string): Promise<void> {
    await memoryOptimized.store(
      `Reasoning about "${chain.goal}": ${conclusion} (based on ${chain.steps.length} steps)`,
      'SUMMARY',
      ['reasoning', 'conclusion', 'multi-turn']
    );
  }

  /**
   * Get reasoning chain status
   */
  getChainStatus(chainId: string): {
    chain: ReasoningChain | null;
    progress: number;
    pendingClarifications: ClarificationRequest[];
    activeHypotheses: Hypothesis[];
  } {
    const chain = this.activeChains.get(chainId) || null;
    
    const pendingClarifications = Array.from(this.clarificationQueue.values())
      .filter(c => !c.answered);
    
    const activeHypotheses = Array.from(this.hypotheses.values())
      .filter(h => !h.tested || h.result === 'uncertain');

    const progress = chain 
      ? (chain.steps.filter(s => s.verified).length / chain.steps.length) * 100
      : 0;

    return {
      chain,
      progress,
      pendingClarifications,
      activeHypotheses
    };
  }

  /**
   * Build reasoning prompt for AI
   */
  buildReasoningPrompt(userInput: string): string {
    if (!this.currentChainId) {
      return userInput;
    }

    const chain = this.activeChains.get(this.currentChainId);
    if (!chain || chain.steps.length === 0) {
      return userInput;
    }

    let prompt = `REASONING CONTEXT:\n`;
    prompt += `Goal: ${chain.goal}\n\n`;
    prompt += `Steps so far:\n`;

    chain.steps.forEach((step, index) => {
      const indent = '  '.repeat(Math.min(index, 3));
      const status = step.verified ? '✓' : step.confidence > 0.5 ? '~' : '?';
      prompt += `${indent}${index + 1}. [${status}] ${step.content}\n`;
    });

    // Add pending clarifications
    const pending = Array.from(this.clarificationQueue.values()).filter(c => !c.answered);
    if (pending.length > 0) {
      prompt += `\nPending clarifications:\n`;
      pending.forEach(c => {
        prompt += `- ${c.question} (${c.importance})\n`;
      });
    }

    // Add active hypotheses
    const activeHypotheses = Array.from(this.hypotheses.values())
      .filter(h => !h.tested);
    if (activeHypotheses.length > 0) {
      prompt += `\nActive hypotheses:\n`;
      activeHypotheses.forEach(h => {
        prompt += `- ${h.statement} (confidence: ${(h.confidence * 100).toFixed(0)}%)\n`;
      });
    }

    prompt += `\nCURRENT INPUT: ${userInput}\n`;
    prompt += `\nContinue the reasoning process. If you need clarification, ask a specific question. If you can draw a conclusion, state it clearly.`;

    return prompt;
  }

  /**
   * Analyze if a query requires multi-turn reasoning
   */
  requiresReasoning(input: string): {
    required: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    suggestedApproach: string;
  } {
    const lowerInput = input.toLowerCase();
    
    // Complex reasoning indicators
    const complexIndicators = [
      'explain why', 'analyze', 'compare', 'contrast', 'evaluate',
      'what if', 'how would', 'consider', 'implications',
      'pros and cons', 'advantages and disadvantages',
      'step by step', 'walk me through', 'break down'
    ];

    // Moderate complexity indicators
    const moderateIndicators = [
      'how do', 'why does', 'what causes', 'relationship between',
      'difference between', 'similarities between'
    ];

    const hasComplex = complexIndicators.some(i => lowerInput.includes(i));
    const hasModerate = moderateIndicators.some(i => lowerInput.includes(i));

    // Check for multiple questions
    const questionCount = (input.match(/\?/g) || []).length;

    if (hasComplex || questionCount > 1) {
      return {
        required: true,
        complexity: 'complex',
        suggestedApproach: 'structured_reasoning'
      };
    }

    if (hasModerate) {
      return {
        required: true,
        complexity: 'moderate',
        suggestedApproach: 'guided_inference'
      };
    }

    return {
      required: false,
      complexity: 'simple',
      suggestedApproach: 'direct_response'
    };
  }

  /**
   * Clean up stale chains
   */
  cleanupStaleChains(): void {
    const now = Date.now();
    
    for (const [id, chain] of this.activeChains) {
      if (chain.status === 'active' && (now - chain.lastActive) > this.CHAIN_TIMEOUT_MS) {
        chain.status = 'stalled';
      }
    }
  }

  /**
   * Get all active chains
   */
  getActiveChains(): ReasoningChain[] {
    return Array.from(this.activeChains.values())
      .filter(c => c.status === 'active');
  }

  /**
   * Abandon current reasoning chain
   */
  abandonChain(chainId: string, reason: string): void {
    const chain = this.activeChains.get(chainId);
    if (chain) {
      chain.status = 'abandoned';
      this.addStep(chainId, {
        type: 'conclusion',
        content: `Abandoned: ${reason}`,
        confidence: 0,
        dependencies: [],
        verified: false
      });
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeChains: number;
    totalSteps: number;
    pendingClarifications: number;
    hypothesesFormed: number;
    hypothesesConfirmed: number;
  } {
    const allChains = Array.from(this.activeChains.values());
    const allHypotheses = Array.from(this.hypotheses.values());

    return {
      activeChains: allChains.filter(c => c.status === 'active').length,
      totalSteps: allChains.reduce((sum, c) => sum + c.steps.length, 0),
      pendingClarifications: Array.from(this.clarificationQueue.values())
        .filter(c => !c.answered).length,
      hypothesesFormed: allHypotheses.length,
      hypothesesConfirmed: allHypotheses.filter(h => h.result === 'confirmed').length
    };
  }
}

export const multiTurnReasoning = new MultiTurnReasoningEngine();
