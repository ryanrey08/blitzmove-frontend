import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email address is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  remember: z.boolean(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordRules = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export const resetPasswordSchema = z
  .object({ password: passwordRules, password_confirmation: z.string() })
  .refine((v) => v.password === v.password_confirmation, { message: "Passwords do not match.", path: ["password_confirmation"] });
