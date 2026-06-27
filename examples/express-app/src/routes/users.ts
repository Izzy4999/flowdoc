import { Router } from "express";
import { validateBody } from "../middleware/validate.js";
import { createUserSchema, updateUserSchema } from "../schemas/user.js";

export const usersRouter = Router();

usersRouter.get("/users", (req, res) => {
  res.json({ users: [] });
});

usersRouter.get("/users/:id", (req, res) => {
  res.json({ user: { id: req.params.id } });
});

usersRouter.post("/users", validateBody(createUserSchema), (req, res) => {
  res.status(201).json({ user: req.body });
});

usersRouter.patch("/users/:id", validateBody(updateUserSchema), (req, res) => {
  res.json({ user: { id: req.params.id, ...req.body } });
});

usersRouter.delete("/users/:id", (req, res) => {
  res.status(204).send();
});
