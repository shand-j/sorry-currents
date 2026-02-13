import { z } from 'zod';

import { EnvironmentInfoSchema } from './environment-info.js';
import { GitInfoSchema } from './git-info.js';
import { RunConfigSchema } from './run-config.js';
import { TestResultSchema } from './test-result.js';

export const RUN_STATUSES = [
  'passed',
  'failed',
  'timedOut',
  'interrupted',
] as const;

export const RunResultSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  duration: z.number().nonnegative(),
  status: z.enum(RUN_STATUSES),
  totalTests: z.number().int().nonnegative(),
  passedTests: z.number().int().nonnegative(),
  failedTests: z.number().int().nonnegative(),
  skippedTests: z.number().int().nonnegative(),
  flakyTests: z.number().int().nonnegative(),
  shardCount: z.number().int().positive(),
  shardIndex: z.number().int().positive().optional(),
  tests: z.array(TestResultSchema),
  environment: EnvironmentInfoSchema,
  git: GitInfoSchema,
  config: RunConfigSchema,
});

export type RunResult = z.infer<typeof RunResultSchema>;
