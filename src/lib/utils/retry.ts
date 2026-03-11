export interface RetryOptions {
  /** Maximum number of retry attempts (not counting the initial call). Default 3. */
  maxRetries?: number;
  /** Initial backoff in ms. Doubles each attempt. Default 500. */
  backoffMs?: number;
  /** Return true if the error is worth retrying. Default: always retry. */
  shouldRetry?: (error: unknown) => boolean;
  /** Called before each retry attempt (for logging). */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Execute `fn` with exponential-backoff retries.
 *
 * Backoff schedule (defaults): 500ms -> 1s -> 2s
 * Each call to `fn` is fresh, so transient state (AbortControllers, etc.) resets naturally.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    backoffMs = 500,
    shouldRetry = () => true,
    onRetry,
  } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = backoffMs * 2 ** attempt;
      onRetry?.(error, attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but TypeScript needs it
  throw lastError;
}
