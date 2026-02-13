import { z } from 'zod';

export const ErrorSummarySchema = z.object({
  message: z.string(),
  count: z.number().int().positive(),
  lastSeen: z.string().datetime(),
  exampleStack: z.string().optional(),
});

export type ErrorSummary = z.infer<typeof ErrorSummarySchema>;

export const TestHistorySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  file: z.string(),
  project: z.string(),
  totalRuns: z.number().int().nonnegative(),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  flakyCount: z.number().int().nonnegative(),
  skipCount: z.number().int().nonnegative(),
  avgDuration: z.number().nonnegative(),
  p95Duration: z.number().nonnegative(),
  lastDurations: z.array(z.number().nonnegative()),
  flakinessRate: z.number().min(0).max(1),
  failureRate: z.number().min(0).max(1),
  lastSeen: z.string().datetime(),
  topErrors: z.array(ErrorSummarySchema),
});

export type TestHistory = z.infer<typeof TestHistorySchema>;
