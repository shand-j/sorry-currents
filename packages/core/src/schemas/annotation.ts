import { z } from 'zod';

export const AnnotationSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;
