/**
 * JARVIS AI Engine v1.1 - New Features Export
 * 
 * Exports all new v1.1 services:
 * - Streaming responses
 * - Tool/function calling
 * - Conversation persistence
 * - Enhanced kernel processor
 */

// Streaming
export { 
  streamingHandler, 
  StreamingResponseHandler,
  type StreamChunk,
  type StreamingOptions 
} from './streaming';

// Tools
export { 
  toolRegistry, 
  type Tool,
  type ToolParameter,
  type ToolResult,
  type ToolCall 
} from './tools';

// Conversation Persistence
export { 
  conversationPersistence,
  type PersistedConversation,
  type ConversationSearchResult,
  type PersistenceStats 
} from './conversationPersistence';

// Enhanced Kernel Processor
export { 
  enhancedKernelProcessor,
  EnhancedKernelProcessor 
} from './enhancedKernelProcessor';
