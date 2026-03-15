import { CircuitOpenError } from "./service-error";

type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default 3. */
  threshold?: number;
  /** Cooldown in ms before transitioning from OPEN to HALF_OPEN. Default 60_000. */
  cooldownMs?: number;
  /** Window in ms — failures older than this don't count. Default 300_000 (5 min). */
  failureWindowMs?: number;
}

export class CircuitBreaker {
  state: CircuitState = "closed";
  consecutiveFailures = 0;
  lastFailureTime = 0;

  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly failureWindowMs: number;

  constructor(
    public readonly name: string,
    opts: CircuitBreakerOptions = {}
  ) {
    this.threshold = opts.threshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
    this.failureWindowMs = opts.failureWindowMs ?? 300_000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        // Transition to half-open: allow one probe call
        this.state = "half_open";
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (this.state === "half_open") {
      // Probe failed — reopen
      this.state = "open";
    } else if (this.consecutiveFailures >= this.threshold) {
      // Check if failures are within the window
      if (Date.now() - this.lastFailureTime <= this.failureWindowMs) {
        this.state = "open";
      }
    }
  }
}

// Registry: one breaker per service name
const registry = new Map<string, CircuitBreaker>();

export function getBreaker(
  name: string,
  opts?: CircuitBreakerOptions
): CircuitBreaker {
  let breaker = registry.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, opts);
    registry.set(name, breaker);
  }
  return breaker;
}
