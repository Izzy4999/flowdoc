import { Router } from "express";
import { validateBody } from "../middleware/validate.js";
import { loginSchema } from "../schemas/user.js";

export const authRouter = Router();

authRouter.post("/auth/login", validateBody(loginSchema), (req, res) => {
  res.json({ token: "eyJ..." });
});

authRouter.post("/auth/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

authRouter.get("/auth/me", (req, res) => {
  res.json({ user: null });
});
