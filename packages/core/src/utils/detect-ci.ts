/** Well-known CI environment variable names */
const CI_ENV_MAP = {
  GITHUB_ACTIONS: 'github-actions',
  GITLAB_CI: 'gitlab-ci',
  JENKINS_URL: 'jenkins',
  CIRCLECI: 'circleci',
  BUILDKITE: 'buildkite',
  TRAVIS: 'travis',
  AZURE_PIPELINES: 'azure-pipelines',
  TF_BUILD: 'azure-pipelines',
} as const;

/**
 * Auto-detect which CI provider is running based on environment variables.
 * Returns 'local' if no known CI is detected.
 */
export function detectCI(
  env: Record<string, string | undefined> = process.env,
): string {
  for (const [envVar, provider] of Object.entries(CI_ENV_MAP)) {
    if (env[envVar] !== undefined) {
      return provider;
    }
  }
  return 'local';
}
