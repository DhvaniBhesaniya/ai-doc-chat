import { storage } from "../models/storage.js";
import { processDocument } from "../services/pdfProcessor.js";
import { pineconeStore } from "../services/pineconeStore.js";

export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are allowed" });
    }

    const document = await storage.createDocument({
      filename: req.file.filename || req.file.originalname,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: "uploading",
      userId: req.user?.id,
      metadata: {
        progress: 0,
        stage: "File uploaded, preparing to process..."
      }
    });

    // Process document asynchronously
    processDocument(document.id, req.file.buffer).catch((error) => {
      console.error(`Failed to process document ${document.id}:`, error);
      storage.updateDocumentStatus(document.id, "error", { error: error.message });
    });

    res.json({ document });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
}

export async function getDocuments(req, res) {
  try {
    const documents = await storage.getAllDocuments(req.user?.id);
    res.json(documents);
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
}

export async function getDocument(req, res) {
  try {
    const document = await storage.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check if user owns the document (if auth is enabled)
    if (req.user && document.userId && document.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(document);
  } catch (error) {
    console.error("Get document error:", error);
    res.status(500).json({ error: "Failed to fetch document" });
  }
}

export async function deleteDocument(req, res) {
  try {
    const document = await storage.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check if user owns the document (if auth is enabled)
    if (req.user && document.userId && document.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete from MongoDB
    await storage.deleteDocument(req.params.id, req.user?.id);
    
    // Delete associated vectors from Pinecone using original document name
    try {
      const nameToDelete = document.originalName || document.filename;
      await pineconeStore.deleteVectorsByDocumentName(nameToDelete);
      console.log(`Deleted Pinecone vectors for document: ${nameToDelete}`);
    } catch (pineconeError) {
      console.error("Error deleting from Pinecone:", pineconeError);
      // Continue even if Pinecone deletion fails
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
}

export async function getDocumentStatus(req, res) {
  try {
    const document = await storage.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ 
      id: document.id,
      status: document.status,
      progress: document.metadata?.progress || 0,
      stage: document.metadata?.stage || "Pending",
      filename: document.originalName,
      fileSize: document.fileSize
    });
  } catch (error) {
    console.error("Get document status error:", error);
    res.status(500).json({ error: "Failed to fetch document status" });
  }
}