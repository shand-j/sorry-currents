import { z } from 'zod';

export const AttachmentSchema = z.object({
  name: z.string(),
  contentType: z.string(),
  path: z.string(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;
