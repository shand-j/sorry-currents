/**
 * Patterns stripped from error messages before grouping.
 * Removes variable parts (timestamps, UUIDs, ports, temp paths, hex addresses)
 * so the same logical error groups correctly across runs.
 */
const NORMALIZATION_PATTERNS: readonly RegExp[] = [
  // ISO timestamps
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g,
  // UUIDs
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  // Port numbers in URLs
  /:\d{4,5}\b/g,
  // Temp file paths (platform-agnostic)
  /\/tmp\/[^\s]+/g,
  /[A-Z]:\\(?:Temp|tmp)\\[^\s]+/gi,
  // Hex memory addresses
  /0x[0-9a-f]{6,16}/gi,
  // PID-like numbers after "pid" or "process"
  /\b(?:pid|process)\s*[:=]?\s*\d+/gi,
  // Consecutive whitespace collapsed
  /\s+/g,
] as const;

/**
 * Normalize an error message by stripping variable parts.
 * This allows the same logical error to be grouped across different runs,
 * machines, and environments.
 */
export function normalizeError(message: string): string {
  let normalized = message;
  for (const pattern of NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(pattern, (match) => {
      // Collapse whitespace to single space, replace everything else with placeholder
      if (/^\s+$/.test(match)) return ' ';
      return '<…>';
    });
  }
  return normalized.trim();
}
