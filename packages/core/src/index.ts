// Result pattern
export { type Result, ok, err } from './result.js';

// Errors
export { ErrorCode } from './errors/error-codes.js';
export { AppError } from './errors/app-error.js';

// Logger
export {
  LogLevel,
  ConsoleLogger,
  detectDefaultLogLevel,
  createSilentLogger,
  type Logger,
} from './logger.js';

// Schemas & types
export {
  AnnotationSchema,
  type Annotation,
  AttachmentSchema,
  type Attachment,
  EnvironmentInfoSchema,
  type EnvironmentInfo,
  ErrorSummarySchema,
  type ErrorSummary,
  TestHistorySchema,
  type TestHistory,
  GitInfoSchema,
  type GitInfo,
  InitConfigSchema,
  GeneratedFileSchema,
  CI_PROVIDERS,
  PACKAGE_MANAGERS,
  type InitConfig,
  type GeneratedFile,
  ReporterOptionsSchema,
  type ReporterOptions,
  RunConfigSchema,
  type RunConfig,
  RunResultSchema,
  RUN_STATUSES,
  type RunResult,
  ShardAssignmentSchema,
  ShardPlanSchema,
  SHARD_STRATEGIES,
  type ShardAssignment,
  type ShardPlan,
  ShardTimingDataSchema,
  type ShardTimingData,
  TestErrorSchema,
  type TestError,
  TestResultSchema,
  TEST_STATUSES,
  type TestResult,
  VersionedDataSchema,
  type VersionedData,
} from './schemas/index.js';

// Utilities
export {
  detectCI,
  detectFlaky,
  formatDuration,
  generateTestId,
  mergeRunResults,
  normalizeError,
  readTimingData,
  writeTimingData,
  updateTimingData,
  DEFAULT_TIMING_DATA_PATH,
  readHistory,
  writeHistory,
  updateHistory,
  DEFAULT_HISTORY_PATH,
  clusterErrors,
  clustersToSummaries,
  type ErrorCluster,
} from './utils/index.js';

// Notifications (payload builders — pure, no I/O)
export {
  buildGitHubCommentBody,
  getCommentMarker,
  type GitHubCommentPayload,
  type GitHubCommentOptions,
  buildGitHubStatusPayload,
  type GitHubStatusPayload,
  type GitHubStatusOptions,
  buildSlackPayload,
  type SlackPayload,
  type SlackNotifyOptions,
  buildWebhookPayload,
  type WebhookPayload,
} from './notifications/index.js';
