import { randomUUID } from "crypto";
import { MongoClient } from "mongodb";

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

  async getAllDocuments(userId) {
    return Array.from(this.documents.values())
      .filter(d => !userId || d.userId === userId)
      .sort((a, b) => 
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

  async deleteDocument(id, userId) {
    const doc = this.documents.get(id);
    if (doc && (!userId || doc.userId === userId)) {
      this.documents.delete(id);
      for (const [chunkId, chunk] of this.documentChunks.entries()) {
        if (chunk.documentId === id) {
          this.documentChunks.delete(chunkId);
        }
      }
    }
  }

  async deleteDocumentChunks(documentId) {
    for (const [chunkId, chunk] of this.documentChunks.entries()) {
      if (chunk.documentId === documentId) {
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
      .filter((chunk) => chunk.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async searchChunksByEmbedding(embedding, limit = 5) {
    const chunksWithScores = Array.from(this.documentChunks.values())
      .filter((chunk) => chunk.embedding)
      .map((chunk) => ({
        chunk,
        score: this.cosineSimilarity(embedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return chunksWithScores.map((item) => item.chunk);
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
    return Array.from(this.conversations.values()).sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
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

    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      conversation.lastMessageAt = new Date();
      this.conversations.set(insertMessage.conversationId, conversation);
    }

    return message;
  }

  async getConversationMessages(conversationId) {
    return Array.from(this.messages.values())
      .filter((message) => message.conversationId === conversationId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }
}

export class MongoStorage {
  constructor(client, db) {
    this.client = client;
    this.db = db;
    this.users = db.collection("users");
    this.documents = db.collection("documents");
    this.chunks = db.collection("document_chunks");
    this.conversations = db.collection("conversations");
    this.messages = db.collection("messages");
  }

  // User methods
  async createUser({ email, passwordHash, name }) {
    const id = randomUUID();
    const user = {
      id,
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      createdAt: new Date(),
    };
    await this.users.insertOne(user);
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  async findUserByEmail(email) {
    if (!email) return null;
    return this.users.findOne({ email: email.toLowerCase() });
  }

  async getUserById(id) {
    if (!id) return null;
    const user = await this.users.findOne({ id });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  async createDocument(insertDocument) {
    const id = randomUUID();
    const document = {
      ...insertDocument,
      id,
      uploadedAt: new Date(),
      processedAt: null,
    };
    await this.documents.insertOne(document);
    return document;
  }

  async getDocument(id) {
    return this.documents.findOne({ id });
  }

  async getAllDocuments(userId) {
    const filter = userId ? { userId } : {};
    return this.documents
      .find(filter)
      .sort({ uploadedAt: -1 })
      .toArray();
  }

  async updateDocumentStatus(id, status, metadata) {
    const update = { $set: { status } };
    if (status === "completed") {
      update.$set.processedAt = new Date();
    }
    if (metadata) {
      update.$set.metadata = { ...(metadata || {}) };
      if (metadata.totalPages) update.$set.totalPages = metadata.totalPages;
      if (metadata.totalChunks) update.$set.totalChunks = metadata.totalChunks;
    }
    await this.documents.updateOne({ id }, update, { upsert: false });
  }

  async deleteDocument(id, userId) {
    await this.documents.deleteOne({ id, ...(userId ? { userId } : {}) });
    await this.chunks.deleteMany({ documentId: id, ...(userId ? { userId } : {}) });
  }

  async deleteDocumentChunks(documentId, userId) {
    await this.chunks.deleteMany({ documentId, ...(userId ? { userId } : {}) });
  }

  async createDocumentChunk(insertChunk) {
    const id = randomUUID();
    const chunk = { ...insertChunk, id };
    await this.chunks.insertOne(chunk);
    return chunk;
  }

  async getDocumentChunks(documentId, userId) {
    return this.chunks
      .find({ documentId, ...(userId ? { userId } : {}) })
      .sort({ chunkIndex: 1 })
      .toArray();
  }

  async searchChunksByEmbedding(embedding, limit = 5, userId) {
    const filter = { embedding: { $exists: true }, ...(userId ? { userId } : {}) };
    const all = await this.chunks.find(filter).toArray();
    const scored = all
      .map((chunk) => ({
        chunk,
        score: this.cosineSimilarity(embedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.chunk);
    return scored;
  }

  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB || 1);
  }

  async createConversation(insertConversation) {
    const id = randomUUID();
    const conversation = {
      ...insertConversation,
      id,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    };
    await this.conversations.insertOne(conversation);
    return conversation;
  }

  async getConversation(id) {
    return this.conversations.findOne({ id });
  }

  async getAllConversations() {
    return this.conversations.find({}).sort({ lastMessageAt: -1 }).toArray();
  }

  async updateConversationTitle(id, title) {
    await this.conversations.updateOne({ id }, { $set: { title } });
  }

  async createMessage(insertMessage) {
    const id = randomUUID();
    const message = { ...insertMessage, id, createdAt: new Date() };
    await this.messages.insertOne(message);

    await this.conversations.updateOne(
      { id: insertMessage.conversationId },
      { $set: { lastMessageAt: new Date() } }
    );

    return message;
  }

  async getConversationMessages(conversationId) {
    return this.messages
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray();
  }
}

export let storage = null;
export function setStorage(instance) {
  storage = instance;
}

export async function createMongoStorage() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and MONGODB_DB must be set in environment");
  }
  const client = new MongoClient(uri, { ignoreUndefined: true });
  await client.connect();
  const db = client.db(dbName);
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("documents").createIndex({ id: 1 }, { unique: true });
  await db.collection("documents").createIndex({ userId: 1, uploadedAt: -1 });
  await db.collection("document_chunks").createIndex({ id: 1 }, { unique: true });
  await db.collection("document_chunks").createIndex({ userId: 1, documentId: 1 });
  await db.collection("messages").createIndex({ userId: 1, conversationId: 1, createdAt: 1 });
  return new MongoStorage(client, db);
}
