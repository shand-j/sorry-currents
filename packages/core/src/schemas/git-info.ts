import { z } from 'zod';

export const GitInfoSchema = z.object({
  branch: z.string(),
  commit: z.string(),
  commitMessage: z.string(),
  author: z.string(),
  remote: z.string().optional(),
  pr: z
    .object({
      number: z.number().int().positive(),
      title: z.string(),
      url: z.string().url(),
    })
    .optional(),
});

export type GitInfo = z.infer<typeof GitInfoSchema>;
