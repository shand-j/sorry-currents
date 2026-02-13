import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';

describe('AppError integration factory methods', () => {
  describe('githubApiError', () => {
    it('should create a GITHUB_API_ERROR', () => {
      const error = AppError.githubApiError('Token expired', { hint: 'Refresh token' });
      expect(error.code).toBe(ErrorCode.GITHUB_API_ERROR);
      expect(error.message).toBe('Token expired');
      expect(error.context).toEqual({ hint: 'Refresh token' });
    });

    it('should chain a cause error', () => {
      const cause = new Error('HTTP 401');
      const error = AppError.githubApiError('Auth failed', {}, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('slackWebhookError', () => {
    it('should create a SLACK_WEBHOOK_ERROR', () => {
      const error = AppError.slackWebhookError('Webhook returned 400', { status: 400 });
      expect(error.code).toBe(ErrorCode.SLACK_WEBHOOK_ERROR);
      expect(error.message).toBe('Webhook returned 400');
      expect(error.context).toEqual({ status: 400 });
    });
  });

  describe('webhookError', () => {
    it('should create a WEBHOOK_ERROR with URL in context', () => {
      const error = AppError.webhookError('https://example.com/hook');
      expect(error.code).toBe(ErrorCode.WEBHOOK_ERROR);
      expect(error.message).toContain('https://example.com/hook');
      expect(error.context['url']).toBe('https://example.com/hook');
    });

    it('should chain a cause', () => {
      const cause = new Error('ECONNREFUSED');
      const error = AppError.webhookError('https://example.com', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('networkError', () => {
    it('should create a NETWORK_ERROR with URL in context', () => {
      const error = AppError.networkError('https://api.github.com/repos');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toContain('https://api.github.com/repos');
      expect(error.context['url']).toBe('https://api.github.com/repos');
    });
  });
});
