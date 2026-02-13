import { describe, expect, it } from 'vitest';

import { normalizeError } from '../utils/normalize-error.js';

describe('normalizeError', () => {
  it('should strip ISO timestamps', () => {
    const result = normalizeError('Error at 2024-01-15T10:30:00.123Z in module');
    expect(result).not.toContain('2024');
    expect(result).toContain('<…>');
  });

  it('should strip UUIDs', () => {
    const result = normalizeError('Failed for session 550e8400-e29b-41d4-a716-446655440000');
    expect(result).not.toContain('550e8400');
    expect(result).toContain('<…>');
  });

  it('should strip port numbers', () => {
    const result = normalizeError('Connection refused at localhost:3000');
    expect(result).not.toContain(':3000');
  });

  it('should strip temp file paths', () => {
    const result = normalizeError('Error reading /tmp/playwright-123/file.txt');
    expect(result).not.toContain('/tmp/');
    expect(result).toContain('<…>');
  });

  it('should strip hex memory addresses', () => {
    const result = normalizeError('Object at 0x7fff5fbff8a0 is invalid');
    expect(result).not.toContain('0x7fff');
    expect(result).toContain('<…>');
  });

  it('should collapse consecutive whitespace', () => {
    const result = normalizeError('Error    in   module');
    expect(result).toBe('Error in module');
  });

  it('should return the same normalized output for equivalent errors', () => {
    const err1 = normalizeError('Timeout at 2024-01-01T00:00:00Z for test abc');
    const err2 = normalizeError('Timeout at 2025-06-15T12:30:00Z for test abc');
    expect(err1).toBe(err2);
  });

  it('should handle empty string', () => {
    expect(normalizeError('')).toBe('');
  });

  it('should handle string with no variable parts', () => {
    const msg = 'Expected true to be false';
    expect(normalizeError(msg)).toBe(msg);
  });
});
