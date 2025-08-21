import { createServer } from "http";
import multer from "multer";
import { storage } from "./storage.js";
import { processPdfFile, searchDocuments } from "./services/pdfProcessor.js";
import { generateChatResponse, generateTitle } from "./services/gemini.js";
// import { vectorStore } from "./services/vectorStore.js"; // unused
import { insertMessageSchema } from "../shared/schema.js";
import { z } from "zod";
import bcrypt from "bcryptjs";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

export async function registerRoutes(app) {
  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const existing = await storage.findUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'Email already in use' });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, passwordHash, name });
      res.cookie('userId', user.id, { httpOnly: false, sameSite: 'lax', maxAge: 365*24*60*60*1000 });
      return res.json({ id: user.id, email: user.email, name: user.name });
    } catch (e) {
      console.error('Register error', e);
      return res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const user = await storage.findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      res.cookie('userId', user.id, { httpOnly: false, sameSite: 'lax', maxAge: 365*24*60*60*1000 });
      return res.json({ id: user.id, email: user.email, name: user.name });
    } catch (e) {
      console.error('Login error', e);
      return res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    res.clearCookie('userId');
    return res.json({ success: true });
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      if (!req.userId) return res.json(null);
      const user = await storage.getUserById(req.userId);
      return res.json(user || null);
    } catch (e) {
      return res.json(null);
    }
  });

  // Upload PDF endpoint
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      console.log("Upload request received");
      if (!req.file) {
        console.log("No file in request");
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("Processing file:", req.file.originalname);
      const filename = `${Date.now()}-${req.file.originalname}`;
      
      // Process the PDF file asynchronously to avoid timeout
      processPdfFile(
        req.file.buffer,
        filename,
        req.file.originalname,
        req.userId
      ).then(documentId => {
        console.log("PDF processing completed for document:", documentId);
      }).catch(error => {
        console.error("Background PDF processing error:", error);
      });

      // Return immediate response
      res.json({ 
        success: true, 
        message: "File uploaded and processing started in background"
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get all documents
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getAllDocuments(req.userId);
      const documentsWithStatus = documents.map(doc => ({
        id: doc.id,
        filename: doc.originalName || doc.filename,
        status: doc.status,
        fileSize: doc.fileSize,
        totalPages: doc.totalPages,
        totalChunks: doc.totalChunks,
        uploadedAt: doc.uploadedAt,
        processedAt: doc.processedAt,
      }));
      
      res.json(documentsWithStatus);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      await storage.deleteDocument(req.params.id, req.userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, conversationId, documentName } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      // Create or get conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        if (!conversation || conversation.userId !== req.userId) {
          return res.status(404).json({ error: "Conversation not found" });
        }
      } else {
        conversation = await storage.createConversation({
          title: null,
          userId: req.userId,
        });
      }

      // Save user message
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
        sources: null,
        userId: req.userId,
      });

      // Search for relevant documents
      const searchResults = await searchDocuments(message, 5, documentName, req.userId);
      
      let aiResponse;
      let sources = [];
      
      if (searchResults.length === 0 || 
          !searchResults.some(result => result.chunk && result.chunk.content)) {
        aiResponse = "I'm sorry, but I don't know the answer. The information is not available in the document.";
        console.log("No relevant documents found, using fallback response");
      } else {
        const validResults = searchResults.filter(result => 
          result.chunk && result.chunk.content && result.chunk.content.trim().length > 20);
          
        if (validResults.length === 0) {
          aiResponse = "I'm sorry, but I don't know the answer. The information is not available in the document.";
          console.log("No sufficiently detailed content found, using fallback response");
        } else {
          const context = validResults
            .map(result => `Document: ${result.document?.originalName}\nContent: ${result.chunk.content}`)
            .join('\n\n');

          sources = validResults.map(result => ({
            documentId: result.chunk.documentId,
            documentName: result.document?.originalName || "Unknown",
            pageNumber: result.chunk.pageNumber,
            excerpt: result.chunk.content.substring(0, 200) + "...",
          }));

          console.log(`Generating response with ${validResults.length} relevant chunks`);
          aiResponse = await generateChatResponse(message, context, sources);
        }
      }

      // Save AI message
      const aiMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: aiResponse,
        sources: sources.length > 0 ? sources : null,
        userId: req.userId,
      });

      // Generate title for new conversations
      if (!conversation.title) {
        const title = await generateTitle(message);
        await storage.updateConversationTitle(conversation.id, title);
      }

      res.json({
        conversationId: conversation.id,
        message: {
          id: aiMessage.id,
          role: aiMessage.role,
          content: aiMessage.content,
          sources: aiMessage.sources,
          createdAt: aiMessage.createdAt,
        },
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation || conversation.userId !== req.userId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getConversationMessages(req.params.id);
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
        createdAt: msg.createdAt,
      }));
      
      console.log("Formatted messages------------:", formattedMessages);
      res.json(formattedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get all conversations
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      // Optionally filter by req.userId when implemented
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}