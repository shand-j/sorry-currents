import { z } from 'zod';

export const EnvironmentInfoSchema = z.object({
  os: z.string(),
  nodeVersion: z.string(),
  playwrightVersion: z.string(),
  ci: z.string(),
  runner: z.string().optional(),
});

export type EnvironmentInfo = z.infer<typeof EnvironmentInfoSchema>;
