import { z } from 'zod';

export const RunConfigSchema = z.object({
  workers: z.number().int().positive(),
  projects: z.array(z.string()),
  retries: z.number().int().nonnegative(),
  timeout: z.number().nonnegative(),
});

export type RunConfig = z.infer<typeof RunConfigSchema>;
