/**
 * Format a millisecond duration into a human-readable string.
 * Examples: "1.2s", "2m 34s", "1h 5m 12s"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainMinutes = minutes % 60;
    const remainSeconds = seconds % 60;
    return `${hours}h ${remainMinutes}m ${remainSeconds}s`;
  }

  if (minutes > 0) {
    const remainSeconds = seconds % 60;
    return `${minutes}m ${remainSeconds}s`;
  }

  const decimal = (ms / 1000).toFixed(1);
  return `${decimal}s`;
}
