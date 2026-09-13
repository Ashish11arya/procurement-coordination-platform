import { Module } from '@nestjs/common';
import { GOVERNMENT_DATA_PROVIDER } from './contracts/government-data-provider.interface';
import { MockGovernmentProvider } from './providers/mock-government.provider';

@Module({
  providers: [
    {
      provide: GOVERNMENT_DATA_PROVIDER,
      useClass: MockGovernmentProvider,
    },
    MockGovernmentProvider,
  ],
  exports: [GOVERNMENT_DATA_PROVIDER, MockGovernmentProvider],
})
export class IntegrationsModule {}
