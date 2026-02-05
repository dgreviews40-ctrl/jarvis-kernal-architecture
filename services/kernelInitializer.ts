/**
 * Kernel Initializer for JARVIS v1.5.0
 * 
 * Handles initialization of new v1.5.0 services:
 * - Local Vector Database
 * - Context Window Management
 * 
 * This is called during the boot sequence.
 */

import { localVectorDB } from './localVectorDB';
import { contextWindowService } from './contextWindowService';
import { memoryConsolidationService } from './memoryConsolidationService';
import { agentOrchestrator } from './agentOrchestrator';
import { logger } from './logger';
import { useKernelStore } from '../stores';

export interface KernelInitStatus {
  vectorDB: boolean;
  contextWindow: boolean;
  memoryConsolidation: boolean;
  agentSystem: boolean;
  errors: string[];
}

/**
 * Initialize all v1.5.0 kernel services
 */
export async function initializeKernelV140(): Promise<KernelInitStatus> {
  const status: KernelInitStatus = {
    vectorDB: false,
    contextWindow: false,
    memoryConsolidation: false,
    agentSystem: false,
    errors: []
  };

  logger.log('KERNEL', 'Initializing JARVIS Kernel v1.5.0...', 'info');

  // Initialize Local Vector DB
  try {
    logger.log('KERNEL', 'Initializing Local Vector Database...', 'info');
    status.vectorDB = await localVectorDB.initialize();
    
    if (status.vectorDB) {
      const stats = await localVectorDB.getStats();
      useKernelStore.getState().setVectorDBStats({
        ...stats,
        isInitialized: true
      });
      logger.log('KERNEL', `Vector DB ready: ${stats.totalVectors} vectors`, 'success');
    } else {
      status.errors.push('Vector DB initialization failed');
    }
  } catch (error) {
    status.errors.push(`Vector DB error: ${error.message}`);
    logger.log('KERNEL', `Vector DB initialization error: ${error.message}`, 'error');
  }

  // Initialize Context Window Service (synchronous)
  try {
    logger.log('KERNEL', 'Initializing Context Window Service...', 'info');
    // Context window service doesn't need async initialization
    status.contextWindow = true;
    logger.log('KERNEL', 'Context Window Service ready', 'success');
  } catch (error) {
    status.errors.push(`Context Window error: ${error.message}`);
    logger.log('KERNEL', `Context Window initialization error: ${error.message}`, 'error');
  }

  // Initialize Memory Consolidation Service (v1.4.1)
  try {
    logger.log('KERNEL', 'Initializing Memory Consolidation Service v1.4.1...', 'info');
    await memoryConsolidationService.initialize();
    status.memoryConsolidation = true;
    logger.log('KERNEL', 'Memory Consolidation Service ready', 'success');
  } catch (error) {
    status.errors.push(`Memory Consolidation error: ${error.message}`);
    logger.log('KERNEL', `Memory Consolidation initialization error: ${error.message}`, 'error');
  }

  // Initialize Agent System (v1.4.2)
  try {
    logger.log('KERNEL', 'Initializing Agent System v1.4.2...', 'info');
    // Agent orchestrator is ready immediately (tools register on instantiation)
    status.agentSystem = true;
    logger.log('KERNEL', `Agent System ready with ${agentOrchestrator.getAllTools().length} tools`, 'success');
  } catch (error) {
    status.errors.push(`Agent System error: ${error.message}`);
    logger.log('KERNEL', `Agent System initialization error: ${error.message}`, 'error');
  }

  const allSuccess = status.vectorDB && status.contextWindow && status.memoryConsolidation && status.agentSystem;
  if (allSuccess) {
    logger.log('KERNEL', 'JARVIS Kernel v1.5.0 initialized successfully', 'success');
  } else {
    logger.log('KERNEL', `Kernel v1.5.0 initialized with ${status.errors.length} errors`, 'warning');
  }

  return status;
}

/**
 * Get current initialization status
 */
export function getKernelStatus(): KernelInitStatus {
  const { vectorDBStats } = useKernelStore.getState();
  
  return {
    vectorDB: vectorDBStats.isInitialized,
    contextWindow: true, // Always available
    errors: []
  };
}

/**
 * Re-initialize a specific service
 */
export async function reinitializeService(service: 'vectorDB' | 'contextWindow'): Promise<boolean> {
  switch (service) {
    case 'vectorDB':
      try {
        return await localVectorDB.initialize();
      } catch (error) {
        logger.log('KERNEL', `Failed to reinitialize Vector DB: ${error.message}`, 'error');
        return false;
      }
    case 'contextWindow':
      // Context window is stateless, always ready
      return true;
    default:
      return false;
  }
}

/**
 * Export vector DB data
 */
export async function exportVectorDB(): Promise<string> {
  try {
    return await localVectorDB.export();
  } catch (error) {
    logger.log('KERNEL', `Export failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Import vector DB data
 */
export async function importVectorDB(jsonData: string): Promise<{ imported: number; errors: number }> {
  try {
    const result = await localVectorDB.import(jsonData);
    
    // Update stats
    const stats = await localVectorDB.getStats();
    useKernelStore.getState().setVectorDBStats({
      ...stats,
      isInitialized: true
    });
    
    return result;
  } catch (error) {
    logger.log('KERNEL', `Import failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Clear vector DB
 */
export async function clearVectorDB(): Promise<void> {
  try {
    await localVectorDB.clear();
    
    // Update stats
    useKernelStore.getState().setVectorDBStats({
      totalVectors: 0,
      indexSize: 0,
      cacheSize: 0,
      averageVectorSize: 0,
      isInitialized: true
    });
    
    logger.log('KERNEL', 'Vector DB cleared', 'info');
  } catch (error) {
    logger.log('KERNEL', `Clear failed: ${error.message}`, 'error');
    throw error;
  }
}
