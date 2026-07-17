import { z } from 'zod';

export const depositSchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
});

export const withdrawSchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
});

export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
