import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Farmer, FarmerSchema } from './schemas/farmer.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { FarmersService } from './farmers.service';
import { FarmersController } from './farmers.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Farmer.name, schema: FarmerSchema },
      { name: User.name, schema: UserSchema },
    ]),
    IntegrationsModule,
  ],
  controllers: [FarmersController],
  providers: [FarmersService],
  exports: [FarmersService],
})
export class FarmersModule {}
