import { randomUUID } from "crypto";
import { MongoClient } from "mongodb";

export class MongoStorage {
  constructor(client, db) {
    this.client = client;
    this.db = db;
    this.users = db.collection("users");
    this.documents = db.collection("documents");
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
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async findUserByEmail(email) {
    if (!email) return null;
    const normalizedEmail = email.toLowerCase();
    return await this.users.findOne({ email: normalizedEmail });
  }

  async getUserById(id) {
    if (!id) return null;
    const user = await this.users.findOne({ id });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
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
    return await this.documents.findOne({ id });
  }

  async getAllDocuments(userId) {
    const filter = userId ? { userId } : {};
    return await this.documents.find(filter).sort({ uploadedAt: -1 }).toArray();
  }

  async updateDocumentStatus(id, status, metadata) {
    const updateData = { status };
    if (status === "completed") {
      updateData.processedAt = new Date();
    }
    if (metadata) {
      updateData.metadata = metadata;
      if (metadata.totalPages) updateData.totalPages = metadata.totalPages;
      if (metadata.totalChunks) updateData.totalChunks = metadata.totalChunks;
    }
    await this.documents.updateOne({ id }, { $set: updateData });
  }

  async deleteDocument(id, userId) {
    const filter = userId ? { id, userId } : { id };
    await this.documents.deleteOne(filter);
    // Note: Pinecone cleanup is handled separately in the controller
  }

  // User profile methods
  async updateUserProfile(userId, profileData) {
    const { name, bio, avatar } = profileData;
    await this.users.updateOne(
      { id: userId },
      { 
        $set: { 
          name: name || null,
          bio: bio || null,
          avatar: avatar || null,
          updatedAt: new Date()
        } 
      }
    );
    return await this.getUserById(userId);
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
    return await this.conversations.findOne({ id });
  }

  async getAllConversations() {
    return await this.conversations
      .find({})
      .sort({ lastMessageAt: -1 })
      .toArray();
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
      { $set: { lastMessageAt: new Date() } },
    );

    return message;
  }

  async getConversationMessages(conversationId) {
    return await this.messages
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

  if (!uri) {
    throw new Error("MONGODB_URI must be set in environment");
  }
  if (!dbName) {
    throw new Error("MONGODB_DB must be set in environment");
  }

  console.log("Connecting to MongoDB...");

  try {
    const client = new MongoClient(uri, {
      ignoreUndefined: true,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      maxPoolSize: 5,
    });

    await client.connect();

    const db = client.db(dbName);
    await db.admin().ping();
    console.log("✓ MongoDB connected successfully");

    // Create indexes (safe to ignore errors if already exist)
    try {
      await db.collection("users").createIndex({ id: 1 }, { unique: true });
      await db.collection("users").createIndex({ email: 1 }, { unique: true });
      await db.collection("documents").createIndex({ id: 1 }, { unique: true });
      await db
        .collection("documents")
        .createIndex({ userId: 1, uploadedAt: -1 });
      // Document chunks are stored in Pinecone, not MongoDB
      await db
        .collection("conversations")
        .createIndex({ id: 1 }, { unique: true });
      await db.collection("messages").createIndex({ id: 1 }, { unique: true });
      await db
        .collection("messages")
        .createIndex({ conversationId: 1, createdAt: 1 });
      console.log("Database indexes created successfully");
    } catch {
      console.log("Index creation completed (some may already exist)");
    }

    return new MongoStorage(client, db);
  } catch (error) {
    console.error("✗ Failed to connect to MongoDB:", error.message);
    throw error;
  }
}
