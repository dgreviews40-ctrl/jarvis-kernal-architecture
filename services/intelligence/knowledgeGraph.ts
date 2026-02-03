/**
 * Knowledge Graph System
 * 
 * Manages relationships between entities, concepts, and memories:
 * - Entity extraction and linking
 * - Relationship inference
 * - Semantic connections
 * - Knowledge expansion
 * - Query answering based on relationships
 */

import { memory as memoryOptimized } from "../memory";

interface Entity {
  id: string;
  name: string;
  type: 'person' | 'place' | 'thing' | 'concept' | 'event' | 'time' | 'organization';
  aliases: string[];
  attributes: Map<string, unknown>;
  firstMentioned: number;
  lastMentioned: number;
  mentionCount: number;
}

interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  confidence: number;
  bidirectional: boolean;
  metadata: Record<string, unknown>;
  established: number;
  lastUpdated: number;
}

interface KnowledgePath {
  entities: Entity[];
  relationships: Relationship[];
  confidence: number;
  pathLength: number;
}

interface SemanticCluster {
  id: string;
  name: string;
  entities: Set<string>;
  centroid: number[]; // Vector representation
  coherence: number;
}

export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private entityNameIndex: Map<string, string> = new Map(); // name -> entityId
  private clusters: Map<string, SemanticCluster> = new Map();
  
  private readonly MIN_CONFIDENCE = 0.3;
  private readonly MAX_PATH_LENGTH = 5;

  /**
   * Extract entities from text
   */
  extractEntities(text: string): Entity[] {
    const foundEntities: Entity[] = [];
    const lowerText = text.toLowerCase();

    // Person patterns
    const personPatterns = [
      /\b(my wife|my husband|my partner|my girlfriend|my boyfriend|my mom|my dad|my mother|my father|my sister|my brother|my friend)\b/gi,
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g // Capitalized names
    ];

    // Place patterns
    const placePatterns = [
      /\b(in|at|to)\s+(the\s+)?(kitchen|bedroom|living room|bathroom|garage|office|garden)\b/gi,
      /\b(in|at|to)\s+(the\s+)?(store|market|mall|restaurant|hospital|school)\b/gi
    ];

    // Thing patterns
    const thingPatterns = [
      /\b(my\s+)?(car|phone|computer|laptop|tv|television|bike|book|keys|wallet)\b/gi,
      /\b(the\s+)?(printer|router|server|camera|speaker|light|thermostat)\b/gi
    ];

    // Time patterns
    const timePatterns = [
      /\b(tomorrow|today|yesterday|next week|last week|in \d+ (days?|weeks?|months?))\b/gi,
      /\b(at|around)\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi
    ];

    // Extract and create entities
    const extractMatches = (patterns: RegExp[], type: Entity['type']) => {
      patterns.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const name = match[0].trim();
          const entity = this.getOrCreateEntity(name, type);
          entity.mentionCount++;
          entity.lastMentioned = Date.now();
          foundEntities.push(entity);
        }
      });
    };

    extractMatches(personPatterns, 'person');
    extractMatches(placePatterns, 'place');
    extractMatches(thingPatterns, 'thing');
    extractMatches(timePatterns, 'time');

    // Extract concepts (nouns that appear multiple times)
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordFreq = new Map<string, number>();
    words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
    
    wordFreq.forEach((freq, word) => {
      if (freq >= 2 && !this.isCommonWord(word)) {
        const entity = this.getOrCreateEntity(word, 'concept');
        entity.mentionCount += freq;
        entity.lastMentioned = Date.now();
        foundEntities.push(entity);
      }
    });

    return [...new Set(foundEntities)]; // Remove duplicates
  }

  /**
   * Check if word is common (shouldn't be an entity)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'this', 'that', 'with', 'from', 'they', 'have', 'were', 'been',
      'their', 'said', 'each', 'which', 'will', 'about', 'could',
      'would', 'there', 'where', 'when', 'what', 'make', 'like',
      'time', 'just', 'know', 'take', 'people', 'year', 'good',
      'some', 'come', 'these', 'look', 'want', 'here', 'more',
      'very', 'after', 'back', 'work', 'first', 'well', 'also'
    ];
    return commonWords.includes(word);
  }

  /**
   * Get existing entity or create new one
   */
  private getOrCreateEntity(name: string, type: Entity['type']): Entity {
    const normalizedName = name.toLowerCase().trim();
    const existingId = this.entityNameIndex.get(normalizedName);
    
    if (existingId) {
      return this.entities.get(existingId)!;
    }

    const id = `ent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const entity: Entity = {
      id,
      name: name.trim(),
      type,
      aliases: [normalizedName],
      attributes: new Map(),
      firstMentioned: Date.now(),
      lastMentioned: Date.now(),
      mentionCount: 1
    };

    this.entities.set(id, entity);
    this.entityNameIndex.set(normalizedName, id);

    return entity;
  }

  /**
   * Establish relationship between entities
   */
  establishRelationship(
    sourceName: string,
    targetName: string,
    relationshipType: string,
    confidence: number = 0.5,
    bidirectional: boolean = false,
    metadata: Record<string, unknown> = {}
  ): Relationship | null {
    if (confidence < this.MIN_CONFIDENCE) return null;

    const source = this.findEntity(sourceName);
    const target = this.findEntity(targetName);

    if (!source || !target) return null;

    // Check if relationship already exists
    const existingId = this.findExistingRelationship(source.id, target.id, relationshipType);
    if (existingId) {
      const existing = this.relationships.get(existingId)!;
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.lastUpdated = Date.now();
      return existing;
    }

    const id = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const relationship: Relationship = {
      id,
      sourceId: source.id,
      targetId: target.id,
      type: relationshipType,
      confidence,
      bidirectional,
      metadata,
      established: Date.now(),
      lastUpdated: Date.now()
    };

    this.relationships.set(id, relationship);

    // If bidirectional, create reverse relationship
    if (bidirectional) {
      this.establishRelationship(targetName, sourceName, relationshipType, confidence, false, metadata);
    }

    return relationship;
  }

  /**
   * Find entity by name or alias
   */
  private findEntity(name: string): Entity | undefined {
    const normalized = name.toLowerCase().trim();
    const id = this.entityNameIndex.get(normalized);
    if (id) return this.entities.get(id);

    // Try partial match
    for (const entity of this.entities.values()) {
      if (entity.aliases.some(a => a.includes(normalized)) || 
          normalized.includes(entity.name.toLowerCase())) {
        return entity;
      }
    }

    return undefined;
  }

  /**
   * Find existing relationship
   */
  private findExistingRelationship(sourceId: string, targetId: string, type: string): string | null {
    for (const [id, rel] of this.relationships) {
      if (rel.sourceId === sourceId && rel.targetId === targetId && rel.type === type) {
        return id;
      }
    }
    return null;
  }

  /**
   * Infer relationships from text context
   */
  inferRelationships(text: string, context: Record<string, unknown> = {}): Relationship[] {
    const inferred: Relationship[] = [];
    const entities = this.extractEntities(text);

    if (entities.length < 2) return inferred;

    // Common relationship patterns
    const patterns = [
      { regex: /(\w+)\s+(is|are|was|were)\s+(?:a|an|the)?\s*(\w+)/i, type: 'is_a' },
      { regex: /(\w+)\s+(has|have|had)\s+(?:a|an|the)?\s*(\w+)/i, type: 'has' },
      { regex: /(\w+)\s+(?:in|at|on)\s+(?:the)?\s*(\w+)/i, type: 'located_in' },
      { regex: /(\w+)\s+(?:works?|worked)\s+(?:for|at|with)\s+(?:the)?\s*(\w+)/i, type: 'works_for' },
      { regex: /(\w+)\s+(?:knows?|knew|met)\s+(\w+)/i, type: 'knows' },
      { regex: /(\w+)\s+(?:likes?|loves?|enjoys?)\s+(\w+)/i, type: 'likes' }
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern.regex);
      for (const match of matches) {
        const source = entities.find(e => match[1].toLowerCase().includes(e.name.toLowerCase()));
        const target = entities.find(e => match[2].toLowerCase().includes(e.name.toLowerCase()));

        if (source && target && source.id !== target.id) {
          const rel = this.establishRelationship(
            source.name,
            target.name,
            pattern.type,
            0.6,
            pattern.type === 'knows' || pattern.type === 'likes'
          );
          if (rel) inferred.push(rel);
        }
      }
    }

    // Co-occurrence relationships (entities mentioned together)
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const rel = this.establishRelationship(
          entities[i].name,
          entities[j].name,
          'related_to',
          0.4,
          true,
          { reason: 'co-occurrence' }
        );
        if (rel) inferred.push(rel);
      }
    }

    return inferred;
  }

  /**
   * Find path between two entities
   */
  findPath(sourceName: string, targetName: string, maxLength: number = this.MAX_PATH_LENGTH): KnowledgePath | null {
    const source = this.findEntity(sourceName);
    const target = this.findEntity(targetName);

    if (!source || !target) return null;

    // BFS for shortest path
    const queue: { entityId: string; path: string[]; rels: string[] }[] = [
      { entityId: source.id, path: [source.id], rels: [] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.entityId === target.id) {
        // Found path
        const pathEntities = current.path.map(id => this.entities.get(id)!);
        const pathRelationships = current.rels.map(id => this.relationships.get(id)!);
        
        const avgConfidence = pathRelationships.reduce((sum, r) => sum + r.confidence, 0) / pathRelationships.length;

        return {
          entities: pathEntities,
          relationships: pathRelationships,
          confidence: avgConfidence,
          pathLength: current.path.length
        };
      }

      if (current.path.length >= maxLength) continue;
      if (visited.has(current.entityId)) continue;
      visited.add(current.entityId);

      // Find connected entities
      for (const rel of this.relationships.values()) {
        let nextId: string | null = null;
        
        if (rel.sourceId === current.entityId) {
          nextId = rel.targetId;
        } else if (rel.bidirectional && rel.targetId === current.entityId) {
          nextId = rel.sourceId;
        }

        if (nextId && !visited.has(nextId)) {
          queue.push({
            entityId: nextId,
            path: [...current.path, nextId],
            rels: [...current.rels, rel.id]
          });
        }
      }
    }

    return null;
  }

  /**
   * Query the knowledge graph
   */
  query(question: string): {
    answer: string;
    confidence: number;
    sources: string[];
  } {
    const lowerQuestion = question.toLowerCase();
    const entities = this.extractEntities(question);

    // Simple query patterns
    if (lowerQuestion.includes('who is') || lowerQuestion.includes('what is')) {
      const subject = entities[0];
      if (subject) {
        const relationships = this.getEntityRelationships(subject.id);
        const isARel = relationships.find(r => r.type === 'is_a');
        
        if (isARel) {
          const target = this.entities.get(isARel.targetId);
          return {
            answer: `${subject.name} is ${target?.name || 'something'}.`,
            confidence: isARel.confidence,
            sources: [`Relationship: ${subject.name} ${isARel.type} ${target?.name}`]
          };
        }
      }
    }

    if (lowerQuestion.includes('where is') || lowerQuestion.includes('where are')) {
      const subject = entities[0];
      if (subject) {
        const relationships = this.getEntityRelationships(subject.id);
        const locatedRel = relationships.find(r => r.type === 'located_in');
        
        if (locatedRel) {
          const location = this.entities.get(locatedRel.targetId);
          return {
            answer: `${subject.name} is in ${location?.name || 'an unknown location'}.`,
            confidence: locatedRel.confidence,
            sources: [`Relationship: ${subject.name} ${locatedRel.type} ${location?.name}`]
          };
        }
      }
    }

    if (lowerQuestion.includes('how are') && lowerQuestion.includes('related')) {
      if (entities.length >= 2) {
        const path = this.findPath(entities[0].name, entities[1].name);
        if (path) {
          const pathDescription = path.relationships
            .map(r => r.type.replace(/_/g, ' '))
            .join(' → ');
          
          return {
            answer: `${entities[0].name} and ${entities[1].name} are connected: ${pathDescription}.`,
            confidence: path.confidence,
            sources: path.relationships.map(r => `Relationship: ${r.type}`)
          };
        }
      }
    }

    return {
      answer: "I don't have enough information to answer that question.",
      confidence: 0,
      sources: []
    };
  }

  /**
   * Get all relationships for an entity
   */
  private getEntityRelationships(entityId: string): Relationship[] {
    return Array.from(this.relationships.values())
      .filter(r => r.sourceId === entityId || (r.bidirectional && r.targetId === entityId));
  }

  /**
   * Get related entities
   */
  getRelatedEntities(entityName: string, relationshipType?: string): Entity[] {
    const entity = this.findEntity(entityName);
    if (!entity) return [];

    const related = new Set<string>();
    
    for (const rel of this.relationships.values()) {
      if (relationshipType && rel.type !== relationshipType) continue;

      if (rel.sourceId === entity.id) {
        related.add(rel.targetId);
      } else if (rel.bidirectional && rel.targetId === entity.id) {
        related.add(rel.sourceId);
      }
    }

    return Array.from(related)
      .map(id => this.entities.get(id))
      .filter((e): e is Entity => e !== undefined);
  }

  /**
   * Build semantic clusters
   */
  buildClusters(): void {
    // Simple clustering based on relationship density
    const entityConnections = new Map<string, Set<string>>();

    // Build connection map
    for (const rel of this.relationships.values()) {
      if (!entityConnections.has(rel.sourceId)) {
        entityConnections.set(rel.sourceId, new Set());
      }
      entityConnections.get(rel.sourceId)!.add(rel.targetId);

      if (rel.bidirectional) {
        if (!entityConnections.has(rel.targetId)) {
          entityConnections.set(rel.targetId, new Set());
        }
        entityConnections.get(rel.targetId)!.add(rel.sourceId);
      }
    }

    // Find clusters using simple connected components
    const visited = new Set<string>();
    let clusterId = 0;

    for (const entityId of this.entities.keys()) {
      if (visited.has(entityId)) continue;

      const cluster = new Set<string>();
      const queue = [entityId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        cluster.add(current);

        const connections = entityConnections.get(current) || new Set();
        for (const connected of connections) {
          if (!visited.has(connected)) {
            queue.push(connected);
          }
        }
      }

      if (cluster.size >= 2) {
        const clusterName = this.generateClusterName(cluster);
        this.clusters.set(`cluster_${clusterId++}`, {
          id: `cluster_${clusterId}`,
          name: clusterName,
          entities: cluster,
          centroid: [],
          coherence: cluster.size / (this.entities.size * 0.1)
        });
      }
    }
  }

  /**
   * Generate name for a cluster
   */
  private generateClusterName(entities: Set<string>): string {
    const entityList = Array.from(entities)
      .map(id => this.entities.get(id)?.name)
      .filter((name): name is string => !!name)
      .slice(0, 3);

    if (entityList.length === 0) return 'Unknown Cluster';
    return `${entityList.join(', ')} group`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    entityCount: number;
    relationshipCount: number;
    clusterCount: number;
    topEntities: { name: string; mentions: number }[];
  } {
    const sortedEntities = Array.from(this.entities.values())
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 5)
      .map(e => ({ name: e.name, mentions: e.mentionCount }));

    return {
      entityCount: this.entities.size,
      relationshipCount: this.relationships.size,
      clusterCount: this.clusters.size,
      topEntities: sortedEntities
    };
  }

  /**
   * Export graph data
   */
  exportGraph(): {
    entities: Omit<Entity, 'attributes'>[];
    relationships: Relationship[];
  } {
    return {
      entities: Array.from(this.entities.values()).map(e => ({
        ...e,
        attributes: undefined as any
      })),
      relationships: Array.from(this.relationships.values())
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.entities.clear();
    this.relationships.clear();
    this.entityNameIndex.clear();
    this.clusters.clear();
  }
}

export const knowledgeGraph = new KnowledgeGraph();
