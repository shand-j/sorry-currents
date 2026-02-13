import { describe, expect, it } from 'vitest';

import { detectCI } from '../utils/detect-ci.js';

describe('detectCI', () => {
  it('should detect GitHub Actions', () => {
    expect(detectCI({ GITHUB_ACTIONS: 'true' })).toBe('github-actions');
  });

  it('should detect GitLab CI', () => {
    expect(detectCI({ GITLAB_CI: 'true' })).toBe('gitlab-ci');
  });

  it('should detect Jenkins', () => {
    expect(detectCI({ JENKINS_URL: 'http://jenkins.local' })).toBe('jenkins');
  });

  it('should detect CircleCI', () => {
    expect(detectCI({ CIRCLECI: 'true' })).toBe('circleci');
  });

  it('should detect Azure Pipelines via AZURE_PIPELINES', () => {
    expect(detectCI({ AZURE_PIPELINES: 'true' })).toBe('azure-pipelines');
  });

  it('should detect Azure Pipelines via TF_BUILD', () => {
    expect(detectCI({ TF_BUILD: 'True' })).toBe('azure-pipelines');
  });

  it('should return local when no CI is detected', () => {
    expect(detectCI({})).toBe('local');
  });

  it('should return the first match when multiple CI vars are set', () => {
    const result = detectCI({ GITHUB_ACTIONS: 'true', GITLAB_CI: 'true' });
    expect(result).toBe('github-actions');
  });
});
