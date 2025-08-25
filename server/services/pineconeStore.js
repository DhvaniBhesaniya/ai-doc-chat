// import { Pinecone } from "@pinecone-database/pinecone";

// class PineconeVectorStore {
//   constructor() {
//     this.pinecone = null;
//     this.index = null;
//     this.indexName = "ai-doc-chat";
//     this.initialized = false;
//   }

//   async initialize() {
//     try {
//       console.log("Initializing Pinecone connection...");

//       const apiKey = process.env.PINECONE_API_KEY;
//       if (!apiKey) {
//         throw new Error("PINECONE_API_KEY not found in environment variables");
//       }

//       this.pinecone = new Pinecone({
//         apiKey: apiKey,
//       });

//       // List existing indexes
//       const indexes = await this.pinecone.listIndexes();
//       console.log(
//         "Available indexes:",
//         indexes.indexes?.map((idx) => idx.name) || []
//       );

//       // Check if our index exists
//       const indexExists = indexes.indexes?.some(
//         (idx) => idx.name === this.indexName
//       );

//       if (!indexExists) {
//         console.log(`Creating index: ${this.indexName}`);
//         await this.pinecone.createIndex({
//           name: this.indexName,
//           dimension: 1024, // llama-test-embed-v2 text embeding model , diemnsion
//           metric: "cosine",
//           spec: {
//             serverless: {
//               cloud: "aws",
//               region: "us-east-1",
//             },
//           },
//         });

//         // Wait for index to be ready
//         console.log("Waiting for index to be ready...");
//         await this.waitForIndexReady();
//       }

//       this.index = this.pinecone.index(this.indexName);
//       this.initialized = true;
//       console.log("Pinecone initialized successfully");

//       return true;
//     } catch (error) {
//       console.error("Failed to initialize Pinecone:", error);
//       return false;
//     }
//   }

//   async waitForIndexReady() {
//     const maxAttempts = 30;
//     let attempts = 0;

//     while (attempts < maxAttempts) {
//       try {
//         const indexDescription = await this.pinecone.describeIndex(
//           this.indexName
//         );
//         if (indexDescription.status?.ready) {
//           console.log("Index is ready");
//           return;
//         }
//         console.log(
//           `Index not ready yet, attempt ${attempts + 1}/${maxAttempts}`
//         );
//         await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
//         attempts++;
//       } catch (error) {
//         console.error("Error checking index status:", error);
//         attempts++;
//         await new Promise((resolve) => setTimeout(resolve, 10000));
//       }
//     }

//     throw new Error("Index did not become ready within expected time");
//   }

//   async upsertVectors(vectors) {
//     if (!this.initialized) {
//       const success = await this.initialize();
//       if (!success) {
//         throw new Error("Failed to initialize Pinecone");
//       }
//     }

//     try {
//       console.log(`Upserting ${vectors.length} vectors to Pinecone`);

//       // Ensure each vector contains required metadata fields
//       const normalized = vectors.map((v) => {
//         const meta = v.metadata || {};
//         return {
//           id: v.id,
//           values: v.values,
//           metadata: {
//             // Required for delete/query by name
//             documentName: String(meta.documentName || meta.filename || ""),
//             // Helpful extras for debugging/search
//             documentId: meta.documentId || null,
//             pageNumber:
//               typeof meta.pageNumber === "number" ? meta.pageNumber : null,
//             chunkIndex:
//               typeof meta.chunkIndex === "number" ? meta.chunkIndex : null,
//             content: meta.content || meta.text || "",
//             length: typeof meta.length === "number" ? meta.length : undefined,
//             wordCount:
//               typeof meta.wordCount === "number" ? meta.wordCount : undefined,
//           },
//         };
//       });

//       // Batch upsert (Pinecone supports up to ~100 vectors per batch)
//       const batchSize = 100;
//       for (let i = 0; i < normalized.length; i += batchSize) {
//         const batch = normalized.slice(i, i + batchSize);
//         await this.index.upsert(batch);
//         console.log(
//           `Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
//             normalized.length / batchSize
//           )}`
//         );
//       }

