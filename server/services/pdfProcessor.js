import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { storage } from "../storage.js";
import { createEmbedding } from "./gemini.js";
import { pineconeStore } from "./pineconeStore.js";
import PDFParser from "pdf2json";

// Simple text splitter for chunking
export class RecursiveCharacterTextSplitter {
  constructor(chunkSize = 1000, chunkOverlap = 200) {
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
      console.log(`Iteration ${iterations}, start: ${start}, text length: ${text.length}`);
      
      let end = Math.min(start + this.chunkSize, text.length);
      console.log(`Initial end: ${end}`);
      
      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        console.log(`Break points - period: ${lastPeriod}, newline: ${lastNewline}, breakPoint: ${breakPoint}`);
        
        if (breakPoint > start + this.chunkSize * 0.5) {
          end = breakPoint + 1;
          console.log(`Adjusted end to: ${end}`);
        }
      }

      const chunk = text.slice(start, end).trim();
      console.log(`Created chunk of length: ${chunk.length}`);
      if (chunk.length > 0) {
        chunks.push(chunk);
        console.log(`Added chunk ${chunks.length}`);
      }

      const newStart = end - this.chunkOverlap;
      console.log(`New start calculation: ${newStart} (end ${end} - overlap ${this.chunkOverlap})`);
      start = Math.max(newStart, start + 1); // Ensure progress
      console.log(`Final start: ${start}`);
      
      // Safety check for infinite loop
      if (start >= text.length) {
        console.log("Reached end of text");
        break;
      }
    }

    if (iterations >= maxIterations) {
      console.warn("Text splitter hit max iterations safety limit");
    }

    console.log(`Text splitting completed with ${chunks.length} chunks in ${iterations} iterations`);
    return chunks;
  }
}

