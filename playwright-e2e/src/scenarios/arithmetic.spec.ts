import { test, expect } from '@playwright/test';

/**
 * Pure computation tests — no DOM interaction needed.
 * Exercises Playwright's expect API with fast execution times.
 * Deliberately kept fast (~50ms each) to contrast with heavier test files.
 * The LPT shard balancer should group these together on a lighter shard.
 */
test.describe('Arithmetic Operations', () => {
  test('should add numbers correctly', async () => {
    expect(2 + 3).toBe(5);
    expect(-1 + 1).toBe(0);
    expect(0.1 + 0.2).toBeCloseTo(0.3);
  });

  test('should subtract numbers correctly', async () => {
    expect(10 - 4).toBe(6);
    expect(0 - 5).toBe(-5);
    expect(100 - 100).toBe(0);
  });

  test('should multiply numbers correctly', async () => {
    expect(3 * 7).toBe(21);
    expect(-2 * 6).toBe(-12);
    expect(0 * 999).toBe(0);
  });

  test('should divide numbers correctly', async () => {
    expect(10 / 2).toBe(5);
    expect(7 / 3).toBeCloseTo(2.333, 2);
    expect(-10 / 5).toBe(-2);
  });

  test('should handle division by zero', async () => {
    expect(1 / 0).toBe(Infinity);
    expect(-1 / 0).toBe(-Infinity);
    expect(0 / 0).toBeNaN();
  });

  test('should calculate fibonacci correctly', async () => {
    function fibonacci(n: number): number {
      if (n <= 1) return n;
      let a = 0, b = 1;
      for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
      }
      return b;
    }

    expect(fibonacci(0)).toBe(0);
    expect(fibonacci(1)).toBe(1);
    expect(fibonacci(10)).toBe(55);
    expect(fibonacci(20)).toBe(6765);
  });
});
