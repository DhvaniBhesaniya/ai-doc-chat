import { Pinecone } from '@pinecone-database/pinecone';

class PineconeVectorStore {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.indexName = 'ai-doc-chat';
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log("Initializing Pinecone connection...");
      
      const apiKey = process.env.PINECONE_API_KEY;
      if (!apiKey) {
        throw new Error("PINECONE_API_KEY not found in environment variables");
      }

      this.pinecone = new Pinecone({
        apiKey: apiKey,
      });

      // List existing indexes
      const indexes = await this.pinecone.listIndexes();
      console.log("Available indexes:", indexes.indexes?.map(idx => idx.name) || []);

      // Check if our index exists
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);
      
      if (!indexExists) {
        console.log(`Creating index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1024, // llama-test-embed-v2 text embeding model , diemnsion
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        console.log("Waiting for index to be ready...");
        await this.waitForIndexReady();
      }

      this.index = this.pinecone.index(this.indexName);
      this.initialized = true;
      console.log("Pinecone initialized successfully");
      
      return true;
    } catch (error) {
      console.error("Failed to initialize Pinecone:", error);
      return false;
    }
  }

  async waitForIndexReady() {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const indexDescription = await this.pinecone.describeIndex(this.indexName);
        if (indexDescription.status?.ready) {
          console.log("Index is ready");
          return;
        }
        console.log(`Index not ready yet, attempt ${attempts + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
      } catch (error) {
        console.error("Error checking index status:", error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    throw new Error("Index did not become ready within expected time");
  }

  async upsertVectors(vectors) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error("Failed to initialize Pinecone");
      }
    }

    try {
      console.log(`Upserting ${vectors.length} vectors to Pinecone`);
      
      // Batch upsert (Pinecone supports up to 100 vectors per batch)
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
        console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
      }
      
      console.log("All vectors upserted successfully");
      return true;
    } catch (error) {
      console.error("Error upserting vectors:", error);
      throw error;
    }
  }

  async queryVectors(queryVector, topK = 5, filter = null) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error("Failed to initialize Pinecone");
      }
    }

    try {
      console.log(`Querying Pinecone for top ${topK} similar vectors`);
      
      const queryRequest = {
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
        includeValues: false
      };

      if (filter) {
        queryRequest.filter = filter;
      }

      const queryResponse = await this.index.query(queryRequest);
      
      console.log(`Found ${queryResponse.matches?.length || 0} matches`);
      return queryResponse.matches || [];
    } catch (error) {
      console.error("Error querying vectors:", error);
      throw error;
    }
  }

  async deleteVectors(documentId) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error("Failed to initialize Pinecone");
      }
    }

    try {
      console.log(`Deleting vectors for document: ${documentId}`);
      
      await this.index.delete({
        filter: {
          documentId: { "$eq": documentId }
        }
      });
      
      console.log("Vectors deleted successfully");
      return true;
    } catch (error) {
      console.error("Error deleting vectors:", error);
      throw error;
    }
  }

  async deleteVectorsByDocumentName(documentName) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        console.warn("Pinecone not initialized, skipping cleanup");
        return;
      }
    }

    try {
      console.log(`Deleting existing vectors for document: ${documentName}`);
      
      await this.index.deleteAll({
        filter: {
          documentName: { "$eq": documentName }
        }
      });
      
      console.log("Successfully deleted existing vectors");
    } catch (error) {
      console.error("Error deleting vectors by document name:", error);
      // Don't throw - this is cleanup, continue with upload
    }
  }

  async getStats() {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        return null;
      }
    }

    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error("Error getting index stats:", error);
      return null;
    }
  }
}

// Export singleton instance
export const pineconeStore = new PineconeVectorStore();