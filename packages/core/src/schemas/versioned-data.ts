import { z } from 'zod';

/**
 * Wrapper for all persisted JSON files.
 * Includes schema version for forward/backward compatibility.
 */
export const VersionedDataSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    version: z.number().int().positive(),
    generatedBy: z.string(),
    timestamp: z.string().datetime(),
    data: dataSchema,
  });

export type VersionedData<T> = {
  readonly version: number;
  readonly generatedBy: string;
  readonly timestamp: string;
  readonly data: T;
};
