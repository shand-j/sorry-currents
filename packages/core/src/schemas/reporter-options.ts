import { z } from 'zod';

export const ReporterOptionsSchema = z.object({
  outputDir: z.string().default('.sorry-currents'),
  runId: z.string().optional(),
  attachArtifacts: z.boolean().default(true),
  artifactsDir: z.string().default('test-results'),
  silent: z.boolean().default(false),
});

export type ReporterOptions = z.infer<typeof ReporterOptionsSchema>;