export async function processPdfFile(fileBuffer, filename, originalName) {
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
    });

    console.log(`Created document record with ID: ${document.id}`);
    
    // Update status to processing with initial progress
    console.log("Updating document status to processing...");
    await storage.updateDocumentStatus(document.id, "processing", {
      progress: 5 // 5% - document created, starting processing
    });
    console.log("Document status updated successfully");

    // Extract text from PDF buffer using pdf-parser library
    console.log("Extracting text from PDF using pdf-parser...");
    let pdfText;
    
    try {
      console.log("Parsing PDF with pdf-parser library...");
      
      // Create a new PDFParser instance
      const pdfParser = new PDFParser();
      
      // Parse the PDF buffer
      const pdfData = await new Promise((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", (errData) => {
          console.error("PDF parsing error:", errData.parserError);
          reject(new Error(errData.parserError));
        });
        
        pdfParser.on("pdfParser_dataReady", (pdfData) => {
          console.log("PDF data ready for processing");
          resolve(pdfData);
        });
        
        // Parse the buffer
        pdfParser.parseBuffer(fileBuffer);
      });
      
      console.log("PDF parsing completed successfully");
      console.log(`- Total pages: ${pdfData.Pages?.length || 0}`);
      
      // Extract text from all pages
      let extractedText = '';
      
      if (pdfData.Pages && pdfData.Pages.length > 0) {
        for (const page of pdfData.Pages) {
          if (page.Texts && page.Texts.length > 0) {
            for (const textItem of page.Texts) {
              if (textItem.R && textItem.R.length > 0) {
                for (const run of textItem.R) {
                  if (run.T) {
                    // Decode the text and clean it
                    const decodedText = decodeURIComponent(run.T)
                      .replace(/\s+/g, ' ')
                      .trim();
                    if (decodedText && decodedText.length > 1) {
                      extractedText += decodedText + ' ';
                    }
                  }
                }
              }
            }
          }
        }
        
        // Clean the extracted text
        extractedText = extractedText
          .replace(/\s+/g, ' ')  // Normalize spaces
          .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2')  // Add paragraph breaks
          .trim();
        
        console.log(`Extracted text length: ${extractedText.length} characters`);
        
        if (extractedText && extractedText.length > 100) {
          pdfText = extractedText;
          console.log("Successfully extracted authentic PDF text content");
          console.log("Content preview:", extractedText.substring(0, 500));
          
          // Update document with actual page count and progress
          await storage.updateDocumentStatus(document.id, "processing", {
            totalPages: pdfData.Pages.length,
            progress: 15 // 15% - text extraction complete
          });
        } else {
          throw new Error("Extracted text is too short or empty");
        }
      } else {
        throw new Error("No pages found in PDF");
      }
    } catch (parsingError) {
      console.error("PDF text extraction failed:", parsingError);
      console.error("Parsing error details:", parsingError.message);
      console.error("Parsing error stack:", parsingError.stack);
      
      // Update document status to failed immediately
      await storage.updateDocumentStatus(document.id, "failed", { 
        error: `PDF parsing failed: ${parsingError.message}` 
      });
      
      // Re-throw the error to stop processing
      throw new Error(`PDF parsing failed for ${originalName}: ${parsingError.message}`);
    }
    
    console.log("PDF content ready for processing, length:", pdfText.length);
    console.log("Content preview:", pdfText.substring(0, 300));

    // First, clean existing document data from Pinecone
    console.log(`Cleaning existing data for document: ${originalName}`);
    try {
      await pineconeStore.deleteVectorsByDocumentName(originalName);
      console.log("Successfully cleaned existing document data from Pinecone");
    } catch (cleanError) {
      console.warn("Failed to clean existing data, continuing anyway:", cleanError.message);
    }

    // Split text into chunks
    console.log("Creating text splitter...");
    let chunks;
    try {
      const textSplitter = new RecursiveCharacterTextSplitter(1000, 200);
      console.log("Text splitter created, now splitting text...");
      chunks = textSplitter.splitText(pdfText);
      console.log("Text splitting completed successfully, chunks:", chunks.length);
    } catch (splitterError) {
      console.error("Error during text splitting:", splitterError);
      console.error("Splitter error stack:", splitterError.stack);
      throw splitterError;
    }

    // Process each chunk and create embeddings
    console.log(`Split text into ${chunks.length} chunks`);
    
    // Update document with chunk count and processing progress
    await storage.updateDocumentStatus(document.id, "processing", {
      totalPages: await storage.getDocument(document.id).then(doc => doc.metadata?.totalPages || 1),
      totalChunks: chunks.length,
      processedChunks: 0,
      progress: 20 // 20% - text splitting complete
    });
    
    // Create chunks with embeddings and store in Pinecone
    const vectorsToUpsert = [];
    let chunkIndex = 0;
    
    for (const chunkText of chunks) {
      try {
        console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with embedding`);
        
        // Generate real embeddings for the chunk content
        const embedding = await createEmbedding(chunkText);
        console.log(`Created embedding for chunk ${chunkIndex + 1}, dimension:`, embedding.length);
        
        // Create chunk ID
        const chunkId = randomUUID();
        
        // Store chunk in local storage
        await storage.createDocumentChunk({
          id: chunkId,
          documentId: document.id,
          chunkIndex,
          content: chunkText,
          pageNumber: Math.floor(chunkIndex / 3) + 1,
          embedding,
          metadata: { 
            length: chunkText.length,
            wordCount: chunkText.split(' ').length
          }
        });
        
        // Prepare vector for Pinecone
        vectorsToUpsert.push({
          id: chunkId,
          values: embedding,
          metadata: {
            documentId: document.id,
            documentName: document.originalName,
            chunkIndex,
            content: chunkText,
            pageNumber: Math.floor(chunkIndex / 3) + 1,
            chunkLength: chunkText.length,
            wordCount: chunkText.split(' ').length
          }
        });
        
        console.log(`Successfully processed chunk ${chunkIndex + 1}/${chunks.length}`);
        
        // Update progress more frequently for better UX
        const progress = Math.floor(((chunkIndex + 1) / chunks.length) * 80) + 10; // 10-90% for chunk processing
        await storage.updateDocumentStatus(document.id, "processing", {
          processedChunks: chunkIndex + 1,
          progress: progress
        });
        console.log(`Progress: ${progress}% (${chunkIndex + 1}/${chunks.length} chunks)`);
        
        chunkIndex++;
      } catch (error) {
        console.error(`Error processing chunk ${chunkIndex}:`, error);
        console.error("Chunk error details:", error.message);
        chunkIndex++;
      }
    }
    
    // Upsert all vectors to Pinecone
    if (vectorsToUpsert.length > 0) {
      try {
        console.log(`Upserting ${vectorsToUpsert.length} vectors to Pinecone`);
        await storage.updateDocumentStatus(document.id, "processing", {
          progress: 95 // 95% - uploading to Pinecone
        });
        
        await pineconeStore.upsertVectors(vectorsToUpsert);
        console.log("Successfully stored vectors in Pinecone");
        
        await storage.updateDocumentStatus(document.id, "processing", {
          progress: 98 // 98% - upload complete
        });
      } catch (error) {
        console.error("Failed to store vectors in Pinecone:", error);
        // Continue anyway - we have local storage as fallback
      }
    }

    // Update document as completed
    await storage.updateDocumentStatus(document.id, "completed", {
      totalPages: Math.ceil(chunks.length / 3),
      totalChunks: chunks.length,
      progress: 100
    });
    console.log(`✅ Document processing completed: ${originalName}`);

    return document.id;
  } catch (error) {
    console.error("Error processing PDF:", error);
    console.error("Full error details:", error.message, error.stack);
    
    // Update document status to failed if we have a document ID
    if (document && document.id) {
      try {
        await storage.updateDocumentStatus(document.id, "failed", { error: error.message });
      } catch (updateError) {
        console.error("Failed to update document status to failed:", updateError);
      }
    }
    
    // Don't throw the error to prevent server crash
    console.error(`PDF processing failed for: ${originalName}, but server continues running`);
    return null;
  }
}

export async function searchDocuments(query, limit = 5) {
  try {
    console.log("Searching documents with query:", query);
    
    // Create embedding for the query
    const queryEmbedding = await createEmbedding(query);
    console.log("Query embedding created, dimension:", queryEmbedding.length);
    
    // Try Pinecone first, fallback to local storage
    let relevantChunks = [];
    
    try {
      console.log("Searching in Pinecone...");
      const pineconeMatches = await pineconeStore.queryVectors(queryEmbedding, limit);
      
      if (pineconeMatches && pineconeMatches.length > 0) {
        console.log(`Found ${pineconeMatches.length} matches from Pinecone`);
        
        // Convert Pinecone matches to our chunk format
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
        // console.log("Pinecone data------------:", relevantChunks);
        
        console.log("Pinecone results scores:", relevantChunks.map(c => c.score));
      } else {
        console.log("No matches found in Pinecone, falling back to local search");
        relevantChunks = await storage.searchChunksByEmbedding(queryEmbedding, limit);
      }
    } catch (pineconeError) {
      console.warn("Pinecone search failed, using local fallback:", pineconeError.message);
      relevantChunks = await storage.searchChunksByEmbedding(queryEmbedding, limit);
    }
    
    console.log(`Found ${relevantChunks.length} relevant chunks`);
    
    // Get document information for each chunk
    const results = await Promise.all(
      relevantChunks.map(async (chunk) => {
        const document = await storage.getDocument(chunk.documentId);
        return {
          chunk,
          document,
        };
      })
    );

    const filteredResults = results.filter(result => result.document);
    console.log(`Returning ${filteredResults.length} results with documents`);
    
    return filteredResults;
  } catch (error) {
    console.error("Error searching documents:", error);
    throw new Error(`Failed to search documents: ${error}`);
  }
}