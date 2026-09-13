import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Farmer, FarmerDocument } from './schemas/farmer.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
  FarmerEligibilityRecord,
} from '../integrations/contracts/government-data-provider.interface';

@Injectable()
export class FarmersService {
  private readonly logger = new Logger(FarmersService.name);

  constructor(
    @InjectModel(Farmer.name) private readonly farmerModel: Model<FarmerDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
  ) {}

  /**
   * View farmer profile. Synchronizes authoritative government record if missing.
   */
  async getProfile(userId: string): Promise<FarmerDocument> {
    let farmer = await this.farmerModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!farmer) {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.mobile) {
        throw new NotFoundException('Farmer user not found.');
      }

      // Query government provider for authoritative baseline
      const govRecord = await this.govProvider.getFarmer(user.mobile);

      farmer = new this.farmerModel({
        userId: user._id,
        farmerId: govRecord?.farmerId || user.farmerId || `FARMER-${user.mobile.slice(-4)}`,
        registrationNumber: govRecord?.registrationNumber || `REG-${user.mobile.slice(-5)}`,
        mobile: user.mobile,
        name: govRecord?.name || user.name,
        state: govRecord?.state || user.state || 'Madhya Pradesh',
        district: govRecord?.district || user.district || 'Indore',
        subDistrict: govRecord?.subDistrict || user.subDistrict || 'Sanwer',
        village: govRecord?.village || user.village || 'Demo Village',
        landAreaAcres: govRecord?.landAreaAcres || user.landAreaAcres || 4.0,
        bankAccountVerified: govRecord?.bankAccountVerified ?? true,
        preferredLanguage: 'hi',
        isActive: true,
      });

      await farmer.save();
    }

    return farmer;
  }

  /**
   * Update farmer profile. Only non-authoritative preferences (address, language) can be changed.
   */
  async updateProfile(
    userId: string,
    dto: UpdateFarmerProfileDto,
  ): Promise<FarmerDocument> {
    const farmer = await this.getProfile(userId);

    if (dto.contactAddress !== undefined) {
      farmer.contactAddress = dto.contactAddress;
    }
    if (dto.preferredLanguage !== undefined) {
      farmer.preferredLanguage = dto.preferredLanguage;
    }

    await farmer.save();
    this.logger.log(`Farmer profile preferences updated for farmerId: ${farmer.farmerId}`);
    return farmer;
  }

  /**
   * Fetch authoritative eligibility from GovernmentDataProvider (read-only per Section 3 & 4)
   */
  async getEligibility(
    userId: string,
    commodityCode: string,
  ): Promise<FarmerEligibilityRecord> {
    const farmer = await this.getProfile(userId);
    return this.govProvider.getFarmerEligibility(farmer.farmerId, commodityCode);
  }
}
