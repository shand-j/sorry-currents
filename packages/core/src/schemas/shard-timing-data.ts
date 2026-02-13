import { z } from 'zod';

export const ShardTimingDataSchema = z.object({
  testId: z.string().min(1),
  file: z.string(),
  project: z.string(),
  avgDuration: z.number().nonnegative(),
  p95Duration: z.number().nonnegative(),
  samples: z.number().int().positive(),
});

export type ShardTimingData = z.infer<typeof ShardTimingDataSchema>;
