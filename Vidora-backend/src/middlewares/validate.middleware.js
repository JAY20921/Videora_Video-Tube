import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";

/**
 * validate(schema) — returns an Express middleware that validates req.body
 * against the given Zod schema. Throws ApiError(400) on failure.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return next(new ApiError(400, "Validation failed", errors));
  }
  // Replace req.body with the parsed (sanitized) data
  req.body = result.data;
  next();
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .toLowerCase(),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").toLowerCase().optional(),
  username: z.string().trim().toLowerCase().optional(),
  password: z.string().min(1, "Password is required"),
}).refine((data) => data.email || data.username, {
  message: "Either email or username is required",
  path: ["email"],
});

export const publishVideoSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(5000),
});

export const updateVideoSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (title or description) must be provided",
  });
