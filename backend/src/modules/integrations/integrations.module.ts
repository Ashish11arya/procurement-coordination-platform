import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GOVERNMENT_DATA_PROVIDER } from './contracts/government-data-provider.interface';
import { MockGovernmentProvider } from './providers/mock-government.provider';
import { ESamridhiProvider } from './providers/esamridhi.provider';
import { GovernmentCircuitBreaker } from './circuit-breaker/government-circuit-breaker.service';
import { ResilientGovernmentProvider } from './providers/resilient-government-provider';

@Module({
  imports: [ConfigModule],
  providers: [
    GovernmentCircuitBreaker,
    MockGovernmentProvider,
    ESamridhiProvider,
    {
      provide: GOVERNMENT_DATA_PROVIDER,
      useFactory: (
        configService: ConfigService,
        mockProvider: MockGovernmentProvider,
        eSamridhiProvider: ESamridhiProvider,
        circuitBreaker: GovernmentCircuitBreaker,
      ) => {
        const providerSetting = (
          configService.get<string>('GOVERNMENT_PROVIDER') || 'mock'
        )
          .trim()
          .toLowerCase();

        const baseProvider =
          providerSetting === 'esamridhi' ? eSamridhiProvider : mockProvider;

        // Wrap with Section 21 zero-disruption circuit breaker decorator
        return new ResilientGovernmentProvider(baseProvider, circuitBreaker);
      },
      inject: [
        ConfigService,
        MockGovernmentProvider,
        ESamridhiProvider,
        GovernmentCircuitBreaker,
      ],
    },
  ],
  exports: [
    GOVERNMENT_DATA_PROVIDER,
    GovernmentCircuitBreaker,
    MockGovernmentProvider,
    ESamridhiProvider,
  ],
})
export class IntegrationsModule {}
