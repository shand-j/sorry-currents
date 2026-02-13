import { describe, expect, it } from 'vitest';

import { generateTestId } from '../utils/generate-test-id.js';

describe('generateTestId', () => {
  it('should produce a deterministic ID for the same inputs', () => {
    const id1 = generateTestId('tests/login.spec.ts', 'should login', 'chromium');
    const id2 = generateTestId('tests/login.spec.ts', 'should login', 'chromium');
    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different files', () => {
    const id1 = generateTestId('tests/login.spec.ts', 'should login', 'chromium');
    const id2 = generateTestId('tests/signup.spec.ts', 'should login', 'chromium');
    expect(id1).not.toBe(id2);
  });

  it('should produce different IDs for different titles', () => {
    const id1 = generateTestId('tests/login.spec.ts', 'should login', 'chromium');
    const id2 = generateTestId('tests/login.spec.ts', 'should logout', 'chromium');
    expect(id1).not.toBe(id2);
  });

  it('should produce different IDs for different projects', () => {
    const id1 = generateTestId('tests/login.spec.ts', 'should login', 'chromium');
    const id2 = generateTestId('tests/login.spec.ts', 'should login', 'firefox');
    expect(id1).not.toBe(id2);
  });

  it('should return a 16-character hex string', () => {
    const id = generateTestId('file.ts', 'test', 'project');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should handle unicode characters in test titles', () => {
    const id = generateTestId('tests/i18n.spec.ts', 'should display 日本語', 'chromium');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should handle empty project string', () => {
    const id = generateTestId('tests/login.spec.ts', 'should login', '');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});
