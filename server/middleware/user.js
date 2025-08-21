import { randomUUID } from "crypto";

export function attachUser(req, res, next) {
	// Prefer explicit header for debugging/testing
	let userId = req.cookies?.userId || req.header("x-user-id");
	if (!userId) {
		userId = randomUUID();
		// Set a long-lived cookie (1 year)
		res.cookie("userId", userId, {
			httpOnly: false,
			sameSite: "lax",
			maxAge: 365 * 24 * 60 * 60 * 1000,
		});
	}
	req.userId = userId;
	next();
} 