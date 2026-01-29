import { PluginManifest, GraphNode, GraphEdge, RuntimePlugin } from "../types";
import { registry } from "./registry";

/**
 * Capability Graph Service
 * Manages the Dependency Acyclic Graph (DAG) for system stability.
 */
class GraphService {
  private nodes: Map<string, GraphNode> = new Map(); // PluginId -> Node
  private edges: GraphEdge[] = [];
  private loadOrder: string[] = []; // Sorted Plugin IDs
  private capabilityMap: Map<string, string[]> = new Map(); // Capability -> [ProviderPluginIds]

  // --- BUILD PHASE ---

  /**
   * Rebuilds the graph from the current registry state.
   */
  public rebuild() {
    this.nodes.clear();
    this.edges = [];
    this.capabilityMap.clear();
    this.loadOrder = [];

    const plugins = registry.getAll();
    
    // 1. Index Capabilities
    plugins.forEach(p => {
      p.manifest.provides.forEach(cap => {
        if (!this.capabilityMap.has(cap)) this.capabilityMap.set(cap, []);
        this.capabilityMap.get(cap)?.push(p.manifest.id);
      });
      
      this.nodes.set(p.manifest.id, {
        pluginId: p.manifest.id,
        layer: 0,
        dependencies: [],
        dependents: []
      });
    });

    // 2. Build Edges (Resolution)
    plugins.forEach(consumer => {
      consumer.manifest.requires.forEach(reqCap => {
        const providers = this.capabilityMap.get(reqCap);
        
        if (!providers || providers.length === 0) {
          console.warn(`[GRAPH] Missing provider for capability '${reqCap}' required by '${consumer.manifest.id}'`);
          // In strict mode, we might disable the plugin here.
          return;
        }

        // Resolution Strategy: Highest Priority Wins
        // If priority is equal, pick the first one (deterministic)
        const bestProviderId = providers.sort((a, b) => {
           const pA = registry.get(a)?.manifest.priority || 0;
           const pB = registry.get(b)?.manifest.priority || 0;
           return pB - pA;
        })[0];

        // Add Edge
        this.edges.push({
          from: bestProviderId,
          to: consumer.manifest.id,
          capability: reqCap
        });

        // Update Node Links
        this.nodes.get(consumer.manifest.id)?.dependencies.push(bestProviderId);
        this.nodes.get(bestProviderId)?.dependents.push(consumer.manifest.id);
      });
    });

    // 3. Cycle Detection & Topological Sort
    try {
      this.loadOrder = this.calculateTopologicalSort();
      this.calculateLayers();
      console.log("[GRAPH] Build Complete. Load Order:", this.loadOrder);
    } catch (e) {
      console.error("[GRAPH] Critical Build Error:", e);
      // Fallback: Just load everything flat if graph fails
      this.loadOrder = plugins.map(p => p.manifest.id);
    }
  }

  // --- ALGORITHMS ---

  /**
   * Kahn's Algorithm for Topological Sort.
   * Throws error if cycle detected.
   */
  private calculateTopologicalSort(): string[] {
    const inDegree: Map<string, number> = new Map();
    this.nodes.forEach(id => inDegree.set(id.pluginId, 0));

    this.edges.forEach(edge => {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((count, id) => {
      if (count === 0) queue.push(id);
    });

    // Sort initial queue by priority (optional, but good for determinism)
    queue.sort((a, b) => (registry.get(b)?.manifest.priority || 0) - (registry.get(a)?.manifest.priority || 0));

    const result: string[] = [];

    while (queue.length > 0) {
      const u = queue.shift()!;
      result.push(u);

      const dependents = this.nodes.get(u)?.dependents || [];
      dependents.forEach(v => {
        inDegree.set(v, (inDegree.get(v) || 0) - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      });
    }

    if (result.length !== this.nodes.size) {
      throw new Error("Cyclic Dependency Detected! Graph cannot be resolved.");
    }

    return result;
  }

  /**
   * Assigns depth layers for visualization.
   * Layer 0 = Roots (No dependencies)
   */
  private calculateLayers() {
    this.loadOrder.forEach(nodeId => {
       const node = this.nodes.get(nodeId);
       if (!node) return;
       
       if (node.dependencies.length === 0) {
         node.layer = 0;
       } else {
         let maxParentLayer = 0;
         node.dependencies.forEach(parentId => {
            const parent = this.nodes.get(parentId);
            if (parent) maxParentLayer = Math.max(maxParentLayer, parent.layer);
         });
         node.layer = maxParentLayer + 1;
       }
    });
  }

  // --- RUNTIME ORCHESTRATION ---

  /**
   * Called when a plugin crashes or is disabled.
   * Pauses all downstream dependents to prevent cascading errors.
   */
  public propagateFailure(failedPluginId: string) {
    const impacted = new Set<string>();
    const queue = [failedPluginId];

    while(queue.length > 0) {
      const current = queue.shift()!;
      const node = this.nodes.get(current);
      if (!node) continue;

      node.dependents.forEach(depId => {
        if (!impacted.has(depId)) {
          impacted.add(depId);
          queue.push(depId);
        }
      });
    }

    // Apply Pause State
    impacted.forEach(id => {
       const plugin = registry.get(id);
       if (plugin && plugin.status === 'ACTIVE') {
         console.warn(`[GRAPH] Pausing '${id}' due to upstream failure in '${failedPluginId}'`);
         registry.setPluginStatus(id, 'PAUSED_DEPENDENCY');
       }
    });
  }

  /**
   * Called when a plugin recovers.
   * Checks if dependents can be resumed.
   */
  public propagateRecovery(recoveredPluginId: string) {
    const node = this.nodes.get(recoveredPluginId);
    if (!node) return;

    node.dependents.forEach(depId => {
       // Check if ALL dependencies of this dependent are now active
       const depNode = this.nodes.get(depId);
       const allClear = depNode?.dependencies.every(parentId => {
          const p = registry.get(parentId);
          return p && p.status === 'ACTIVE';
       });

       if (allClear) {
         const plugin = registry.get(depId);
         if (plugin && plugin.status === 'PAUSED_DEPENDENCY') {
            console.log(`[GRAPH] Resuming '${depId}' - Dependencies restored.`);
            registry.setPluginStatus(depId, 'ACTIVE');
            // Recursively recover its children
            this.propagateRecovery(depId);
         }
       }
    });
  }

  // --- ACCESSORS ---

  public getGraphData() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  public getLoadOrder() {
    return this.loadOrder;
  }
}

export const graphService = new GraphService();