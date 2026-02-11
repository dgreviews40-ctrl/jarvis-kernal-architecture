# Smart Context Routing v1.0

## Overview

The Smart Context Routing system automatically determines where to look for information based on the nature of your question. No need to specify "check memory" or "ask Home Assistant" - the AI figures it out for you.

## How It Works

When you ask a question, the system:

1. **Classifies** your query into one of these domains:
   - `PERSONAL` - Questions about you (name, hobbies, preferences)
   - `DEVICE` - Device control commands (lights, switches)
   - `SENSOR` - Sensor data queries (temperature, humidity)
   - `GENERAL` - General knowledge questions
   - `AMBIGUOUS` - Could be multiple domains

2. **Routes** to the appropriate data source:
   - Personal queries → Memory System (vector DB)
   - Device/Sensor queries → Home Assistant
   - General queries → AI's training data

3. **Enriches** the AI's context with relevant data before generating a response

## Examples

### Personal Queries (Auto-routes to Memory)

| Query | Data Source |
|-------|-------------|
| "What's my name?" | Memory |
| "What are my hobbies?" | Memory |
| "What's my favorite movie?" | Memory |
| "What did I do yesterday?" | Memory |
| "Remind me what I said about..." | Memory |

### Device Queries (Auto-routes to Home Assistant)

| Query | Data Source |
|-------|-------------|
| "Turn on the living room lights" | Home Assistant |
| "What's the temperature?" | Home Assistant |
| "Is the front door locked?" | Home Assistant |
| "Show me the power usage" | Home Assistant |

### General Queries (Uses AI Knowledge)

| Query | Data Source |
|-------|-------------|
| "What's the weather like?" | Weather Service |
| "Tell me about quantum physics" | AI Knowledge |
| "Write a poem about stars" | AI Knowledge |

## Keyword Detection

The system looks for specific patterns:

### Personal Keywords
- Identity: "my name", "who am I", "I am", "call me"
- Hobbies: "hobby", "like to", "enjoy", "interested in", "passion"
- Preferences: "favorite", "prefer", "my taste"
- Personal History: "my birthday", "where I live", "my job"
- Memories: "remember when", "what did I", "yesterday", "I told you"

### Device Keywords
- Control: "turn on", "turn off", "toggle", "switch"
- Devices: "light", "thermostat", "lock", "fan", "camera"
- Sensors: "temperature", "humidity", "power", "energy"
- Status: "status", "what is", "how is", "tell me the"

## Confidence Scoring

The system assigns a confidence score (0-1) to each classification:
- **High confidence (>0.8)**: Clear intent, direct routing
- **Medium confidence (0.5-0.8)**: May check multiple sources
- **Low confidence (<0.5)**: Falls back to general query

## Logging

You can see the routing decisions in the logs:
```
[SMART_ROUTER] Query classified as PERSONAL (conf: 95%). Action: CHECK_MEMORY
[SMART_ROUTER] Retrieved identity for query: "What's my name?"
[SMART_ROUTER] Enriched query with memory data
```

## Code Structure

```
services/
├── smartContextRouter.ts    # Main routing logic
├── kernelProcessor.ts       # Integration point
└── gemini.ts                # Intent classification
```

## Testing

To test the routing:

```typescript
import { classifyQuery, getRoutingExplanation } from './services/smartContextRouter';

// Test a query
const result = classifyQuery("What are my hobbies?");
console.log(result);
// { domain: 'PERSONAL', confidence: 0.85, suggestedAction: 'CHECK_MEMORY' }

// Get detailed explanation
console.log(getRoutingExplanation("What are my hobbies?"));
```

## Future Enhancements

- Learn from user corrections to improve routing accuracy
- Support more complex multi-domain queries
- Add natural language explanations when data isn't found
- Context-aware routing based on conversation history
