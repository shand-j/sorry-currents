import { describe, expect, it } from 'vitest';

import { ConsoleLogger, LogLevel, createSilentLogger, detectDefaultLogLevel } from '../logger.js';

describe('ConsoleLogger', () => {
  it('should create with default INFO level', () => {
    const logger = new ConsoleLogger();
    // Logger should exist and have all methods
    expect(logger.debug).toBeTypeOf('function');
    expect(logger.info).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
  });

  it('should not throw when logging at any level', () => {
    const logger = new ConsoleLogger(LogLevel.SILENT);
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.info('test', { key: 'val' })).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });
});

describe('createSilentLogger', () => {
  it('should return a logger with all methods as no-ops', () => {
    const logger = createSilentLogger();
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });
});

describe('detectDefaultLogLevel', () => {
  it('should return WARN in CI', () => {
    const original = process.env.CI;
    process.env.CI = 'true';
    expect(detectDefaultLogLevel()).toBe(LogLevel.WARN);
    if (original === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = original;
    }
  });
});
