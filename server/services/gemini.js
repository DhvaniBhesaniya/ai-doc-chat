import { GoogleGenAI } from "@google/genai";
import { storage } from "../models/storage.js";
import { pineconeStore } from "./pineconeStore.js";

let ai = null;

// Initialize function that will be called when needed
async function initializeGemini() {
  if (ai) {
    return ai; // Already initialized
  }

  console.log("Gemini API Key loaded:", process.env.GEMINI_API_KEY ? "Yes (hidden)" : "No");

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("No Gemini API key found in environment variables");
    }
    ai = new GoogleGenAI(apiKey);
    console.log("GoogleGenAI client initialized successfully");
    console.log("Available methods on ai object:", Object.getOwnPropertyNames(ai));
    console.log("ai.getGenerativeModel type:", typeof ai.getGenerativeModel);
    return ai;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI client:", error);
    ai = null;
    throw error;
  }
}

export async function createEmbedding(text) {
  try {
    // Initialize if not already done
    await initializeGemini();
    
    if (!ai) {
      throw new Error("GoogleGenAI client not initialized");
    }
    
    console.log("Creating embedding for text:", text.substring(0, 100) + "...");
    const result = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [text]
    });
    console.log("Embedding created successfully");
    
    // Get the 768-dimensional embedding from Gemini
    const embedding768 = result.embeddings[0].values;
    
    // Pad to 1024 dimensions to match Pinecone index
    const embedding1024 = new Array(1024).fill(0);
    for (let i = 0; i < Math.min(768, embedding768.length); i++) {
      embedding1024[i] = embedding768[i];
    }
    
    console.log(`Padded embedding from ${embedding768.length} to ${embedding1024.length} dimensions`);
    return embedding1024;
  } catch (error) {
    console.error("Error creating embedding:", error);
    console.error("Error details:", error.message);
    throw new Error(`Failed to create embedding: ${error.message}`);
  }
}

export async function generateChatResponse(query, userId, selectedDocumentName = null) {
  try {
    await initializeGemini();
    
    if (!ai) {
      throw new Error("GoogleGenAI client not initialized");
    }

    // Search for relevant document chunks in Pinecone
    const queryEmbedding = await createEmbedding(query);
    
    // Create filter for specific document if selected
    let filter = null;
    if (selectedDocumentName) {
      filter = { documentName: selectedDocumentName };
      console.log(`Filtering search results to document: ${selectedDocumentName}`);
    }
    
    const searchResults = await pineconeStore.queryVectors(queryEmbedding, 5, filter);
    
    if (!searchResults || searchResults.length === 0) {
      return {
        content: "I'm sorry, but I don't know the answer. The information is not available in the document.",
        sources: []
      };
    }

    // Extract content and metadata from Pinecone results
    const context = searchResults.map(result => result.metadata.content).join('\n\n');
    const sources = searchResults.map(result => ({
      documentId: result.metadata.documentId,
      documentName: result.metadata.documentName || 'Unknown Document',
      pageNumber: result.metadata.pageNumber || 1,
      excerpt: result.metadata.content.substring(0, 200) + "..."
    }));

    const systemPrompt = `You are an AI assistant that helps users understand their documents. 
    Answer queries ONLY based on the provided context from the documents.
    If the context doesn't contain enough information, respond exactly with: "I'm sorry, but I don't know the answer. The information is not available in the document."`;

    const userPrompt = `Query: ${query}

Context from documents:
${context}

Please provide a helpful answer based ONLY on the context above.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: userPrompt,
      systemInstruction: systemPrompt
    });

    const generatedText = response.text || "I apologize, but I couldn't generate a response at this time.";
    
    return {
      content: generatedText,
      sources
    };
  } catch (error) {
    console.error("Error generating chat response:", error);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

export async function generateTitle(firstMessage) {
  try {
    // Initialize if not already done
    await initializeGemini();
    
    if (!ai) {
      return "New Conversation";
    }
    
    const prompt = `Generate a short, descriptive title (3-5 words) for a conversation that starts with this message: "${firstMessage}"
    
    Return only the title, no quotes or additional text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });

    return response.text?.trim() || "New Conversation";
  } catch (error) {
    console.error("Error generating title:", error);
    return "New Conversation";
  }
}