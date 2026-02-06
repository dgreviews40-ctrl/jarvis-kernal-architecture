/**
 * Local Vector Database Service - Compatibility Layer
 * 
 * This file now re-exports from the unified vectorDB.ts for backward compatibility.
 * New code should import directly from './vectorDB'.
 * 
 * @deprecated Use vectorDB.ts instead
 */

import { vectorDB, VectorDB, VectorRecord } from './vectorDB';
import { logger } from './logger';

// Re-export the singleton instance as localVectorDB for backward compatibility
export const localVectorDB = vectorDB;

// Re-export types
export type { VectorRecord };
export { VectorDB };

// Re-export vectorMemoryService for compatibility
import { vectorMemoryService } from './vectorMemoryService';
export { vectorMemoryService };

logger.log('VECTOR_DB', 'localVectorDB compatibility layer loaded (uses unified vectorDB)', 'info');
