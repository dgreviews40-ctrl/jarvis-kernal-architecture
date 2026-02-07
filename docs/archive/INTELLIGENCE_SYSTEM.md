# JARVIS Intelligence System

## Overview

The Intelligence System is a comprehensive suite of AI capabilities designed to make JARVIS more intelligent, context-aware, and capable of natural conversation. It consists of 7 interconnected modules that work together to create a more human-like interaction experience.

---

## 🧠 Core Modules

### 1. **Conversational Context Engine**

Manages deep conversation context for natural, flowing discussions.

**Features:**
- **Topic Tracking**: Automatically extracts and tracks conversation topics
- **Thread Management**: Maintains conversation threads with automatic timeout handling
- **Sentiment Analysis**: Real-time sentiment detection with emotional triggers
- **Intent History**: Tracks user intents for pattern learning
- **Context Enrichment**: Provides AI with rich contextual information

**Usage:**
```typescript
import { conversationalContext } from './services/intelligence';

// Extract topics from user input
const topics = await conversationalContext.extractTopics("Turn on the living room lights");
// Returns: [{ name: 'Home Automation', keywords: ['lights', 'living room'], ... }]

// Analyze sentiment
const sentiment = conversationalContext.analyzeSentiment("Thanks, that worked perfectly!");
// Returns: { sentiment: 'positive', score: 0.8, triggers: ['thanks', 'perfectly'] }

// Get enriched context for AI
const context = await conversationalContext.getEnrichedContext(recentTurns);
```

---

### 2. **Personality Engine**

Adaptive personality system that evolves based on user interactions.

**Features:**
- **Dynamic Traits**: Helpfulness, warmth, humor, empathy (adaptable)
- **Emotional States**: Tracks and responds to emotional context
- **Response Styles**: Adapts verbosity, formality, and humor
- **User Rapport**: Builds familiarity over time
- **Greeting Generation**: Context-aware greetings

**Usage:**
```typescript
import { personalityEngine } from './services/intelligence';

// Set current user
personalityEngine.setCurrentUser('user_123');

// Update emotional state based on interaction
personalityEngine.updateEmotion('compliment_received', 'positive', 0.7);

// Adapt to user behavior
await personalityEngine.adaptToUser(userInput, 'positive');

// Get personality-aware system prompt
const personalityPrompt = personalityEngine.getPersonalityPrompt();

// Generate greeting
const greeting = personalityEngine.generateGreeting();
// "Good afternoon! Great to see you again. What are we working on today?"
```

---

### 3. **Proactive Intelligence**

Anticipates user needs based on learned patterns.

**Features:**
- **Pattern Recognition**: Time-based, sequence, and habit patterns
- **Predictive Suggestions**: Anticipates next actions
- **Contextual Reminders**: Smart reminders based on conditions
- **Habit Learning**: Detects and learns user routines
- **Behavioral Insights**: Analytics on user patterns

**Usage:**
```typescript
import { proactiveIntelligence } from './services/intelligence';

// Record user interaction
proactiveIntelligence.recordInteraction('check_solar_production', {
  hour: 14,
  dayOfWeek: 1
});

// Get predictive suggestions
const predictions = proactiveIntelligence.getPredictiveSuggestions({
  currentTopic: 'energy'
});
// Returns: [{ prediction: 'User typically checks solar at 14:00', confidence: 0.85, ... }]

// Create contextual reminder
await proactiveIntelligence.createReminder(
  { type: 'time', value: '09:00' },
  'Good morning! Ready to check your daily schedule?',
  'medium'
);

// Generate proactive message
const message = proactiveIntelligence.generateProactiveMessage();
// "I noticed you usually check solar production around this time..."
```

---

### 4. **Multi-Turn Reasoning Engine**

Handles complex, multi-step reasoning across conversation turns.

**Features:**
- **Reasoning Chains**: Step-by-step problem solving
- **Hypothesis Management**: Form and test hypotheses
- **Clarification Loops**: Request and track clarifications
- **Inference Tracking**: Logical inference with dependency tracking
- **Complexity Detection**: Automatically detects reasoning needs

**Usage:**
```typescript
import { multiTurnReasoning } from './services/intelligence';

// Check if query needs reasoning
const check = multiTurnReasoning.requiresReasoning(
  "Explain step by step how solar panels work and whether they'd be good for my house"
);
// Returns: { required: true, complexity: 'complex', suggestedApproach: 'structured_reasoning' }

// Start reasoning chain
const chain = multiTurnReasoning.startReasoning(
  "Should I get solar panels?"
);

// Add reasoning steps
multiTurnReasoning.addStep(chain.id, {
  type: 'assumption',
  content: 'User wants to evaluate solar panel feasibility',
  confidence: 0.9,
  dependencies: [],
  verified: true
});

// Form hypothesis
const hypothesis = multiTurnReasoning.formHypothesis(
  'Solar panels would be cost-effective',
  ['high electricity bills', 'sunny climate', 'tax incentives']
);

// Build reasoning prompt for AI
const prompt = multiTurnReasoning.buildReasoningPrompt(userInput);
```

