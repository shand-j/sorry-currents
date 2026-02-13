import { z } from 'zod';

export const CI_PROVIDERS = [
  'github-actions',
  'gitlab-ci',
  'azure-pipelines',
] as const;

export const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm'] as const;

export const InitConfigSchema = z.object({
  ciProvider: z.enum(CI_PROVIDERS),
  shardCount: z.number().int().positive(),
  packageManager: z.enum(PACKAGE_MANAGERS),
  playwrightConfigPath: z.string(),
  installCommand: z.string(),
  browserInstallCommand: z.string(),
  testCommand: z.string(),
  branchFilters: z.array(z.string()),
  includeSlack: z.boolean(),
  slackWebhookUrl: z.string().url().optional(),
  includeGitHubComment: z.boolean(),
});

export type InitConfig = z.infer<typeof InitConfigSchema>;

export const GeneratedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  action: z.enum(['create', 'modify']),
  description: z.string(),
});

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;
