import { z } from 'zod';

export const placeBetSchema = z.object({
  color: z.enum(['RED', 'BLUE', 'GREEN']),
  amount: z.number().int().positive().max(100_000),
});

export type PlaceBetInput = z.infer<typeof placeBetSchema>;