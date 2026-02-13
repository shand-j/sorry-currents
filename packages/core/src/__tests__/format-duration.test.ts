import { describe, expect, it } from 'vitest';

import { formatDuration } from '../utils/format-duration.js';

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds with one decimal', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(12300)).toBe('12.3s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(154_000)).toBe('2m 34s');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatDuration(3_600_000)).toBe('1h 0m 0s');
    expect(formatDuration(3_912_000)).toBe('1h 5m 12s');
  });

  it('should handle negative values', () => {
    expect(formatDuration(-100)).toBe('0ms');
  });
});
