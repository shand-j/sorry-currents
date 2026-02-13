import { z } from 'zod';

import { AnnotationSchema } from './annotation.js';
import { AttachmentSchema } from './attachment.js';
import { TestErrorSchema } from './test-error.js';

export const TEST_STATUSES = [
  'passed',
  'failed',
  'timedOut',
  'skipped',
  'interrupted',
] as const;

export const TestResultSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  title: z.string().min(1),
  project: z.string(),
  status: z.enum(TEST_STATUSES),
  duration: z.number().nonnegative(),
  retries: z.number().int().nonnegative(),
  isFlaky: z.boolean(),
  errors: z.array(TestErrorSchema),
  annotations: z.array(AnnotationSchema),
  tags: z.array(z.string()),
  attachments: z.array(AttachmentSchema),
  startedAt: z.string().datetime(),
  // Playwright uses -1 for skipped tests that never got assigned a worker
  workerId: z.number().int().min(-1),
  shardIndex: z.number().int().positive().optional(),
});

export type TestResult = z.infer<typeof TestResultSchema>;
