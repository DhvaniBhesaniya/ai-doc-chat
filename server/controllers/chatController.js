import { storage } from "../models/storage.js";
import { generateChatResponse } from "../services/gemini.js";

export async function createConversation(req, res) {
  try {
    const { title } = req.body;
    
    const conversation = await storage.createConversation({
      title: title || "New Conversation",
      userId: req.user?.id,
    });

    res.json(conversation);
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
}

export async function getConversations(req, res) {
  try {
    const conversations = await storage.getAllConversations();
    res.json(conversations);
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
}

export async function getConversation(req, res) {
  try {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await storage.getConversationMessages(req.params.id);
    res.json({ ...conversation, messages });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
}

export async function sendMessage(req, res) {
  try {
    const { message } = req.body;
    const conversationId = req.params.id;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Check if conversation exists
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Save user message
    const userMessage = await storage.createMessage({
      conversationId,
      role: "user",
      content: message,
      userId: req.user?.id,
    });

    // Generate AI response
    const aiResponse = await generateChatResponse(message, req.user?.id);

    // Save AI message
    const aiMessage = await storage.createMessage({
      conversationId,
      role: "assistant",
      content: aiResponse.content,
      sources: aiResponse.sources,
      userId: req.user?.id,
    });

    res.json({
      userMessage,
      aiMessage,
      sources: aiResponse.sources,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
}

export async function updateConversationTitle(req, res) {
  try {
    const { title } = req.body;
    const conversationId = req.params.id;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    await storage.updateConversationTitle(conversationId, title);
    res.json({ success: true });
  } catch (error) {
    console.error("Update conversation title error:", error);
    res.status(500).json({ error: "Failed to update conversation title" });
  }
}