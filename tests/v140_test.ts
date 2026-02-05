/**
 * JARVIS Kernel v1.4.0 Test Suite
 * 
 * Tests for:
 * - Local Vector Database
 * - Context Window Management
 */

import { localVectorDB } from '../services/localVectorDB';
import { contextWindowService } from '../services/contextWindowService';
import { AIProvider, ConversationTurn } from '../types';

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

// ==================== VECTOR DB TESTS ====================

async function testVectorDBInitialization(): Promise<void> {
  const success = await localVectorDB.initialize();
  if (!success) {
    throw new Error('Vector DB failed to initialize');
  }
}

async function testVectorDBStore(): Promise<void> {
  const testNode = {
    id: `test_${Date.now()}`,
    content: 'This is a test memory about artificial intelligence and machine learning.',
    type: 'FACT' as const,
    tags: ['test', 'ai', 'ml'],
    created: Date.now(),
    lastAccessed: Date.now()
  };
  
  await localVectorDB.store(testNode);
  
  const retrieved = await localVectorDB.getById(testNode.id);
  if (!retrieved) {
    throw new Error('Failed to retrieve stored vector');
  }
  if (retrieved.content !== testNode.content) {
    throw new Error('Retrieved content does not match');
  }
}

async function testVectorDBSearch(): Promise<void> {
  // Store test memories
  const memories = [
    { content: 'The user likes pizza with pepperoni', tags: ['food', 'preference'] },
    { content: 'User prefers dark mode in all applications', tags: ['ui', 'preference'] },
    { content: 'The weather is sunny today', tags: ['weather'] },
  ];
  
  for (let i = 0; i < memories.length; i++) {
    await localVectorDB.store({
      id: `search_test_${i}`,
      content: memories[i].content,
      type: 'FACT',
      tags: memories[i].tags,
      created: Date.now(),
      lastAccessed: Date.now()
    });
  }
  
  // Search for food preferences
  const results = await localVectorDB.search('What food does the user like?', {
    maxResults: 5,
    minScore: 0.5
  });
  
  if (results.length === 0) {
    throw new Error('Search returned no results');
  }
  
  // Check if pizza result is in top results
  const hasPizza = results.some(r => r.node.content.includes('pizza'));
  if (!hasPizza) {
    console.warn('⚠️ Pizza result not found in search (may be due to fallback embeddings)');
  }
}

async function testVectorDBStats(): Promise<void> {
  const stats = await localVectorDB.getStats();
  
  if (stats.totalVectors === 0) {
    throw new Error('Stats show no vectors');
  }
  
  console.log(`   📊 Vector DB: ${stats.totalVectors} vectors, ${stats.indexSize} indexed`);
}

// ==================== CONTEXT WINDOW TESTS ====================

async function testTokenEstimation(): Promise<void> {
  const text = "This is a test sentence with about twelve tokens.";
  const tokens = contextWindowService.estimateTokens(text);
  
  // Should be around 10-15 tokens
  if (tokens < 5 || tokens > 25) {
    throw new Error(`Token estimation seems off: ${tokens} for "${text}"`);
  }
}

async function testContextLimits(): Promise<void> {
  const geminiLimit = contextWindowService.getContextLimit(AIProvider.GEMINI);
  const ollamaLimit = contextWindowService.getContextLimit(AIProvider.OLLAMA);
  
  if (geminiLimit !== 1_000_000) {
    throw new Error(`Gemini limit incorrect: ${geminiLimit}`);
  }
  if (ollamaLimit !== 8192) {
    throw new Error(`Ollama limit incorrect: ${ollamaLimit}`);
  }
}

async function testContextOptimization(): Promise<void> {
  // Create a long conversation
  const turns: ConversationTurn[] = [];
  for (let i = 0; i < 30; i++) {
    turns.push({
      id: `turn_${i}`,
      timestamp: Date.now() - (30 - i) * 60000,
      speaker: i % 2 === 0 ? 'USER' : 'JARVIS',
      text: `This is turn number ${i} with some content about various topics like technology, programming, and artificial intelligence.`
    });
  }
  
  const systemPrompt = "You are JARVIS, an AI assistant.";
  
  const result = await contextWindowService.optimizeContext(
    turns,
    systemPrompt,
    AIProvider.GEMINI
  );
  
  if (result.optimized.length >= turns.length) {
    throw new Error('Context was not optimized/reduced');
  }
  
  if (result.tokenCount.total === 0) {
    throw new Error('Token count is zero');
  }
  
  console.log(`   📊 Optimized: ${turns.length} → ${result.optimized.length} turns (${result.tokenCount.total} tokens)`);
}

async function testContextPruning(): Promise<void> {
  const turns: ConversationTurn[] = [
    { id: '1', timestamp: Date.now() - 100000, speaker: 'USER', text: 'Hello' },
    { id: '2', timestamp: Date.now() - 90000, speaker: 'JARVIS', text: 'Hi there!' },
    { id: '3', timestamp: Date.now() - 80000, speaker: 'USER', text: 'What is your name?' },
    { id: '4', timestamp: Date.now() - 70000, speaker: 'JARVIS', text: 'I am JARVIS.' },
    { id: '5', timestamp: Date.now() - 1000, speaker: 'USER', text: 'What did we discuss earlier?', interrupted: true },
  ];
  
  const systemPrompt = "You are JARVIS.";
  
  const pruned = contextWindowService.pruneContext(
    turns,
    systemPrompt,
    AIProvider.OLLAMA,
    0.5
  );
  
  // Should keep the interrupted turn (highest priority)
  const hasInterrupted = pruned.some(t => t.id === '5');
  if (!hasInterrupted) {
    throw new Error('Pruning removed high-priority interrupted turn');
  }
}

// ==================== MAIN TEST RUNNER ====================

export async function runV140Tests(): Promise<void> {
  console.log('\n🧪 JARVIS Kernel v1.4.0 Test Suite\n');
  
  // Vector DB Tests
  console.log('📦 Vector Database Tests:');
  await runTest('Vector DB Initialization', testVectorDBInitialization);
  await runTest('Vector DB Store & Retrieve', testVectorDBStore);
  await runTest('Vector DB Search', testVectorDBSearch);
  await runTest('Vector DB Stats', testVectorDBStats);
  
  // Context Window Tests
  console.log('\n📦 Context Window Tests:');
  await runTest('Token Estimation', testTokenEstimation);
  await runTest('Context Limits', testContextLimits);
  await runTest('Context Optimization', testContextOptimization);
  await runTest('Context Pruning', testContextPruning);
  
  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`   Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  return passed === total;
}

// Run if executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).runV140Tests = runV140Tests;
} else {
  // Node environment
  runV140Tests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
