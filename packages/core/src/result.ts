/**
 * Discriminated union for operations that can fail in expected ways.
 * Never throw for business logic — return a Result instead.
 */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Re-export AppError so callers of Result don't need a separate import for the default error type
import type { AppError } from './errors/app-error.js';

/** Create a successful Result */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Create a failed Result */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
