import { z } from 'zod';

/** Maximum number of raw durations to store for standard deviation calculation. */
export const MAX_DURATION_WINDOW = 20 as const;

export const ShardTimingDataSchema = z.object({
  testId: z.string().min(1),
  file: z.string(),
  project: z.string(),
  avgDuration: z.number().nonnegative(),
  p95Duration: z.number().nonnegative(),
  samples: z.number().int().positive(),
  /** Standard deviation of recent durations — measures execution time variance. */
  stdDev: z.number().nonnegative().default(0),
  /** Rolling window of recent raw durations for accurate stdDev computation. */
  lastDurations: z.array(z.number().nonnegative()).max(MAX_DURATION_WINDOW).default([]),
});

export type ShardTimingData = z.infer<typeof ShardTimingDataSchema>;
