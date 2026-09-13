import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { IntegrationsModule } from '../../modules/integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  controllers: [HealthController],
  exports: [],
})
export class HealthModule {}
