/**
 * Base error for external service failures.
 * Carries service name, retryability, and a user-friendly message.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly isRetryable: boolean,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Thrown when a circuit breaker is in OPEN state — the call is skipped entirely.
 */
export class CircuitOpenError extends ServiceError {
  constructor(service: string) {
    const userMessage = USER_FRIENDLY_MESSAGES[service] ?? `${service} is temporarily unavailable`;
    super(
      `Circuit breaker open for ${service}`,
      service,
      false,
      userMessage
    );
    this.name = "CircuitOpenError";
  }
}

const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  serpapi: "Product search is temporarily unavailable. Try again in a minute.",
  agentql: "Could not load product details right now. Try again shortly.",
  tinyfish: "Purchase automation is temporarily down. Please try again in a minute.",
};
