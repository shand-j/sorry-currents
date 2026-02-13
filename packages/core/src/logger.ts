/**
 * Log levels ordered by severity.
 * Default: INFO locally, WARN in CI (auto-detected).
 * --verbose → DEBUG, --quiet → ERROR, --silent → SILENT
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Logger interface — injected via constructor, never a global singleton.
 * All log output goes to stderr; stdout is reserved for machine-readable output.
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Console-based Logger implementation. Zero dependencies.
 * Writes all output to stderr to keep stdout clean for machine-readable output.
 */
export class ConsoleLogger implements Logger {
  constructor(private readonly level: LogLevel = LogLevel.INFO) {}

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      this.write('DEBUG', message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO) {
      this.write('INFO', message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      this.write('WARN', message, context);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      this.write('ERROR', message, context);
    }
  }

  private write(
    level: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level}:`;
    if (context && Object.keys(context).length > 0) {
      console.error(prefix, message, context);
    } else {
      console.error(prefix, message);
    }
  }
}

/** Detect if running in CI and return appropriate default log level */
export function detectDefaultLogLevel(): LogLevel {
  const ciEnvVars = ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS_URL', 'CIRCLECI'] as const;
  const isCI = ciEnvVars.some((key) => process.env[key] !== undefined);
  return isCI ? LogLevel.WARN : LogLevel.INFO;
}

/** Create a no-op logger for testing or when logging is disabled */
export function createSilentLogger(): Logger {
  const noop = (): void => {};
  return { debug: noop, info: noop, warn: noop, error: noop };
}
