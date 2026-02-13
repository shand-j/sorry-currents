import type { ZodError } from 'zod';

import { ErrorCode } from './error-codes.js';

/**
 * Structured error class for all expected failure modes.
 * Carries a typed ErrorCode, human-readable message, structured context, and optional cause chain.
 */
export class AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly context: Record<string, unknown>;
  readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    this.code = code;
    this.message = message;
    this.context = context ?? {};
    this.cause = cause;
  }

  // --- Factory methods for common errors ---

  static fileNotFound(path: string): AppError {
    return new AppError(
      ErrorCode.FILE_NOT_FOUND,
      `File not found: ${path}`,
      { path },
    );
  }

  static fileParseError(path: string, cause?: Error): AppError {
    return new AppError(
      ErrorCode.FILE_PARSE_ERROR,
      `Failed to parse file: ${path}`,
      { path },
      cause,
    );
  }

  static fileWriteError(path: string, cause?: Error): AppError {
    return new AppError(
      ErrorCode.FILE_WRITE_ERROR,
      `Failed to write file: ${path}`,
      { path },
      cause,
    );
  }

  static validation(zodError: ZodError, source: string): AppError {
    return new AppError(
      ErrorCode.SCHEMA_VALIDATION,
      `Schema validation failed for: ${source}`,
      {
        source,
        issues: zodError.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    );
  }

  static invalidConfig(message: string, context?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.INVALID_CONFIG, message, context);
  }

  static playwrightNotFound(): AppError {
    return new AppError(
      ErrorCode.PLAYWRIGHT_NOT_FOUND,
      'Playwright is not installed. Install it with: npm install -D @playwright/test',
    );
  }

  static playwrightVersion(found: string, minimum: string): AppError {
    return new AppError(
      ErrorCode.PLAYWRIGHT_VERSION,
      `Playwright version ${found} is not supported. Minimum required: ${minimum}`,
      { found, minimum },
    );
  }

  static githubApiError(message: string, context?: Record<string, unknown>, cause?: Error): AppError {
    return new AppError(ErrorCode.GITHUB_API_ERROR, message, context, cause);
  }

  static slackWebhookError(message: string, context?: Record<string, unknown>, cause?: Error): AppError {
    return new AppError(ErrorCode.SLACK_WEBHOOK_ERROR, message, context, cause);
  }

  static webhookError(url: string, cause?: Error): AppError {
    return new AppError(
      ErrorCode.WEBHOOK_ERROR,
      `Webhook request failed: ${url}`,
      { url },
      cause,
    );
  }

  static networkError(url: string, cause?: Error): AppError {
    return new AppError(
      ErrorCode.NETWORK_ERROR,
      `Network request failed: ${url}`,
      { url },
      cause,
    );
  }

  static unexpected(message: string, cause?: Error): AppError {
    return new AppError(ErrorCode.UNEXPECTED, message, {}, cause);
  }

  /** Serializable representation for logging and reporting */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      ...(this.cause ? { cause: this.cause.message } : {}),
    };
  }
}
