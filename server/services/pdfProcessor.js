import * as fs from "fs";
import * as path from "path";
import { randomUUID, createHash } from "crypto";
import { storage } from "../storage.js";
import { createEmbedding } from "./gemini.js";
import { pineconeStore } from "./pineconeStore.js";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Simple text splitter for chunking
export class RecursiveCharacterTextSplitter {
  constructor(chunkSize = 1000, chunkOverlap = 100) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  splitText(text) {
    console.log("Starting splitText with text length:", text.length);
    const chunks = [];
    let start = 0;
    let iterations = 0;
    const maxIterations = 100; // Safety guard

    while (start < text.length && iterations < maxIterations) {
      iterations++;
      let end = Math.min(start + this.chunkSize, text.length);
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        if (breakPoint > start + this.chunkSize * 0.5) {
          end = breakPoint + 1;
        }
      }
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) chunks.push(chunk);
      start = Math.max(end - this.chunkOverlap, start + 1);
      if (start >= text.length) break;
    }
    return chunks;
  }
}

export async function processPdfFile(fileBuffer, filename, originalName, userId) {
  let document;
  try {
    console.log(`Starting PDF processing for: ${originalName}`);
    
    // Create document record
    document = await storage.createDocument({
      filename,
      originalName,
      fileSize: fileBuffer.length,
      mimeType: "application/pdf",
      status: "processing",
      userId,
    });

    console.log(`Created document record with ID: ${document.id}`);
    
    // Update status to processing with initial progress
    await storage.updateDocumentStatus(document.id, "processing", { progress: 5 });

    // Extract text from PDF buffer using pdf-parse
    console.log("Extracting text from PDF using pdf-parse...");
    let pdfText;
    try {
      const data = await pdfParse(fileBuffer);
      let extractedText = (data.text || '').replace(/\s+/g, ' ').trim();
      if (extractedText && extractedText.length > 100) {
        pdfText = extractedText;
        await storage.updateDocumentStatus(document.id, "processing", {
          totalPages: data.numpages || 1,
          progress: 15
        });
      } else {
        throw new Error("Extracted text is too short or empty");
      }
    } catch (parsingError) {
      await storage.updateDocumentStatus(document.id, "failed", { 
        error: `PDF parsing failed: ${parsingError.message}` 
      });
      throw new Error(`PDF parsing failed for ${originalName}: ${parsingError.message}`);
    }
    
    // Clean existing data only for this document ID
    try {
      await pineconeStore.deleteVectors(document.id);
    } catch {}
    try {
      await storage.deleteDocumentChunks(document.id, userId);
    } catch {}

    // Split text into chunks
    let chunks;
    try {
      const textSplitter = new RecursiveCharacterTextSplitter(1000, 100);
      chunks = textSplitter.splitText(pdfText);
    } catch (splitterError) {
      throw splitterError;
    }

    // Update document with chunk count
    await storage.updateDocumentStatus(document.id, "processing", {
      totalPages: await storage.getDocument(document.id).then(doc => doc?.metadata?.totalPages || 1),
      totalChunks: chunks.length,
      processedChunks: 0,
      progress: 20
    });

    // Create chunks with embeddings and store in Pinecone
    const vectorsToUpsert = [];
    let chunkIndex = 0;
    const seenHashes = new Set();
    
    for (const chunkText of chunks) {
      try {
        const normalizedContent = chunkText.replace(/\s+/g, ' ').trim();
        const contentHash = createHash('sha1').update(normalizedContent).digest('hex');
        if (seenHashes.has(contentHash)) { chunkIndex++; continue; }
        seenHashes.add(contentHash);

        const embedding = await createEmbedding(normalizedContent);
        const chunkId = `${document.id}-${contentHash}`;
        
        await storage.createDocumentChunk({
          id: chunkId,
          documentId: document.id,
          chunkIndex,
          content: normalizedContent,
          pageNumber: Math.floor(chunkIndex / 3) + 1,
          embedding,
          userId,
          metadata: { 
            length: normalizedContent.length,
            wordCount: normalizedContent.split(' ').length
          }
        });
        
        vectorsToUpsert.push({
          id: chunkId,
          values: embedding,
          metadata: {
            documentId: document.id,
            documentName: document.originalName,
            chunkIndex,
            content: normalizedContent,
            pageNumber: Math.floor(chunkIndex / 3) + 1,
            chunkLength: normalizedContent.length,
            wordCount: normalizedContent.split(' ').length,
            userId,
          }
        });
        
        const progress = Math.floor(((chunkIndex + 1) / chunks.length) * 80) + 10;
        await storage.updateDocumentStatus(document.id, "processing", { processedChunks: chunkIndex + 1, progress });
        chunkIndex++;
      } catch (error) {
        chunkIndex++;
      }
    }
    
    if (vectorsToUpsert.length > 0) {
      try {
        await storage.updateDocumentStatus(document.id, "processing", { progress: 95 });
        await pineconeStore.upsertVectors(vectorsToUpsert);
        await storage.updateDocumentStatus(document.id, "processing", { progress: 98 });
      } catch (error) {
        // continue; we still have local storage
      }
    }

    await storage.updateDocumentStatus(document.id, "completed", {
      totalPages: Math.ceil(chunks.length / 3),
      totalChunks: chunks.length,
      progress: 100
    });

    return document.id;
  } catch (error) {
    if (document && document.id) {
      try { await storage.updateDocumentStatus(document.id, "failed", { error: error.message }); } catch {}
    }
    return null;
  }
}

export async function searchDocuments(query, limit = 5, documentName, userId) {
  try {
    const queryEmbedding = await createEmbedding(query);
    let relevantChunks = [];
    try {
      const filter = {
        ...(documentName ? { documentName: { "$eq": documentName } } : {}),
        ...(userId ? { userId: { "$eq": userId } } : {}),
      };
      const pineconeMatches = await pineconeStore.queryVectors(queryEmbedding, limit, Object.keys(filter).length ? filter : null);
      if (pineconeMatches && pineconeMatches.length > 0) {
        relevantChunks = pineconeMatches.map(match => ({
          id: match.id,
          documentId: match.metadata.documentId,
          chunkIndex: match.metadata.chunkIndex,
          content: match.metadata.content,
          pageNumber: match.metadata.pageNumber,
          score: match.score,
          metadata: {
            chunkLength: match.metadata.chunkLength,
            wordCount: match.metadata.wordCount
          }
        }));
      } else {
        relevantChunks = await storage.searchChunksByEmbedding(queryEmbedding, limit, userId);
        if (documentName) {
          const docs = await storage.getAllDocuments(userId);
          const docIds = new Set(docs.filter(d => d.originalName === documentName).map(d => d.id));
          relevantChunks = relevantChunks.filter(c => docIds.has(c.documentId));
        }
      }
    } catch (pineconeError) {
      relevantChunks = await storage.searchChunksByEmbedding(queryEmbedding, limit, userId);
      if (documentName) {
        const docs = await storage.getAllDocuments(userId);
        const docIds = new Set(docs.filter(d => d.originalName === documentName).map(d => d.id));
        relevantChunks = relevantChunks.filter(c => docIds.has(c.documentId));
      }
    }

    const results = await Promise.all(
      relevantChunks.map(async (chunk) => {
        const document = await storage.getDocument(chunk.documentId);
        return { chunk, document };
      })
    );

    return results.filter(result => result.document);
  } catch (error) {
    throw new Error(`Failed to search documents: ${error}`);
  }
}