---

### 5. **Knowledge Graph**

Manages entities and their relationships for semantic understanding.

**Features:**
- **Entity Extraction**: People, places, things, concepts, events
- **Relationship Inference**: Automatic relationship detection
- **Path Finding**: Find connections between entities
- **Semantic Queries**: Answer questions based on relationships
- **Clustering**: Group related entities

**Usage:**
```typescript
import { knowledgeGraph } from './services/intelligence';

// Extract entities
const entities = knowledgeGraph.extractEntities(
  "My wife Sarah works at Google in the kitchen"
);
// Returns: [Person: wife, Person: Sarah, Organization: Google, Place: kitchen]

// Infer relationships
const relationships = knowledgeGraph.inferRelationships(text);
// Automatically creates: Sarah works_for Google, Sarah located_in kitchen

// Find path between entities
const path = knowledgeGraph.findPath('Sarah', 'Google');
// Returns: { entities: [Sarah, Google], relationships: [works_for], confidence: 0.8 }

// Query knowledge
const answer = knowledgeGraph.query('Where does Sarah work?');
// Returns: { answer: 'Sarah works at Google.', confidence: 0.8, sources: [...] }

// Get related entities
const related = knowledgeGraph.getRelatedEntities('Sarah', 'knows');
```

---

### 6. **Natural Response Generator**

Creates human-like, varied responses.

**Features:**
- **Response Templates**: Context-appropriate templates
- **Natural Variations**: Openings, transitions, closings
- **Tone Adaptation**: Matches emotional context
- **Personality Consistency**: Maintains personality style
- **Repetition Avoidance**: Tracks and avoids overused phrases

**Usage:**
```typescript
import { naturalResponse } from './services/intelligence';

// Generate natural response
const response = naturalResponse.generate(
  "The lights are now on in the living room.",
  {
    addOpening: true,
    addClosing: true,
    tone: 'friendly',
    avoidRepetition: true
  }
);
// "Alright, the lights are now on in the living room. Let me know if you need anything else!"

// Get template responses
const acknowledgment = naturalResponse.generateAcknowledgment();
const thinking = naturalResponse.generateThinkingIndicator();
const success = naturalResponse.generateSuccessResponse();

// Format lists naturally
const list = naturalResponse.formatList(
  ['kitchen lights', 'living room TV', 'bedroom fan'],
  "I've turned on:"
);
// "I've turned on: kitchen lights, living room TV, and bedroom fan"
```

---

### 7. **Conversation Flow Manager**

Manages conversation structure and dynamics.

**Features:**
- **Stage Management**: Opening → Exploration → Deepening → Resolution → Closing
- **Engagement Tracking**: Monitors user engagement levels
- **Turn-taking**: Smart turn management
- **Interruption Handling**: Graceful pause and resume
- **Topic Transitions**: Smooth topic changes

**Usage:**
```typescript
import { conversationFlow } from './services/intelligence';

// Process conversation turn
const result = conversationFlow.processTurn(userInput, conversationHistory);
// Returns: { response, state, suggestions, shouldFollowUp }

// Handle interruption
const interruptResult = conversationFlow.handleInterruption();
// Returns: { acknowledgment: "I'll pause there.", saveContext: true }

// Resume after interruption
const resume = conversationFlow.resumeAfterInterruption();
// Returns: { shouldResume: true, resumeMessage: "As I was saying...", context }

// Add pending action for follow-up
const actionId = conversationFlow.addPendingAction(
  'Check weather forecast',
  'medium',
  Date.now() + 3600000 // 1 hour
);

// Get conversation summary
const summary = conversationFlow.getSummary();
// Returns: { stage, engagement, depth, topics, pendingActions }
```

---

## 🎯 Unified Intelligence Interface

### Intelligence Orchestrator

The `IntelligenceOrchestrator` coordinates all modules for seamless operation:

