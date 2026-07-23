import { z } from 'zod';

const nameField = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(50, 'Must be 50 characters or fewer')
  .regex(/^[A-Za-z\s'-]+$/, 'Should contain alphabetic symbols only');

const optionalNameField = z
  .string()
  .trim()
  .max(50, 'Must be 50 characters or fewer')
  .regex(/^[A-Za-z\s'-]*$/, 'Should contain alphabetic symbols only')
  .optional()
  .or(z.literal(''));

export const updateProfileSchema = z.object({
  name: nameField.optional(),
  surname: optionalNameField,
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{6,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  // Client sends plain YYYY-MM-DD; validated as a real calendar date below.
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
    .refine((val) => !Number.isNaN(new Date(val).getTime()), 'Invalid date')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']).optional(),
  country: z.string().trim().max(56).optional().or(z.literal('')),
  city: z.string().trim().max(56).optional().or(z.literal('')),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;