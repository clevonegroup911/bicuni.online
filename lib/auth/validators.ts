import { z } from "zod";

const password = z.string()
  .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
  .max(128)
  .regex(/[a-z]/, "Ajoutez une lettre minuscule.")
  .regex(/[A-Z]/, "Ajoutez une lettre majuscule.")
  .regex(/[0-9]/, "Ajoutez un chiffre.");

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  totp: z.string().max(16).optional(),
  recoveryCode: z.string().max(32).optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(512),
  password,
});
