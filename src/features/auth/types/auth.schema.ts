// src/features/auth/schemas/auth.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email or Mobile No is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First Name is required').max(500, 'First name Limit Exceeds'),
  middleName: z.string().max(500, 'Middle name Limit Exceeds').optional(),
  lastName: z.string().min(1, 'Last Name is required').max(500, 'Last name Limit Exceeds'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  phoneNumber: z.string().min(1, 'Phone number is required').regex(/^\d{10}$/, 'Invalid phone number'),
  password: z.string().min(6, 'Passwords must be at least 6 characters.'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // sets the error on the confirmPassword field
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;