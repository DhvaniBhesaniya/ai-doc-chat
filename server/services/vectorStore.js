import { createEmbedding } from "./gemini.js";
import { storage } from "../storage.js";

export class VectorStore {
  async addDocument(documentId, chunks) {
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await createEmbedding(chunks[i]);
      
      await storage.createDocumentChunk({
        documentId,
        chunkIndex: i,
        content: chunks[i],
        pageNumber: Math.floor(i / 3) + 1, // Rough page estimation
        embedding,
        metadata: { length: chunks[i].length }
      });
    }
  }

  async search(query, limit = 5) {
    try {
      const queryEmbedding = await createEmbedding(query);
      const chunks = await storage.searchChunksByEmbedding(queryEmbedding, limit);
      
      const results = [];
      
      for (const chunk of chunks) {
        const document = await storage.getDocument(chunk.documentId);
        if (document) {
          const score = this.calculateSimilarity(queryEmbedding, chunk.embedding);
          results.push({
            chunk,
            documentName: document.originalName,
            score
          });
        }
      }
      
      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error("Error searching vector store:", error);
      return [];
    }
  }

  calculateSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const vectorStore = new VectorStore();