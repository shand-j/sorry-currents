import { describe, expect, it } from 'vitest';

import { detectFlaky } from '../utils/detect-flaky.js';

describe('detectFlaky', () => {
  it('should return true when test passed with retries', () => {
    expect(detectFlaky({ status: 'passed', retries: 1 })).toBe(true);
    expect(detectFlaky({ status: 'passed', retries: 3 })).toBe(true);
  });

  it('should return false when test passed without retries', () => {
    expect(detectFlaky({ status: 'passed', retries: 0 })).toBe(false);
  });

  it('should return false when test failed regardless of retries', () => {
    expect(detectFlaky({ status: 'failed', retries: 0 })).toBe(false);
    expect(detectFlaky({ status: 'failed', retries: 2 })).toBe(false);
  });

  it('should return false for skipped tests', () => {
    expect(detectFlaky({ status: 'skipped', retries: 0 })).toBe(false);
  });

  it('should return false for timedOut tests', () => {
    expect(detectFlaky({ status: 'timedOut', retries: 1 })).toBe(false);
  });

  it('should return false for interrupted tests', () => {
    expect(detectFlaky({ status: 'interrupted', retries: 0 })).toBe(false);
  });
});
