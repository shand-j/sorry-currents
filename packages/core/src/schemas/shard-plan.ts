import { z } from 'zod';

export const SHARD_STRATEGIES = ['lpt', 'round-robin', 'file-group'] as const;

export const ShardAssignmentSchema = z.object({
  shardIndex: z.number().int().positive(),
  tests: z.array(z.string()),
  estimatedDuration: z.number().nonnegative(),
});

export type ShardAssignment = z.infer<typeof ShardAssignmentSchema>;

export const ShardPlanSchema = z.object({
  shards: z.array(ShardAssignmentSchema),
  strategy: z.enum(SHARD_STRATEGIES),
  totalTests: z.number().int().nonnegative(),
  maxShardDuration: z.number().nonnegative(),
  minShardDuration: z.number().nonnegative(),
  improvement: z.number().optional(),
  generatedAt: z.string().datetime(),
});

export type ShardPlan = z.infer<typeof ShardPlanSchema>;
