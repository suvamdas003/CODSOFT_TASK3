import { z } from "zod";
import { emailField, passwordField, requiredText, optionalUrl } from "@/lib/validation";

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required.").max(128, "Password is too long."),
});

const baseRegister = {
  name: requiredText("Full name", 120, 2),
  email: emailField,
  password: passwordField,
};

export const registerSchema = z.discriminatedUnion("role", [
  z.object({ ...baseRegister, role: z.literal("CANDIDATE") }),
  z.object({
    ...baseRegister,
    role: z.literal("RECRUITER"),
    companyName: requiredText("Company name", 120, 2),
    companyWebsite: optionalUrl("Company website"),
  }),
], { error: "Choose an account type." });

export type RegisterInput = z.output<typeof registerSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(128),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });

export const accountSchema = z.object({ name: requiredText("Full name", 120, 2) });
