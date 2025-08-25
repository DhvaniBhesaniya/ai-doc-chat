import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { register, login, logout, me, updateProfile } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", me);
router.put("/profile", requireAuth, updateProfile);

export default router;