import {
  GovernmentCircuitBreaker,
  CircuitBreakerState,
} from '../../src/modules/integrations/circuit-breaker/government-circuit-breaker.service';
import { ResilientGovernmentProvider } from '../../src/modules/integrations/providers/resilient-government-provider';
import { ESamridhiProvider } from '../../src/modules/integrations/providers/esamridhi.provider';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { ESamridhiNotYetAuthorizedException } from '../../src/modules/integrations/exceptions/not-yet-authorized.exception';

describe('GovernmentCircuitBreaker & ResilientGovernmentProvider (Section 21 Zero-Disruption)', () => {
  let circuitBreaker: GovernmentCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new GovernmentCircuitBreaker();
  });

  describe('1. Circuit Breaker State Transitions & Thresholds', () => {
    it('should start in CLOSED state with 0 failures', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.totalFailures).toBe(0);
      expect(metrics.totalSuccesses).toBe(0);
    });

    it('should execute operation successfully and record success in CLOSED state', async () => {
      const result = await circuitBreaker.execute('testOp', async () => 'SUCCESS');
      expect(result).toBe('SUCCESS');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.totalSuccesses).toBe(1);
      expect(metrics.consecutiveFailures).toBe(0);
    });

    it('should trip immediately to OPEN when unconfigured credentials exception occurs', async () => {
      const authError = new ESamridhiNotYetAuthorizedException(
        'getFarmer',
        'e-Samridhi requires production credentials',
      );

      const fallbackExecuted = await circuitBreaker.execute(
        'getFarmer',
        async () => {
          throw authError;
        },
        () => 'FALLBACK_VALUE',
      );

      expect(fallbackExecuted).toBe('FALLBACK_VALUE');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
      expect(metrics.lastTripReason).toContain('unconfigured or unauthorized');
    });

    it('should trip to OPEN after 5 consecutive generic network/server failures', async () => {
      for (let i = 1; i <= 4; i++) {
        await circuitBreaker.execute(
          'networkCall',
          async () => {
            throw new Error('504 Gateway Timeout');
          },
          () => 'fallback',
        );
        expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
        expect(circuitBreaker.getMetrics().consecutiveFailures).toBe(i);
      }

      // 5th failure trips the breaker
      await circuitBreaker.execute(
        'networkCall',
        async () => {
          throw new Error('504 Gateway Timeout');
        },
        () => 'fallback',
      );

      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
    });

    it('should fail fast or execute fallback immediately when OPEN without calling upstream', async () => {
      circuitBreaker.trip('Manual trip for testing');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);

      let upstreamCalled = false;
      const result = await circuitBreaker.execute(
        'fastFailOp',
        async () => {
          upstreamCalled = true;
          return 'UPSTREAM';
        },
        () => 'FAST_FALLBACK',
      );

      expect(upstreamCalled).toBe(false);
      expect(result).toBe('FAST_FALLBACK');
    });

    it('should reset cleanly to CLOSED when reset() is invoked', () => {
      circuitBreaker.trip('Testing');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);

      circuitBreaker.reset();
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getMetrics().consecutiveFailures).toBe(0);
    });
  });

  describe('2. ResilientGovernmentProvider Graceful Fallbacks (Zero Disruption)', () => {
    let uncredentialedESamridhi: ESamridhiProvider;
    let resilientProvider: ResilientGovernmentProvider;

    beforeEach(() => {
      circuitBreaker = new GovernmentCircuitBreaker();
      uncredentialedESamridhi = new ESamridhiProvider();
      resilientProvider = new ResilientGovernmentProvider(
        uncredentialedESamridhi,
        circuitBreaker,
      );
    });

    it('should return null on getFarmer without throwing, allowing local profile creation', async () => {
      const result = await resilientProvider.getFarmer('9876543210');
      expect(result).toBeNull();
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
    });

    it('should issue Section 21 provisional quota on getFarmerEligibility without throwing', async () => {
      const result = await resilientProvider.getFarmerEligibility('FARMER-001', 'WHEAT');
      expect(result).toBeDefined();
      expect(result.isEligible).toBe(true);
      expect(result.sanctionedQuantityQuintals).toBe(100);
      expect(result.remainingEligibleQuantityQuintals).toBe(100);
      expect(result.commodityCode).toBe('WHEAT');
      expect(result.season).toBe('RABI_2026');
    });

    it('should return empty list on getCentres without throwing, allowing local database query', async () => {
      const centres = await resilientProvider.getCentres();
      expect(centres).toEqual([]);
    });

    it('should return local capacity ceiling on getCentreCapacity without throwing', async () => {
      const capacity = await resilientProvider.getCentreCapacity('CENTRE-IND-01', '2026-09-14');
      expect(capacity).toBeDefined();
      expect(capacity.centreId).toBe('CENTRE-IND-01');
      expect(capacity.sanctionedDailyCapacityQuintals).toBe(500);
      expect(capacity.availableCapacityQuintals).toBe(500);
    });

    it('should return graceful offline queued status on submitProcurementUpdate so weighment slips print', async () => {
      const updateResult = await resilientProvider.submitProcurementUpdate({
        externalBookingId: 'BK-20260914-0001',
        farmerId: 'FARMER-001',
        centreId: 'CENTRE-IND-01',
        commodityCode: 'WHEAT',
        netWeightQuintals: 45.5,
        moisturePercentage: 11.2,
        foreignMatterPercentage: 0.5,
        qualityGrade: 'GRADE_A',
        counterId: 'CTR-01',
        operatorUserId: 'USER-OP-01',
        timestamp: new Date().toISOString(),
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.statusCode).toBe('OFFLINE_QUEUED');
      expect(updateResult.errorMessage).toContain('CIRCUIT_BREAKER_OPEN');
    });

    it('should report degraded health in syncStatus without throwing 500 error', async () => {
      const syncStatus = await resilientProvider.syncStatus('CENTRE-IND-01');
      expect(syncStatus).toBeDefined();
      expect(syncStatus.isHealthy).toBe(false);
      expect(syncStatus.centreId).toBe('CENTRE-IND-01');
      expect(syncStatus.lastError).toContain('Awaiting e-Samridhi gateway credentials');

      // Now verify behavior when circuit breaker is actively OPEN
      circuitBreaker.trip('Test trip');
      const trippedSync = await resilientProvider.syncStatus('CENTRE-IND-01');
      expect(trippedSync.isHealthy).toBe(false);
      expect(trippedSync.lastError).toContain('CIRCUIT_BREAKER_OPEN');
    });
  });
});
