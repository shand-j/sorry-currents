import { z } from 'zod';

export const TestErrorSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  snippet: z.string().optional(),
  location: z
    .object({
      file: z.string(),
      line: z.number().int().positive(),
      column: z.number().int().nonnegative(),
    })
    .optional(),
});

export type TestError = z.infer<typeof TestErrorSchema>;
