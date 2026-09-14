import { Injectable, Logger } from '@nestjs/common';
import { ESamridhiNotYetAuthorizedException } from '../exceptions/not-yet-authorized.exception';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  lastStateChangeAt: Date;
  lastTripReason?: string;
  cooldownRemainingSeconds: number;
}

/**
 * GovernmentCircuitBreaker (Section 21 & docs/integration/failure-handling.md)
 *
 * Implements standard 3-state circuit breaker pattern protecting the application
 * against cascading latency, gateway timeouts, and credential misconfigurations
 * when interfacing with external government portals (e-Samridhi / AgriStack / PFMS).
 *
 * States:
 * - CLOSED: Normal operation. All calls routed to upstream GovernmentDataProvider.
 * - OPEN: Upstream down, failing, or uncredentialed. Calls fail fast or execute
 *         local fallback immediately without network stalling.
 * - HALF_OPEN: Cooldown elapsed. Single canary probe dispatched to test recovery.
 */
@Injectable()
export class GovernmentCircuitBreaker {
  private readonly logger = new Logger(GovernmentCircuitBreaker.name);

  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailureAt?: Date;
  private lastSuccessAt?: Date;
  private lastStateChangeAt: Date = new Date();
  private lastTripReason?: string;

  // Configuration (Section 21 & docs/integration/failure-handling.md)
  private readonly failureThreshold = 5; // 5 consecutive failures trip to OPEN
  private readonly cooldownPeriodMs = 60000; // 60s cooldown before HALF_OPEN

  constructor() {
    this.logger.log(`[GovernmentCircuitBreaker] Initialized in CLOSED state (Threshold: ${this.failureThreshold}, Cooldown: ${this.cooldownPeriodMs / 1000}s)`);
  }

  /**
   * Execute an operation protected by the circuit breaker.
   * If the circuit is OPEN, immediately executes fallback (if provided) or throws.
   */
  async execute<T>(
    operationName: string,
    operation: () => Promise<T>,
    fallback?: (error?: Error) => Promise<T> | T,
  ): Promise<T> {
    this.checkCooldownTransition();

    if (this.state === CircuitBreakerState.OPEN) {
      const openError = new Error(
        `[CircuitBreaker:OPEN] Upstream government portal call '${operationName}' rejected. Reason: ${this.lastTripReason || 'High failure rate'}. Using Section 21 offline fallback.`,
      );
      if (fallback) {
        return fallback(openError);
      }
      throw openError;
    }

    try {
      const result = await operation();
      this.recordSuccess(operationName);
      return result;
    } catch (error: any) {
      this.recordFailure(operationName, error);

      if (fallback) {
        return fallback(error);
      }
      throw error;
    }
  }

  /**
   * Record a successful invocation
   */
  recordSuccess(operationName: string): void {
    this.totalSuccesses++;
    this.lastSuccessAt = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.logger.log(`[GovernmentCircuitBreaker] Canary operation '${operationName}' succeeded. Transitioning from HALF_OPEN to CLOSED.`);
      this.state = CircuitBreakerState.CLOSED;
      this.consecutiveFailures = 0;
      this.lastStateChangeAt = new Date();
      this.lastTripReason = undefined;
    } else {
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Record a failure and evaluate if breaker should trip
   */
  recordFailure(operationName: string, error: any): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureAt = new Date();

    const isNotYetAuthorized =
      error instanceof ESamridhiNotYetAuthorizedException ||
      error?.name === 'ESamridhiNotYetAuthorizedException' ||
      error?.message?.includes('requires production API credentials');

    const reason = isNotYetAuthorized
      ? `Government credentials unconfigured or unauthorized for '${operationName}'`
      : `Government portal error in '${operationName}': ${error.message || 'Unknown error'}`;

    if (isNotYetAuthorized) {
      // Immediate trip to OPEN on unconfigured credentials — do not wait for 5 failed attempts
      this.trip(reason);
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.trip(`Canary probe failed: ${reason}`);
    } else if (this.consecutiveFailures >= this.failureThreshold) {
      this.trip(`Consecutive failure threshold (${this.failureThreshold}) reached. Last error: ${reason}`);
    }
  }

  /**
   * Force trip the breaker to OPEN
   */
  trip(reason: string): void {
    if (this.state !== CircuitBreakerState.OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.lastStateChangeAt = new Date();
      this.lastTripReason = reason;
      this.logger.warn(`[GovernmentCircuitBreaker] Breaker TRIPPED to OPEN! Reason: ${reason}`);
    }
  }

  /**
   * Reset breaker to CLOSED
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.consecutiveFailures = 0;
    this.lastStateChangeAt = new Date();
    this.lastTripReason = undefined;
    this.logger.log('[GovernmentCircuitBreaker] Breaker manually RESET to CLOSED.');
  }

  /**
   * Check if cooldown has elapsed to test canary in HALF_OPEN
   */
  private checkCooldownTransition(): void {
    if (this.state === CircuitBreakerState.OPEN) {
      const elapsedMs = Date.now() - this.lastStateChangeAt.getTime();
      if (elapsedMs >= this.cooldownPeriodMs) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.lastStateChangeAt = new Date();
        this.logger.log(`[GovernmentCircuitBreaker] Cooldown period (${this.cooldownPeriodMs / 1000}s) expired. Entering HALF_OPEN canary trial.`);
      }
    }
  }

  /**
   * Return current health and metrics snapshot
   */
  getMetrics(): CircuitBreakerMetrics {
    this.checkCooldownTransition();
    let cooldownRemainingSeconds = 0;
    if (this.state === CircuitBreakerState.OPEN) {
      const elapsedMs = Date.now() - this.lastStateChangeAt.getTime();
      cooldownRemainingSeconds = Math.max(0, Math.ceil((this.cooldownPeriodMs - elapsedMs) / 1000));
    }

    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      lastStateChangeAt: this.lastStateChangeAt,
      lastTripReason: this.lastTripReason,
      cooldownRemainingSeconds,
    };
  }
}