```typescript
import { intelligence, IntelligenceContext } from './services/intelligence';

// Process user input through all intelligence layers
const context: IntelligenceContext = {
  userInput: "What's the weather like?",
  conversationHistory: recentTurns,
  userId: 'user_123',
  timestamp: Date.now()
};

const result = await intelligence.process(context);
// Returns:
// {
//   systemPrompt: "You are JARVIS... [enriched with context]",
//   userPrompt: "What's the weather like?",
//   responseModifiers: { tone: 'cheerful', style: 'balanced_neutral', ... },
//   proactiveSuggestions: ['Check forecast for weekend'],
//   requiresReasoning: false
// }

// Post-process AI response
const naturalResponse = intelligence.postProcessResponse(
  aiResponse,
  result.responseModifiers
);

// Generate greeting
const greeting = intelligence.generateGreeting();

// Get comprehensive stats
const stats = intelligence.getStats();
```

---

## 📊 Integration with Existing JARVIS

### Updated Request Flow

```
User Input
    ↓
[Conversational Context] → Topic extraction, sentiment analysis
    ↓
[Personality Engine] → Adapt personality, emotional state
    ↓
[Knowledge Graph] → Extract entities, infer relationships
    ↓
[Multi-Turn Reasoning] → Check if reasoning needed
    ↓
[Proactive Intelligence] → Record interaction, get predictions
    ↓
[Conversation Flow] → Process turn, determine strategy
    ↓
[Build System Prompt] → Enriched with all context
    ↓
AI Provider (Gemini/Ollama)
    ↓
[Natural Response] → Post-process for naturalness
    ↓
User Response
```

### Example Integration in App.tsx

```typescript
import { intelligence } from './services/intelligence';

// In your message handler:
const handleUserMessage = async (input: string) => {
  // Process through intelligence system
  const context = {
    userInput: input,
    conversationHistory: conversation.getSession()?.turns || [],
    userId: 'current_user',
    timestamp: Date.now()
  };
  
  const intelligenceResult = await intelligence.process(context);
  
  // Route to appropriate AI provider with enriched context
  const aiResponse = await providerManager.route({
    prompt: intelligenceResult.userPrompt,
    systemInstruction: intelligenceResult.systemPrompt
  });
  
  // Post-process for naturalness
  const naturalResponse = intelligence.postProcessResponse(
    aiResponse.text,
    intelligenceResult.responseModifiers
  );
  
  return naturalResponse;
};
```

---

## 🔧 Configuration

### Personality Customization

```typescript
// Personality traits are automatically adapted, but you can:
personalityEngine.updateEmotion('system_event', 'positive', 0.5);
```

### Proactive Settings

```typescript
// Create custom reminders
await proactiveIntelligence.createReminder(
  { type: 'context', value: 'location=home' },
  'Welcome home! Want me to adjust the lights?',
  'low'
);
```

### Conversation Flow

```typescript
// Check if conversation needs re-engagement
if (conversationFlow.isConversationStale()) {
  const reengagement = conversationFlow.generateReengagement();
  // "I notice we haven't talked in a bit..."
}
```

---

## 📈 Benefits

| Capability | Before | After |
|------------|--------|-------|
| Context Awareness | 6 turns | Unlimited + topics |
| Personality | Static | Adaptive |
| Proactivity | None | Pattern-based |
| Reasoning | Single-turn | Multi-turn chains |
| Knowledge | Flat | Graph-based |
| Naturalness | Template | Dynamic |
| Flow Management | Basic | Stage-based |

---

## 🚀 Quick Start

1. **Import the intelligence system:**
```typescript
import { intelligence } from './services/intelligence';
```

2. **Process user input:**
```typescript
const result = await intelligence.process({
  userInput: userMessage,
  conversationHistory: turns,
  userId: 'user_123',
  timestamp: Date.now()
});
```

3. **Use enriched prompts with your AI provider**

4. **Post-process responses:**
```typescript
const finalResponse = intelligence.postProcessResponse(
  aiResponse,
  result.responseModifiers
);
```

---

## 📁 File Structure

```
services/intelligence/
├── index.ts                 # Main exports and orchestrator
├── conversationalContext.ts # Context and topic management
├── personalityEngine.ts     # Adaptive personality
├── proactiveIntelligence.ts # Pattern learning & predictions
├── multiTurnReasoning.ts    # Complex reasoning
├── knowledgeGraph.ts        # Entity relationships
├── naturalResponse.ts       # Response generation
└── conversationFlow.ts      # Flow management
```

---

## 🔮 Future Enhancements

- **Multi-modal Intelligence**: Vision + text context integration
- **Predictive Pre-loading**: Load resources before needed
- **Emotional Memory**: Long-term emotional pattern tracking
- **Cross-user Learning**: Anonymous pattern aggregation
- **Dynamic Persona Switching**: Different personalities for different contexts
