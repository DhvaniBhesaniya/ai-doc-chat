import { randomUUID } from "crypto";

export class MemStorage {
  constructor() {
    this.documents = new Map();
    this.documentChunks = new Map();
    this.conversations = new Map();
    this.messages = new Map();
  }

  async createDocument(insertDocument) {
    const id = randomUUID();
    const document = {
      ...insertDocument,
      id,
      uploadedAt: new Date(),
      processedAt: null,
    };
    this.documents.set(id, document);
    return document;
  }

  async getDocument(id) {
    return this.documents.get(id);
  }

  async getAllDocuments() {
    return Array.from(this.documents.values()).sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async updateDocumentStatus(id, status, metadata) {
    const document = this.documents.get(id);
    if (document) {
      document.status = status;
      if (status === "completed") {
        document.processedAt = new Date();
      }
      if (metadata) {
        document.metadata = { ...document.metadata, ...metadata };
        if (metadata.totalPages) document.totalPages = metadata.totalPages;
        if (metadata.totalChunks) document.totalChunks = metadata.totalChunks;
      }
      this.documents.set(id, document);
    }
  }

  async deleteDocument(id) {
    this.documents.delete(id);
    // Delete associated chunks
    for (const [chunkId, chunk] of this.documentChunks.entries()) {
      if (chunk.documentId === id) {
        this.documentChunks.delete(chunkId);
      }
    }
  }

  async createDocumentChunk(insertChunk) {
    const id = randomUUID();
    const chunk = {
      ...insertChunk,
      id,
    };
    this.documentChunks.set(id, chunk);
    return chunk;
  }

  async getDocumentChunks(documentId) {
    return Array.from(this.documentChunks.values())
      .filter(chunk => chunk.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async searchChunksByEmbedding(embedding, limit = 5) {
    // Simple cosine similarity for in-memory storage
    const chunksWithScores = Array.from(this.documentChunks.values())
      .filter(chunk => chunk.embedding)
      .map(chunk => ({
        chunk,
        score: this.cosineSimilarity(embedding, chunk.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return chunksWithScores.map(item => item.chunk);
  }

  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async createConversation(insertConversation) {
    const id = randomUUID();
    const conversation = {
      ...insertConversation,
      id,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async getConversation(id) {
    return this.conversations.get(id);
  }

  async getAllConversations() {
    return Array.from(this.conversations.values()).sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  async updateConversationTitle(id, title) {
    const conversation = this.conversations.get(id);
    if (conversation) {
      conversation.title = title;
      this.conversations.set(id, conversation);
    }
  }

  async createMessage(insertMessage) {
    const id = randomUUID();
    const message = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, message);

    // Update conversation last message time
    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      conversation.lastMessageAt = new Date();
      this.conversations.set(insertMessage.conversationId, conversation);
    }
Q: Do you have a physical store?
    return message;
  }

  async getConversationMessages(conversationId) {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}

export const storage = new MemStorage();