//       console.log("All vectors upserted successfully");
//       return true;
//     } catch (error) {
//       console.error("Error upserting vectors:", error);
//       throw error;
//     }
//   }

//   async queryVectors(queryVector, topK = 5, filter = null) {
//     if (!this.initialized) {
//       const success = await this.initialize();
//       if (!success) {
//         throw new Error("Failed to initialize Pinecone");
//       }
//     }

//     try {
//       console.log(`Querying Pinecone for top ${topK} similar vectors`);

//       const queryRequest = {
//         vector: queryVector,
//         topK: topK,
//         includeMetadata: true,
//         includeValues: false,
//       };

//       if (filter) {
//         queryRequest.filter = filter;
//       }

//       const queryResponse = await this.index.query(queryRequest);

//       console.log(`Found ${queryResponse.matches?.length || 0} matches`);
//       return queryResponse.matches || [];
//     } catch (error) {
//       console.error("Error querying vectors:", error);
//       throw error;
//     }
//   }

//   /**
//    * Delete all vectors with a given documentName (by metadata) in SERVERLESS indexes.
//    * This gets matches by querying, then deletes by ID.
//    */
//   async deleteVectorsByDocumentName(documentName) {
//     if (!this.initialized) {
//       const success = await this.initialize();
//       if (!success) {
//         throw new Error("Failed to initialize Pinecone");
//       }
//     }

//     try {
//       console.log(`Deleting all vectors for document: ${documentName}`);

//       const batchSize = 100;
//       let idsToDelete = [];
//       let totalDeleted = 0;

//       // Use a loop to query the whole index iteratively until no more matches are found.
//       // Since Pinecone serverless doesn't support filtering in query directly, here we query top vectors and filter in code.
//       // Adjust topK or add pagination if supported by SDK.

//       // Use a flag to stop
//       let keepQuerying = true;

//       while (keepQuerying) {
//         console.log(
//           `Querying top ${batchSize} vectors for filtering by documentName...`
//         );
//         const queryResponse = await this.index.query({
//           vector: Array(this.dimension).fill(0), // dummy zero vector
//           topK: batchSize,
//           includeMetadata: true,
//           includeValues: false,
//         });

//         const matches = queryResponse.matches || [];
//         console.log(`Queried ${matches.length} vectors`);

//         // Filter these matches by documentName metadata
//         const filtered = matches.filter(
//           (v) => v.metadata && v.metadata.documentName === documentName
//         );

//         console.log(
//           `Found ${filtered.length} vectors matching documentName "${documentName}" in this batch`
//         );

//         // If no filtered matches found, stop querying
//         if (filtered.length === 0) {
//           keepQuerying = false;
//           break;
//         }

//         const batchIds = filtered.map((v) => v.id);

//         console.log(`Deleting batch of ${batchIds.length} vectors...`);
//         await this.index.deleteMany([batchIds]);
//         console.log(`Deleted batch of ${batchIds.length} vectors.`);

//         totalDeleted += batchIds.length;

//         // If less than batch size, assume no more relevant vectors to process
//         if (matches.length < batchSize) {
//           keepQuerying = false;
//         }
//       }

//       console.log(
//         `Deletion completed. Total vectors deleted for document "${documentName}": ${totalDeleted}`
//       );
//       return true;
//     } catch (error) {
//       console.error("Error deleting vectors by document name:", error);
//       throw error;
//     }
//   }
// }

// // Export singleton instance
// export const pineconeStore = new PineconeVectorStore();

//===================================================================================================================
//    perplixity  code .
//===================================================================================================================

import { Pinecone } from "@pinecone-database/pinecone";

class PineconeVectorStore {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.indexName = "ai-doc-chat";
    this.dimension = 1024; // make sure this matches your embedding model!
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log("Initializing Pinecone connection...");
      const apiKey = process.env.PINECONE_API_KEY;
      if (!apiKey) {
        throw new Error("PINECONE_API_KEY not found in environment variables");
      }

