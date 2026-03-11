/**
 * HTTP error that carries the status code for retry-decision logic.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }

  /** True for 429 (rate-limited) and 5xx (server error). */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/**
 * Predicate for use with `withRetry`.
 * Retries on:
 *   - HttpError with 429 or 5xx status
 *   - AbortError (timeout)
 *   - TypeError containing "fetch" (network failure)
 * Does NOT retry missing API keys or 4xx client errors.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) return error.isRetryable;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch"))
    return true;
  return false;
}
