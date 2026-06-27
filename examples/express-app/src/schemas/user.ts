import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2).describe("Full name"),
  email: z.string().email().describe("Email address"),
  role: z.enum(["admin", "user", "moderator"]).describe("User role"),
  age: z.number().int().min(18).max(120).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["admin", "user", "moderator"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createPostSchema = z.object({
  title: z.string().min(3).max(120).describe("Post title"),
  body: z.string().min(10).describe("Post content"),
  tags: z.array(z.string()).optional().describe("Tag list"),
  published: z.boolean().default(false),
});