      this.pinecone = new Pinecone({ apiKey });
      const indexes = await this.pinecone.listIndexes();
      console.log(
        "Available indexes:",
        indexes.indexes?.map((idx) => idx.name) || []
      );

      // Check if our index exists
      const indexExists = indexes.indexes?.some(
        (idx) => idx.name === this.indexName
      );

      if (!indexExists) {
        console.log(`Creating index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          metric: "cosine",
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1",
            },
          },
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
        const indexDescription = await this.pinecone.describeIndex(
          this.indexName
        );
        if (indexDescription.status?.ready) {
          console.log("Index is ready");
          return;
        }
        console.log(
          `Index not ready yet, attempt ${attempts + 1}/${maxAttempts}`
        );
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
      } catch (error) {
        console.error("Error checking index status:", error);
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 10000));
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
      // Ensure each vector contains required metadata fields
      const normalized = vectors.map((v) => {
        const meta = v.metadata || {};
        return {
          id: v.id,
          values: v.values,
          metadata: {
            documentName: String(meta.documentName || meta.filename || ""),
            documentId: meta.documentId || null,
            pageNumber:
              typeof meta.pageNumber === "number" ? meta.pageNumber : null,
            chunkIndex:
              typeof meta.chunkIndex === "number" ? meta.chunkIndex : null,
            content: meta.content || meta.text || "",
            length: typeof meta.length === "number" ? meta.length : undefined,
            wordCount:
              typeof meta.wordCount === "number" ? meta.wordCount : undefined,
          },
        };
      });
      // Batch upsert
      const batchSize = 100;
      for (let i = 0; i < normalized.length; i += batchSize) {
        const batch = normalized.slice(i, i + batchSize);
        await this.index.upsert(batch);
        console.log(
          `Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            normalized.length / batchSize
          )}`
        );
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
        includeValues: false,
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

  /**
   * Delete all vectors with a given documentName (by metadata) in SERVERLESS indexes.
   * This gets matches by querying, then deletes by ID.
   */
  async deleteVectorsByDocumentName(documentName) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error("Failed to initialize Pinecone");
      }
    }

    try {
      console.log(`Deleting all vectors for document: ${documentName}`);

      const batchSize = 100;
      let idsToDelete = [];
      let totalDeleted = 0;

      // Use a loop to query the whole index iteratively until no more matches are found.
      // Since Pinecone serverless doesn't support filtering in query directly, here we query top vectors and filter in code.
      // Adjust topK or add pagination if supported by SDK.

      // Use a flag to stop
      let keepQuerying = true;

      while (keepQuerying) {
        console.log(
          `Querying top ${batchSize} vectors for filtering by documentName...`
        );
        const queryResponse = await this.index.query({
          vector: Array(this.dimension).fill(0), // dummy zero vector
          topK: batchSize,
          includeMetadata: true,
          includeValues: false,
        });

        const matches = queryResponse.matches || [];
        console.log(`Queried ${matches.length} vectors`);

        // Filter these matches by documentName metadata
        const filtered = matches.filter(
          (v) => v.metadata && v.metadata.documentName === documentName
        );

        console.log(
          `Found ${filtered.length} vectors matching documentName "${documentName}" in this batch`
        );

        // If no filtered matches found, stop querying
        if (filtered.length === 0) {
          keepQuerying = false;
          break;
        }

        const batchIds = filtered.map((v) => v.id);

        console.log(`Deleting batch of ${batchIds.length} vectors...`);
        await this.index.deleteMany([batchIds]);
        console.log(`Deleted batch of ${batchIds.length} vectors.`);

        totalDeleted += batchIds.length;

        // If less than batch size, assume no more relevant vectors to process
        if (matches.length < batchSize) {
          keepQuerying = false;
        }
      }

      console.log(
        `Deletion completed. Total vectors deleted for document "${documentName}": ${totalDeleted}`
      );
      return true;
    } catch (error) {
      console.error("Error deleting vectors by document name:", error);
      throw error;
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
