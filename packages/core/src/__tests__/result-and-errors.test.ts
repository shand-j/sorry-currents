import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import { ok, err, type Result } from '../result.js';

describe('Result', () => {
  describe('ok', () => {
    it('should create a successful result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should work with complex types', () => {
      const result = ok({ name: 'test', values: [1, 2, 3] });
      expect(result.ok).toBe(true);
    });
  });

  describe('err', () => {
    it('should create a failed result', () => {
      const error = new AppError(ErrorCode.FILE_NOT_FOUND, 'not found');
      const result = err(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      }
    });
  });

  describe('type narrowing', () => {
    it('should narrow types correctly via ok check', () => {
      const result: Result<number> = ok(10);
      if (result.ok) {
        // TypeScript knows value is number here
        const doubled: number = result.value * 2;
        expect(doubled).toBe(20);
      }
    });
  });
});

describe('AppError', () => {
  it('should create via constructor', () => {
    const error = new AppError(ErrorCode.UNEXPECTED, 'something broke', { key: 'val' });
    expect(error.code).toBe(ErrorCode.UNEXPECTED);
    expect(error.message).toBe('something broke');
    expect(error.context).toEqual({ key: 'val' });
  });

  it('should serialize to JSON', () => {
    const cause = new Error('root cause');
    const error = new AppError(ErrorCode.FILE_NOT_FOUND, 'missing', { path: '/a' }, cause);
    const json = error.toJSON();
    expect(json.code).toBe('FILE_NOT_FOUND');
    expect(json.message).toBe('missing');
    expect(json.context).toEqual({ path: '/a' });
    expect(json.cause).toBe('root cause');
  });

  describe('factory methods', () => {
    it('should create fileNotFound', () => {
      const error = AppError.fileNotFound('/missing.json');
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.context).toEqual({ path: '/missing.json' });
    });

    it('should create fileParseError', () => {
      const error = AppError.fileParseError('/bad.json', new Error('bad JSON'));
      expect(error.code).toBe(ErrorCode.FILE_PARSE_ERROR);
      expect(error.cause?.message).toBe('bad JSON');
    });

    it('should create playwrightNotFound', () => {
      const error = AppError.playwrightNotFound();
      expect(error.code).toBe(ErrorCode.PLAYWRIGHT_NOT_FOUND);
    });

    it('should create playwrightVersion', () => {
      const error = AppError.playwrightVersion('1.20.0', '1.30.0');
      expect(error.code).toBe(ErrorCode.PLAYWRIGHT_VERSION);
      expect(error.context).toEqual({ found: '1.20.0', minimum: '1.30.0' });
    });
  });
});
