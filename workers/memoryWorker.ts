/**
 * Web Worker for Memory Operations
 * Offloads heavy search and indexing operations from main thread
 */

export interface WorkerMessage {
  id: string;
  type: 'search' | 'index' | 'similarity' | 'cluster';
  payload: any;
}

export interface WorkerResponse {
  id: string;
  type: string;
  result: any;
  error?: string;
}

// TF-IDF implementation for similarity search
class TFIDF {
  private documents: Map<string, string[]> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount = 0;

  addDocument(id: string, text: string): void {
    const tokens = this.tokenize(text);
    this.documents.set(id, tokens);
    this.documentCount++;
    this.updateIDF();
  }

  removeDocument(id: string): void {
    if (this.documents.has(id)) {
      this.documents.delete(id);
      this.documentCount--;
      this.updateIDF();
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private updateIDF(): void {
    const documentFrequency: Map<string, number> = new Map();
    
    this.documents.forEach(tokens => {
      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(token => {
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      });
    });

    documentFrequency.forEach((freq, token) => {
      this.idf.set(token, Math.log(this.documentCount / freq));
    });
  }

  calculateSimilarity(docId1: string, docId2: string): number {
    const tokens1 = this.documents.get(docId1);
    const tokens2 = this.documents.get(docId2);
    
    if (!tokens1 || !tokens2) return 0;

    const tf1 = this.calculateTF(tokens1);
    const tf2 = this.calculateTF(tokens2);

    const allTokens = new Set([...tf1.keys(), ...tf2.keys()]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    allTokens.forEach(token => {
      const idf = this.idf.get(token) || 0;
      const v1 = (tf1.get(token) || 0) * idf;
      const v2 = (tf2.get(token) || 0) * idf;
      
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    });

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  search(query: string, topK: number = 5): Array<{ id: string; score: number }> {
    const queryTokens = this.tokenize(query);
    const queryTF = this.calculateTF(queryTokens);
    const results: Array<{ id: string; score: number }> = [];

    this.documents.forEach((_, id) => {
      const score = this.calculateQuerySimilarity(id, queryTF);
      if (score > 0) {
        results.push({ id, score });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private calculateTF(tokens: string[]): Map<string, number> {
    const tf: Map<string, number> = new Map();
    const total = tokens.length;
    
    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1 / total);
    });
    
    return tf;
  }

  private calculateQuerySimilarity(docId: string, queryTF: Map<string, number>): number {
    const docTokens = this.documents.get(docId);
    if (!docTokens) return 0;

    const docTF = this.calculateTF(docTokens);
    const allTokens = new Set([...queryTF.keys(), ...docTF.keys()]);
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    allTokens.forEach(token => {
      const idf = this.idf.get(token) || 0;
      const v1 = (queryTF.get(token) || 0) * idf;
      const v2 = (docTF.get(token) || 0) * idf;
      
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    });

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

// Cluster memories by similarity
function clusterMemories(
  memories: Array<{ id: string; content: string }>,
  threshold: number = 0.5
): Array<{ clusterId: string; memories: string[]; centroid: string }> {
  const tfidf = new TFIDF();
  
  // Add all documents
  memories.forEach(m => tfidf.addDocument(m.id, m.content));
  
  const clusters: Array<{ clusterId: string; memories: string[]; centroid: string }> = [];
  const assigned = new Set<string>();
  
  memories.forEach(memory => {
    if (assigned.has(memory.id)) return;
    
    const cluster: string[] = [memory.id];
    assigned.add(memory.id);
    
    memories.forEach(other => {
      if (assigned.has(other.id)) return;
      
      const similarity = tfidf.calculateSimilarity(memory.id, other.id);
      if (similarity >= threshold) {
        cluster.push(other.id);
        assigned.add(other.id);
      }
    });
    
    clusters.push({
      clusterId: `cluster_${clusters.length}`,
      memories: cluster,
      centroid: memory.id
    });
  });
  
  return clusters;
}

// Message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    let result: any;

    switch (type) {
      case 'search':
        {
          const { memories, query, limit } = payload;
          const tfidf = new TFIDF();
          memories.forEach((m: any) => tfidf.addDocument(m.id, m.content));
          result = tfidf.search(query, limit);
        }
        break;

      case 'similarity':
        {
          const { memories } = payload;
          const tfidf = new TFIDF();
          memories.forEach((m: any) => tfidf.addDocument(m.id, m.content));
          
          // Calculate pairwise similarities
          const similarities: Array<{ id1: string; id2: string; score: number }> = [];
          for (let i = 0; i < memories.length; i++) {
            for (let j = i + 1; j < memories.length; j++) {
              const score = tfidf.calculateSimilarity(memories[i].id, memories[j].id);
              if (score > 0.3) {
                similarities.push({ id1: memories[i].id, id2: memories[j].id, score });
              }
            }
          }
          result = similarities.sort((a, b) => b.score - a.score);
        }
        break;

      case 'cluster':
        {
          const { memories, threshold } = payload;
          result = clusterMemories(memories, threshold);
        }
        break;

      case 'index':
        {
          const { memories } = payload;
          const tfidf = new TFIDF();
          memories.forEach((m: any) => tfidf.addDocument(m.id, m.content));
          result = { indexed: memories.length };
        }
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = {
      id,
      type,
      result
    };

    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    self.postMessage(response);
  }
};

export {};
