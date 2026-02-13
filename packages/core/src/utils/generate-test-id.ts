import { createHash } from 'node:crypto';

/**
 * Generate a deterministic, stable test ID from file path, test title, and project name.
 * Same inputs always produce the same ID across runs and machines.
 */
export function generateTestId(file: string, title: string, project: string): string {
  const input = `${file}\0${title}\0${project}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
