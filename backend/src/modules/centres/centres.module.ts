import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Centre, CentreSchema } from './schemas/centre.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { Commodity, CommoditySchema } from './schemas/commodity.schema';
import { CentresService } from './centres.service';
import { CentresController } from './centres.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Centre.name, schema: CentreSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Commodity.name, schema: CommoditySchema },
    ]),
    IntegrationsModule,
  ],
  controllers: [CentresController],
  providers: [CentresService],
  exports: [CentresService, MongooseModule],
})
export class CentresModule {}
