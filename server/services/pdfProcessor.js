import * as fs from "fs";
import * as path from "path";
import { randomUUID, createHash } from "crypto";
import { storage } from "../models/storage.js";
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
    const chunks = [];
    let start = 0;
    let iterations = 0;
    const maxIterations = 100;

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

export async function processDocument(documentId, fileBuffer) {
  try {
    console.log(`Starting PDF processing for document: ${documentId}`);
    
    // Get document info to check for duplicates
    const document = await storage.getDocument(documentId);
    if (!document) {
      throw new Error("Document not found");
    }
    
    await storage.updateDocumentStatus(documentId, "processing", { 
      progress: 5,
      stage: "Initializing..."
    });

    // Check if document with same name already exists in Pinecone and delete it
    try {
      await pineconeStore.deleteVectorsByDocumentName(document.originalName);
      console.log(`Cleaned up existing data for document: ${document.originalName}`);
    } catch (error) {
      console.log(`No existing data found for document: ${document.originalName}`);
    }

    await storage.updateDocumentStatus(documentId, "processing", { 
      progress: 10,
      stage: "Extracting text..."
    });

    // Extract text from PDF buffer with error handling
    let data;
    let extractedText;
    
    try {
      // Try parsing with default pdf-parse first
      data = await pdfParse(fileBuffer);
      extractedText = (data.text || '').replace(/\s+/g, ' ').trim();
      console.log("PDF parsing succeeded with pdf-parse");
    } catch (parseError) {
      console.log("pdf-parse failed, trying alternative methods...");
      console.error("Parse error details:", parseError.message);
      
      try {
        // Try with more lenient pdf-parse options
        console.log("Trying pdf-parse with lenient options...");
        data = await pdfParse(fileBuffer, {
          max: 0, // No limit on pages
          version: 'default'
        });
        extractedText = (data.text || '').replace(/\s+/g, ' ').trim();
        console.log("Lenient pdf-parse succeeded");
        
      } catch (secondError) {
        console.error("Lenient pdf-parse also failed:", secondError.message);
        
        // If both parsing attempts fail, provide a meaningful error
        throw new Error(`Cannot process this PDF file. The file may be corrupted, password-protected, or use an unsupported format. Please try uploading a different PDF file.`);
      }
    }
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error("Could not extract readable text from this PDF. The file may be image-based, corrupted, or empty. Please try a different PDF file.");
    }
    
    console.log(`Successfully extracted ${extractedText.length} characters from PDF`);

    await storage.updateDocumentStatus(documentId, "processing", {
      totalPages: data.numpages || 1,
      progress: 20,
      stage: "Chunking text..."
    });

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter(1000, 100);
    const chunks = textSplitter.splitText(extractedText);

    await storage.updateDocumentStatus(documentId, "processing", {
      totalChunks: chunks.length,
      processedChunks: 0,
      progress: 25,
      stage: "Creating embeddings..."
    });

    // Create chunks with embeddings and store in Pinecone
    const vectors = [];
    let chunkIndex = 0;
    
    for (const chunkText of chunks) {
      try {
        const normalizedContent = chunkText.replace(/\s+/g, ' ').trim();
        const embedding = await createEmbedding(normalizedContent);
        
        // Prepare vector for Pinecone
        const chunkId = `${documentId}_chunk_${chunkIndex}`;
        vectors.push({
          id: chunkId,
          values: embedding,
          metadata: {
            documentId,
            documentName: document.originalName,
            chunkIndex,
            content: normalizedContent,
            pageNumber: Math.floor(chunkIndex / 3) + 1,
            length: normalizedContent.length,
            wordCount: normalizedContent.split(' ').length
          }
        });
        
        const progress = Math.floor(((chunkIndex + 1) / chunks.length) * 65) + 25;
        await storage.updateDocumentStatus(documentId, "processing", { 
          processedChunks: chunkIndex + 1, 
          progress,
          stage: `Processing chunk ${chunkIndex + 1}/${chunks.length}...`
        });
        chunkIndex++;
      } catch (error) {
        console.error(`Error processing chunk ${chunkIndex}:`, error);
        chunkIndex++;
      }
    }
    
    // Upload all vectors to Pinecone in batch
    if (vectors.length > 0) {
      await storage.updateDocumentStatus(documentId, "processing", { 
        progress: 95,
        stage: "Uploading to vector database..."
      });
      
      await pineconeStore.upsertVectors(vectors);
      console.log(`Successfully stored ${vectors.length} chunks in Pinecone`);
    }

    await storage.updateDocumentStatus(documentId, "completed", {
      totalPages: data.numpages || 1,
      totalChunks: chunks.length,
      progress: 100,
      stage: "Complete"
    });

    console.log(`PDF processing completed for document: ${documentId}`);
    return documentId;
  } catch (error) {
    console.error(`PDF processing failed for document ${documentId}:`, error);
    
    // Provide user-friendly error message
    let userMessage = error.message;
    if (error.message.includes('Illegal character') || error.message.includes('FormatError')) {
      userMessage = "This PDF file cannot be processed due to formatting issues. Please try a different PDF file or save your document in a different format.";
    } else if (error.message.includes('password') || error.message.includes('encrypted')) {
      userMessage = "This PDF is password-protected. Please upload an unprotected PDF file.";
    } else if (error.message.includes('too short') || error.message.includes('empty')) {
      userMessage = "No readable text found in this PDF. The file may be image-based or empty.";
    }
    
    await storage.updateDocumentStatus(documentId, "error", { 
      error: userMessage,
      stage: "Failed to process PDF",
      progress: 0
    });
    
    // Don't re-throw the error, just log it
    console.log(`Document ${documentId} marked as failed with user-friendly message`);
  }
}