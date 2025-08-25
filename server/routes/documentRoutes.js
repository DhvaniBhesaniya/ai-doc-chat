import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { 
  uploadDocument, 
  getDocuments, 
  getDocument, 
  deleteDocument, 
  getDocumentStatus 
} from "../controllers/documentController.js";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// All document routes require authentication
router.post("/upload", requireAuth, upload.single("file"), uploadDocument);
router.get("/", requireAuth, getDocuments);
router.get("/:id", requireAuth, getDocument);
router.delete("/:id", requireAuth, deleteDocument);
router.get("/:id/status", requireAuth, getDocumentStatus);

export default router;