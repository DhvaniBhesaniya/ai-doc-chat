import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../models/storage.js";
import { generateChatResponse } from "../services/gemini.js";
import { 
  createConversation, 
  getConversations, 
  getConversation, 
  sendMessage, 
  updateConversationTitle 
} from "../controllers/chatController.js";

const router = express.Router();

// Unified chat endpoint for frontend compatibility - requires authentication
router.post("/", requireAuth, async (req, res) => {
  try {
    const { message, conversationId, documentName } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let activeConversationId = conversationId;
    
    // Create new conversation if none exists
    if (!activeConversationId) {
      const conversation = await storage.createConversation({
        title: documentName ? `Chat about ${documentName}` : "New Conversation",
        userId: req.user?.id,
      });
      activeConversationId = conversation.id;
    }

    // Save user message
    const userMessage = await storage.createMessage({
      conversationId: activeConversationId,
      role: "user",
      content: message,
      userId: req.user?.id,
    });

    // Generate AI response with selected document filter
    const aiResponse = await generateChatResponse(message, req.user?.id, documentName);

    // Save AI message
    const aiMessage = await storage.createMessage({
      conversationId: activeConversationId,
      role: "assistant",
      content: aiResponse.content,
      sources: aiResponse.sources,
      userId: req.user?.id,
    });

    res.json({
      conversationId: activeConversationId,
      userMessage,
      aiMessage,
      sources: aiResponse.sources,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

// All chat routes require authentication
router.post("/conversations", requireAuth, createConversation);
router.get("/conversations", requireAuth, getConversations);
router.get("/conversations/:id", requireAuth, getConversation);
router.post("/conversations/:id/messages", requireAuth, sendMessage);
router.put("/conversations/:id/title", requireAuth, updateConversationTitle);

export default router;