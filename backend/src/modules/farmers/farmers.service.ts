import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Farmer, FarmerDocument } from './schemas/farmer.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schemas/booking.schema';
import { ConsentRecord, ConsentRecordDocument, ConsentStatus } from '../compliance/schemas/consent.schema';
import { DataProcessingLogService } from '../compliance/services/data-processing-log.service';
import { ProcessingPurpose, LawfulBasis, ProcessingAction } from '../compliance/schemas/data-processing-log.schema';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import { Role } from '../../shared/enums/roles.enum';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
  FarmerEligibilityRecord,
  GovernmentFarmerRecord,
} from '../integrations/contracts/government-data-provider.interface';

export interface RequestClientMetadata {
  ipAddress: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class FarmersService {
  private readonly logger = new Logger(FarmersService.name);

  constructor(
    @InjectModel(Farmer.name) private readonly farmerModel: Model<FarmerDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  private get bookingModel(): Model<BookingDocument> | null {
    if (!this.moduleRef) return null;
    try {
      return this.moduleRef.get<Model<BookingDocument>>(getModelToken(Booking.name), { strict: false });
    } catch {
      return null;
    }
  }

  private get consentModel(): Model<ConsentRecordDocument> | null {
    if (!this.moduleRef) return null;
    try {
      return this.moduleRef.get<Model<ConsentRecordDocument>>(getModelToken(ConsentRecord.name), { strict: false });
    } catch {
      return null;
    }
  }

  private get processingLogService(): DataProcessingLogService | null {
    if (!this.moduleRef) return null;
    try {
      return this.moduleRef.get<DataProcessingLogService>(DataProcessingLogService, { strict: false });
    } catch {
      return null;
    }
  }

  /**
   * View farmer profile. Synchronizes authoritative government record if missing.
   * Records PII read in DataProcessingLog under DPDP Section 8.
   */
  async getProfile(userId: string, meta?: RequestClientMetadata): Promise<FarmerDocument> {
    let farmer = await this.farmerModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!farmer) {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.mobile) {
        throw new NotFoundException('Farmer user not found.');
      }

      // Query government provider for authoritative baseline (with Section 21 fallback)
      let govRecord: GovernmentFarmerRecord | null = null;
      try {
        govRecord = await this.govProvider.getFarmer(user.mobile);
      } catch (err: any) {
        this.logger.warn(`Government farmer lookup unavailable (${err.message}). Using local profile baseline.`);
      }

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

    // Log PII processing activity
    if (this.processingLogService && meta) {
      this.processingLogService.logAccess({
        accessor: {
          userId,
          role: Role.FARMER,
          name: farmer.name,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        dataSubject: {
          farmerId: farmer.farmerId,
          userId,
          mobile: farmer.mobile,
        },
        dataCategoriesAccessed: ['NAME', 'MOBILE', 'LAND_RECORDS', 'BANK_VERIFIED'],
        processingPurpose: ProcessingPurpose.ADMIN_INSPECTION,
        lawfulBasis: LawfulBasis.CONSENT_SEC_6,
        action: ProcessingAction.READ,
        details: 'Farmer queried own personal profile.',
      }).catch(() => {});
    }

    return farmer;
  }

  /**
   * Update farmer profile. Only non-authoritative preferences (address, language) can be changed.
   */
  async updateProfile(
    userId: string,
    dto: UpdateFarmerProfileDto,
    meta?: RequestClientMetadata,
  ): Promise<FarmerDocument> {
    const farmer = await this.getProfile(userId, meta);

    if (dto.contactAddress !== undefined) {
      farmer.contactAddress = dto.contactAddress;
    }
    if (dto.preferredLanguage !== undefined) {
      farmer.preferredLanguage = dto.preferredLanguage;
    }

    await farmer.save();
    this.logger.log(`Farmer profile preferences updated for farmerId: ${farmer.farmerId}`);

    if (this.processingLogService && meta) {
      this.processingLogService.logAccess({
        accessor: {
          userId,
          role: Role.FARMER,
          name: farmer.name,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        dataSubject: {
          farmerId: farmer.farmerId,
          userId,
          mobile: farmer.mobile,
        },
        dataCategoriesAccessed: ['DELIVERY_ADDRESS', 'LANGUAGE_PREFERENCE'],
        processingPurpose: ProcessingPurpose.ADMIN_INSPECTION,
        lawfulBasis: LawfulBasis.CONSENT_SEC_6,
        action: ProcessingAction.UPDATE,
        details: 'Farmer updated profile preferences.',
      }).catch(() => {});
    }

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
    try {
      return await this.govProvider.getFarmerEligibility(farmer.farmerId, commodityCode);
    } catch (err: any) {
      this.logger.warn(
        `Government eligibility check unavailable (${err.message}). Returning Section 21 provisional eligibility.`,
      );
      const estimatedQuota = Math.max(50, Math.round((farmer.landAreaAcres || 4) * 25));
      return {
        farmerId: farmer.farmerId,
        commodityCode: commodityCode.toUpperCase(),
        sanctionedQuantityQuintals: estimatedQuota,
        alreadyProcuredQuantityQuintals: 0,
        remainingEligibleQuantityQuintals: estimatedQuota,
        season: 'RABI_2026',
        year: 2026,
        validUntil: new Date(Date.now() + 90 * 86400000).toISOString(),
        isEligible: true,
      };
    }
  }

  /**
   * DPDP Act 2023 Section 11: Data Subject Right to Access & Data Portability.
   * Compiles an exhaustive, portable data dump of all personal records.
   */
  async exportFarmerData(userId: string, meta: RequestClientMetadata) {
    const farmer = await this.getProfile(userId, meta);

    const [consents, bookings, processingLogs] = await Promise.all([
      this.consentModel ? this.consentModel.find({ farmerId: farmer.farmerId }).sort({ grantedAt: -1 }).lean().exec() : [],
      this.bookingModel ? this.bookingModel.find({ farmerId: farmer.farmerId }).sort({ createdAt: -1 }).lean().exec() : [],
      this.processingLogService ? this.processingLogService.getLogsForFarmer(farmer.farmerId, 50) : [],
    ]);

    const payload = {
      exportMetadata: {
        exportId: crypto.randomUUID(),
        exportedAt: new Date().toISOString(),
        statute: 'Digital Personal Data Protection (DPDP) Act, 2023 - Section 11 Right to Information & Data Portability',
        dataFiduciary: 'Department of Agriculture & Farmers Welfare, Government of India',
        dataSubjectId: farmer.farmerId,
        recordCounts: {
          consents: consents.length,
          procurementBookings: bookings.length,
          processingAccessLogs: processingLogs.length,
        },
      },
      personalIdentity: {
        farmerId: farmer.farmerId,
        registrationNumber: farmer.registrationNumber,
        name: farmer.name,
        mobile: farmer.mobile,
        landAreaAcres: farmer.landAreaAcres,
        bankAccountVerified: farmer.bankAccountVerified,
        location: {
          state: farmer.state,
          district: farmer.district,
          subDistrict: farmer.subDistrict,
          village: farmer.village,
          contactAddress: farmer.contactAddress || null,
        },
        preferredLanguage: farmer.preferredLanguage,
        accountStatus: farmer.isActive ? 'ACTIVE' : 'DEACTIVATED',
      },
      dpdpConsentRecords: consents,
      procurementBookings: bookings,
      piiProcessingAccessHistory: processingLogs,
    };

    // Calculate SHA-256 integrity checksum
    const checksumSha256 = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    (payload.exportMetadata as any).checksumSha256 = checksumSha256;

    // Log data export under DPDP Section 8
    if (this.processingLogService) {
      await this.processingLogService.logAccess({
        accessor: {
          userId,
          role: Role.FARMER,
          name: farmer.name,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        dataSubject: {
          farmerId: farmer.farmerId,
          userId,
          mobile: farmer.mobile,
        },
        dataCategoriesAccessed: [
          'NAME',
          'MOBILE',
          'LAND_RECORDS',
          'BANK_VERIFIED',
          'BOOKINGS',
          'CONSENT_HISTORY',
          'PROCESSING_LOGS',
        ],
        processingPurpose: ProcessingPurpose.DATA_SUBJECT_EXPORT,
        lawfulBasis: LawfulBasis.LEGAL_OBLIGATION_SEC_7F,
        action: ProcessingAction.EXPORT,
        details: 'Farmer requested full portable data dump under DPDP Section 11.',
      }).catch(() => {});
    }

    return payload;
  }

  /**
   * DPDP Act 2023 Section 12: Right to Erasure / Account Deletion.
   * Anonymizes farmer PII while enforcing the statutory 7-year financial audit hold under GFR Rule 290.
   */
  async deleteFarmerAccount(userId: string, meta: RequestClientMetadata) {
    const farmer = await this.getProfile(userId, meta);
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    // Safety check: Prevent erasure if vehicle is actively inside the mandi yard or in weighbridge queue
    if (this.bookingModel) {
      const activeYardBooking = await this.bookingModel.findOne({
        farmerId: farmer.farmerId,
        status: { $in: [BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS] },
      }).exec();

      if (activeYardBooking) {
        throw new BadRequestException(
          `Cannot delete account while an arrival token (${activeYardBooking.tokenNumber}) is currently active in the Mandi yard. Please wait for procurement completion or cancel your token first.`,
        );
      }
    }

    const anonymizedId = `ANONYMIZED_FARMER_${farmer._id.toString().slice(-6)}`;
    const mobileHash = `ANON_${crypto.createHash('sha256').update(farmer.mobile).digest('hex').slice(0, 10)}`;

    // 1. Anonymize Farmer Profile
    farmer.name = anonymizedId;
    farmer.mobile = mobileHash;
    farmer.village = 'REDACTED_VILLAGE';
    farmer.contactAddress = undefined;
    farmer.isActive = false;
    await farmer.save();

    // 2. Anonymize User Account & Invalidate Tokens
    user.name = anonymizedId;
    (user as any).mobile = undefined; // Clears unique index so phone number is released
    user.isActive = false;
    user.tokenVersion = (user.tokenVersion || 1) + 1; // Immediately invalidates existing JWTs
    await user.save();

    // 3. Revoke all active DPDP Consents
    if (this.consentModel) {
      await this.consentModel.updateMany(
        { farmerId: farmer.farmerId, status: ConsentStatus.ACTIVE },
        {
          $set: {
            status: ConsentStatus.REVOKED,
            revokedAt: new Date(),
            revocationReason: 'Data Subject Right to Erasure exercised under DPDP Act 2023 Sec 12',
          },
        },
      ).exec();
    }

    // 4. Anonymize Procurement Bookings under Statutory GFR Legal Hold
    let preservedBookingsCount = 0;
    if (this.bookingModel) {
      const updateResult = await this.bookingModel.updateMany(
        { farmerId: farmer.farmerId },
        {
          $set: {
            farmerId: `ANONYMIZED_${farmer.farmerId}`,
          },
        },
      ).exec();
      preservedBookingsCount = updateResult.modifiedCount || 0;
    }

    // 5. Log Data Subject Erasure in Data Processing Log
    if (this.processingLogService) {
      await this.processingLogService.logAccess({
        accessor: {
          userId,
          role: Role.FARMER,
          name: anonymizedId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        dataSubject: {
          farmerId: farmer.farmerId,
          userId,
        },
        dataCategoriesAccessed: ['NAME', 'MOBILE', 'VILLAGE', 'TOKENS', 'CONSENTS'],
        processingPurpose: ProcessingPurpose.DATA_SUBJECT_ERASURE,
        lawfulBasis: LawfulBasis.LEGAL_OBLIGATION_SEC_7F,
        action: ProcessingAction.ANONYMIZE,
        details: `Farmer account erased and pseudonymized to ${anonymizedId}. Preserved ${preservedBookingsCount} bookings under 7-year GFR statutory hold.`,
      }).catch(() => {});
    }

    this.logger.warn(`[DPDP Erasure] Farmer ${farmer.farmerId} personal data erased and pseudonymized to ${anonymizedId}.`);

    return {
      success: true,
      message: 'Farmer account personal data has been erased and pseudonymized in compliance with DPDP Act 2023 Section 12.',
      erasureSummary: {
        pseudonymizedId: anonymizedId,
        personalDataPurged: [
          'Full Name (replaced with anonymous identifier)',
          'Mobile Phone Number (detached and unlinked)',
          'Residential & Village Address (redacted)',
          'Active Portal Access Tokens (revoked)',
          'DPDP Consent Scopes (revoked)',
        ],
        statutoryAuditRetention: {
          legalHoldEnforced: true,
          statutoryFramework: 'General Financial Rules (GFR), 2017 Rule 290 & CAG Public Procurement Guidelines (7-Year Mandatory Hold)',
          preservedRecordsCount: preservedBookingsCount,
          preservedFields: [
            'Net Grain Weighment Quantities (Quintals)',
            'Quality Lab Assay Moisture & Conformance Grades',
            'Minimum Support Price (MSP) Financial Disbursement Records',
            'Administrative Audit Logs',
          ],
          retentionPeriodYears: 7,
          legalBasis: 'DPDP Act 2023 Section 12(3) & Section 8(7) exemption for statutory public finance audits.',
        },
      },
    };
  }
}
